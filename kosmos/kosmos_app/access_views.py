import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .access import ACCESS_ROLES, can_manage_access, sync_user_access_groups, user_access_keys
from .models import AccessAuditLog, AccessRoleAssignment, AccessUserProfile


def _forbidden(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not can_manage_access(request.user):
        return JsonResponse({"error": "Administrator access is required to manage access control."}, status=403)
    return None


def _payload(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _user_data(user):
    today = timezone.localdate()
    access_profile = getattr(user, "access_profile", None)
    role_audit = {}
    for role in ACCESS_ROLES:
        assignments = list(user.access_role_assignments.filter(role=role["key"]).order_by("-last_updated_date"))
        active_assignment = next(
            (
                item for item in assignments
                if (not item.start_date or item.start_date <= today) and (not item.end_date or item.end_date > today)
            ),
            None,
        )
        item = active_assignment or (assignments[0] if assignments else None)
        if not item:
            continue
        role_audit[item.role] = {
            "startDate": item.start_date.isoformat() if item.start_date else "",
            "endDate": item.end_date.isoformat() if item.end_date else "",
            "createdBy": item.created_by,
            "createdDate": item.created_date.isoformat() if item.created_date else "",
            "lastUpdatedBy": item.last_updated_by,
            "lastUpdatedDate": item.last_updated_date.isoformat() if item.last_updated_date else "",
        }
    return {
        "id": user.pk,
        "username": user.get_username(),
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "isActive": user.is_active,
        "isSuperuser": user.is_superuser,
        "lastLogin": user.last_login.isoformat() if user.last_login else "",
        "startDate": access_profile.start_date.isoformat() if access_profile and access_profile.start_date else "",
        "endDate": access_profile.end_date.isoformat() if access_profile and access_profile.end_date else "",
        "access": user_access_keys(user),
        "roleAudit": role_audit,
    }


def _clean_access(raw_access):
    requested = set(raw_access or [])
    allowed = {role["key"] for role in ACCESS_ROLES}
    return [role["key"] for role in ACCESS_ROLES if role["key"] in requested and role["key"] in allowed]


def _clean_date(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _audit_window(request):
    today = timezone.localdate()
    date_from = _clean_date(request.GET.get("dateFrom")) or (today - timedelta(days=9))
    date_to = _clean_date(request.GET.get("dateTo")) or today
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    return date_from, date_to


def _actor(request):
    return request.user.get_username() or request.user.email or "system"


def _role_label(role_key):
    role = next((item for item in ACCESS_ROLES if item["key"] == role_key), None)
    return role["label"] if role else role_key


def _user_label(user):
    return user.email or user.get_username()


def _describe_value(value):
    if value is None or value == "":
        return "blank"
    if isinstance(value, bool):
        return "active" if value else "inactive"
    return str(value)


def _write_log(user, action, description, actor, role=""):
    AccessAuditLog.objects.create(
        user=user,
        action=action,
        role=role,
        description=description,
        created_by=actor,
    )


def _write_event(user, action, actor, fragments, role=""):
    if not fragments:
        return
    _write_log(user, action, _combine_event(actor, _user_label(user), fragments), actor, role=role)


def _write_each_event(user, action, actor, fragments, role=""):
    for fragment in fragments:
        _write_event(user, action, actor, [fragment], role=role)


def _combine_event(actor, target, fragments):
    cleaned = [item.rstrip(".") for item in fragments]
    return f"{actor} performed this access-control event for {target}: " + "; ".join(cleaned) + "."


def _event_action(fragments, created_user=False):
    if created_user:
        return AccessAuditLog.ACTION_USER_CREATED
    grants = [item for item in fragments if "granted" in item.lower()]
    revokes = [item for item in fragments if "revoked" in item.lower()]
    if len(fragments) == len(grants) and grants:
        return AccessAuditLog.ACTION_ROLE_GRANTED
    if len(fragments) == len(revokes) and revokes:
        return AccessAuditLog.ACTION_ROLE_REVOKED
    if grants or revokes:
        return AccessAuditLog.ACTION_ACCESS_CHANGED
    return AccessAuditLog.ACTION_USER_UPDATED


def _audit_summary(logs):
    rows = list(logs)
    return {
        "total": len(rows),
        "grants": sum(1 for item in rows if item.action == AccessAuditLog.ACTION_ROLE_GRANTED),
        "revokes": sum(1 for item in rows if item.action == AccessAuditLog.ACTION_ROLE_REVOKED),
        "userChanges": sum(1 for item in rows if item.action in {
            AccessAuditLog.ACTION_USER_CREATED,
            AccessAuditLog.ACTION_USER_UPDATED,
            AccessAuditLog.ACTION_USER_ACTIVATED,
            AccessAuditLog.ACTION_USER_DEACTIVATED,
            AccessAuditLog.ACTION_USER_REVOKED,
        }),
        "accessChanges": sum(1 for item in rows if item.action == AccessAuditLog.ACTION_ACCESS_CHANGED),
        "actors": len({item.created_by for item in rows if item.created_by}),
    }


def _field_change_descriptions(before, after):
    labels = {
        "username": "Username",
        "email": "Email",
        "first_name": "First name",
        "last_name": "Last name",
        "is_active": "Status",
    }
    changes = []
    for field, label in labels.items():
        if before.get(field) == after.get(field):
            continue
        if field == "is_active":
            changes.append(f"Status has been updated from {_describe_value(before.get(field))} to {_describe_value(after.get(field))}.")
        else:
            changes.append(f"{label} has been updated from {_describe_value(before.get(field))} to {_describe_value(after.get(field))}.")
    return changes


def _profile_change_descriptions(before, after):
    return [
        item for item in _field_change_descriptions(before, after)
        if not item.lower().startswith("status updated")
    ]


def _status_change_fragment(before, after):
    if before.get("is_active") == after.get("is_active"):
        return ""
    return f"Status has been updated from {_describe_value(before.get('is_active'))} to {_describe_value(after.get('is_active'))}."


def _status_action(is_active):
    return AccessAuditLog.ACTION_USER_ACTIVATED if is_active else AccessAuditLog.ACTION_USER_DEACTIVATED


def _profile_window_snapshot(user):
    profile = getattr(user, "access_profile", None)
    return {
        "start_date": profile.start_date if profile else None,
        "end_date": profile.end_date if profile else None,
    }


def _profile_window_change_descriptions(before, after):
    labels = {
        "start_date": "Start date",
        "end_date": "End date",
    }
    changes = []
    for field, label in labels.items():
        if before.get(field) != after.get(field):
            changes.append(f"{label} has been updated from {_describe_value(before.get(field))} to {_describe_value(after.get(field))}.")
    return changes


def _save_profile_window(user, data, actor):
    profile, created = AccessUserProfile.objects.get_or_create(
        user=user,
        defaults={
            "created_by": actor,
            "last_updated_by": actor,
        },
    )
    before = {
        "start_date": None if created else profile.start_date,
        "end_date": None if created else profile.end_date,
    }
    profile.start_date = _clean_date(data.get("startDate"))
    profile.end_date = _clean_date(data.get("endDate"))
    profile.last_updated_by = actor
    profile.save(update_fields=["start_date", "end_date", "last_updated_by", "last_updated_date"])
    after = {
        "start_date": profile.start_date,
        "end_date": profile.end_date,
    }
    return _profile_window_change_descriptions(before, after)


def _write_permission_events(user, actor, fragments):
    grants = [item for item in fragments if "granted" in item.lower()]
    revokes = [item for item in fragments if "revoked" in item.lower()]
    changes = [item for item in fragments if item not in grants and item not in revokes]
    _write_event(user, AccessAuditLog.ACTION_ROLE_GRANTED, actor, grants)
    _write_event(user, AccessAuditLog.ACTION_ROLE_REVOKED, actor, revokes)
    _write_event(user, AccessAuditLog.ACTION_ACCESS_CHANGED, actor, changes)


def _save_user_identity(user, data, created_user=False):
    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"error": "Email is required."}, status=400)
    user.username = email[:150]
    user.email = email[:254]
    user.first_name = (data.get("firstName") or "").strip()[:150]
    user.last_name = (data.get("lastName") or "").strip()[:150]
    user.is_active = bool(data.get("isActive", True))
    if created_user and not user.has_usable_password():
        user.set_unusable_password()
    return None


def _log_data(item):
    user = item.user
    return {
        "id": item.pk,
        "user": user.get_full_name() or user.get_username(),
        "username": user.get_username(),
        "email": user.email,
        "action": item.action,
        "role": item.role,
        "roleLabel": _role_label(item.role) if item.role else "",
        "status": item.get_action_display(),
        "description": item.description,
        "createdBy": item.created_by,
        "createdDate": item.created_date.isoformat() if item.created_date else "",
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def access_control(request):
    denied = _forbidden(request)
    if denied:
        return denied

    User = get_user_model()
    if request.method == "GET":
        date_from, date_to = _audit_window(request)
        users = User.objects.select_related("access_profile").prefetch_related("groups", "access_role_assignments").order_by("username")
        filtered_logs = AccessAuditLog.objects.select_related("user").filter(
            created_date__date__gte=date_from,
            created_date__date__lte=date_to,
        ).order_by("-created_date")
        logs = list(filtered_logs[:500])
        return JsonResponse({
            "roles": ACCESS_ROLES,
            "users": [_user_data(item) for item in users],
            "logs": [_log_data(item) for item in logs],
            "audit": {
                "dateFrom": date_from.isoformat(),
                "dateTo": date_to.isoformat(),
                "summary": _audit_summary(logs),
            },
        })

    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    action = data.get("action")

    try:
        with transaction.atomic():
            if action == "save_user":
                user_id = data.get("id")
                email = (data.get("email") or "").strip().lower()
                start_date = _clean_date(data.get("startDate")) or timezone.localdate()
                end_date = _clean_date(data.get("endDate"))
                if not email:
                    return JsonResponse({"error": "Email is required."}, status=400)

                created_user = not user_id
                user = User.objects.get(pk=user_id) if user_id else User(username=email[:150])
                before_user = {
                    "username": user.get_username(),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_active": user.is_active,
                }
                if User.objects.exclude(pk=user.pk).filter(username__iexact=email).exists():
                    return JsonResponse({"error": "That email already has access as a username."}, status=400)
                if email and User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
                    return JsonResponse({"error": "That email already has access."}, status=400)

                user.is_staff = bool(data.get("isStaff", False)) or "administrator" in _clean_access(data.get("access"))
                error = _save_user_identity(user, data, created_user=created_user)
                if error:
                    return error
                user.save()
                actor = _actor(request)
                profile_window_fragments = _save_profile_window(user, data, actor)
                after_user = {
                    "username": user.get_username(),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_active": user.is_active,
                }
                if created_user:
                    event_fragments = [f"user {_user_label(user)} has been created"]
                    event_fragments.extend(profile_window_fragments)
                else:
                    event_fragments = _field_change_descriptions(before_user, after_user)
                    event_fragments.extend(profile_window_fragments)

                selected_access = _clean_access(data.get("access"))
                today = timezone.localdate()
                for role in ACCESS_ROLES:
                    active_assignments = AccessRoleAssignment.objects.filter(
                        user=user,
                        role=role["key"],
                    ).filter(Q(end_date__isnull=True) | Q(end_date__gt=today)).order_by("-last_updated_date")
                    assignment = active_assignments.first()
                    if role["key"] in selected_access:
                        if assignment:
                            prior_start = assignment.start_date
                            prior_end = assignment.end_date
                            assignment.start_date = start_date
                            assignment.end_date = end_date
                            assignment.last_updated_by = actor
                            date_changes = []
                            if prior_start != start_date:
                                date_changes.append(f"start date updated from {_describe_value(prior_start)} to {_describe_value(start_date)}")
                            if prior_end != end_date:
                                date_changes.append(f"end date updated from {_describe_value(prior_end)} to {_describe_value(end_date)}")
                            assignment.description = f"{_role_label(role['key'])} access " + ", ".join(date_changes) + "." if date_changes else assignment.description
                            assignment.save(update_fields=["start_date", "end_date", "description", "last_updated_by", "last_updated_date"])
                            if date_changes:
                                for change in date_changes:
                                    event_fragments.append(f"{_role_label(role['key'])} access {change}")
                        else:
                            description = f"{_role_label(role['key'])} access granted to {_user_label(user)}."
                            AccessRoleAssignment.objects.create(
                                user=user,
                                role=role["key"],
                                start_date=start_date,
                                end_date=end_date,
                                description=description,
                                created_by=actor,
                                last_updated_by=actor,
                            )
                            event_fragments.append(f"{_role_label(role['key'])} access granted")
                    elif assignment:
                        description = f"{_role_label(role['key'])} access revoked for {_user_label(user)}."
                        active_assignments.update(
                            end_date=today,
                            description=description,
                            last_updated_by=actor,
                            last_updated_date=timezone.now(),
                        )
                        event_fragments.append(f"{_role_label(role['key'])} access revoked")
                sync_user_access_groups(user)
                if created_user:
                    create_fragments = [item for item in event_fragments if "granted" not in item.lower() and "revoked" not in item.lower() and "access start date" not in item.lower() and "access end date" not in item.lower()]
                    permission_fragments = [item for item in event_fragments if item not in create_fragments]
                    _write_event(user, AccessAuditLog.ACTION_USER_CREATED, actor, create_fragments)
                    _write_permission_events(user, actor, permission_fragments)
                else:
                    profile_fragments = _profile_change_descriptions(before_user, after_user)
                    profile_fragments.extend(profile_window_fragments)
                    status_fragment = _status_change_fragment(before_user, after_user)
                    permission_fragments = [item for item in event_fragments if item not in profile_fragments and item != status_fragment]
                    _write_each_event(user, AccessAuditLog.ACTION_USER_UPDATED, actor, profile_fragments)
                    _write_event(user, _status_action(user.is_active), actor, [status_fragment] if status_fragment else [])
                    _write_permission_events(user, actor, permission_fragments)
                return JsonResponse({"message": "Access saved.", "user": _user_data(user)})

            if action == "save_profile":
                user = User.objects.get(pk=data.get("id"))
                before_user = {
                    "username": user.get_username(),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_active": user.is_active,
                }
                email = (data.get("email") or "").strip().lower()
                if User.objects.exclude(pk=user.pk).filter(username__iexact=email).exists():
                    return JsonResponse({"error": "That email already has access as a username."}, status=400)
                if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
                    return JsonResponse({"error": "That email already has access."}, status=400)
                error = _save_user_identity(user, data)
                if error:
                    return error
                user.save()
                actor = _actor(request)
                profile_window_fragments = _save_profile_window(user, data, actor)
                after_user = {
                    "username": user.get_username(),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_active": user.is_active,
                }
                event_fragments = _field_change_descriptions(before_user, after_user)
                event_fragments.extend(profile_window_fragments)
                profile_fragments = _profile_change_descriptions(before_user, after_user)
                profile_fragments.extend(profile_window_fragments)
                status_fragment = _status_change_fragment(before_user, after_user)
                _write_each_event(user, AccessAuditLog.ACTION_USER_UPDATED, actor, profile_fragments)
                _write_event(user, _status_action(user.is_active), actor, [status_fragment] if status_fragment else [])
                return JsonResponse({"message": "User profile saved.", "user": _user_data(user)})

            if action == "save_permissions":
                user = User.objects.get(pk=data.get("id"))
                actor = _actor(request)
                start_date = _clean_date(data.get("startDate")) or timezone.localdate()
                end_date = _clean_date(data.get("endDate"))
                selected_access = _clean_access(data.get("access"))
                today = timezone.localdate()
                event_fragments = []
                for role in ACCESS_ROLES:
                    active_assignments = AccessRoleAssignment.objects.filter(
                        user=user,
                        role=role["key"],
                    ).filter(Q(end_date__isnull=True) | Q(end_date__gt=today)).order_by("-last_updated_date")
                    assignment = active_assignments.first()
                    if role["key"] in selected_access:
                        if assignment:
                            prior_start = assignment.start_date
                            prior_end = assignment.end_date
                            assignment.start_date = start_date
                            assignment.end_date = end_date
                            assignment.last_updated_by = actor
                            date_changes = []
                            if prior_start != start_date:
                                date_changes.append(f"start date updated from {_describe_value(prior_start)} to {_describe_value(start_date)}")
                            if prior_end != end_date:
                                date_changes.append(f"end date updated from {_describe_value(prior_end)} to {_describe_value(end_date)}")
                            assignment.description = f"{_role_label(role['key'])} access " + ", ".join(date_changes) + "." if date_changes else assignment.description
                            assignment.save(update_fields=["start_date", "end_date", "description", "last_updated_by", "last_updated_date"])
                            for change in date_changes:
                                event_fragments.append(f"{_role_label(role['key'])} access {change}")
                        else:
                            description = f"{_role_label(role['key'])} access granted to {_user_label(user)}."
                            AccessRoleAssignment.objects.create(
                                user=user,
                                role=role["key"],
                                start_date=start_date,
                                end_date=end_date,
                                description=description,
                                created_by=actor,
                                last_updated_by=actor,
                            )
                            event_fragments.append(f"{_role_label(role['key'])} access granted")
                    elif assignment:
                        description = f"{_role_label(role['key'])} access revoked for {_user_label(user)}."
                        active_assignments.update(
                            end_date=today,
                            description=description,
                            last_updated_by=actor,
                            last_updated_date=timezone.now(),
                        )
                        event_fragments.append(f"{_role_label(role['key'])} access revoked")
                sync_user_access_groups(user)
                _write_permission_events(user, actor, event_fragments)
                return JsonResponse({"message": "Permissions saved.", "user": _user_data(user)})

            if action == "revoke_user":
                user = User.objects.get(pk=data.get("id"))
                if user.pk == request.user.pk:
                    return JsonResponse({"error": "You cannot remove your own access."}, status=400)
                actor = _actor(request)
                today = timezone.localdate()
                active_role_keys = user_access_keys(user)
                AccessRoleAssignment.objects.filter(user=user).filter(Q(end_date__isnull=True) | Q(end_date__gt=today)).update(
                    end_date=today,
                    description=f"All active access revoked for {_user_label(user)}.",
                    last_updated_by=actor,
                    last_updated_date=timezone.now(),
                )
                event_fragments = [f"{_role_label(role_key)} access revoked" for role_key in active_role_keys]
                was_active = user.is_active
                user.is_active = False
                user.last_name = user.last_name
                user.save(update_fields=["is_active"])
                sync_user_access_groups(user)
                _write_event(user, AccessAuditLog.ACTION_USER_REVOKED, actor, ["User access was revoked from Access Control."])
                _write_permission_events(user, actor, event_fragments)
                if was_active:
                    _write_event(user, AccessAuditLog.ACTION_USER_DEACTIVATED, actor, ["Status updated from active to inactive."])
                return JsonResponse({"message": "User access revoked."})
    except User.DoesNotExist:
        return JsonResponse({"error": "The selected user no longer exists."}, status=404)

    return JsonResponse({"error": "Unknown access-control action."}, status=400)
