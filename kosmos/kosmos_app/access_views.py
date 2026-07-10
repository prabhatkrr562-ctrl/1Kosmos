import json
from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .access import ACCESS_ROLES, can_manage_access, sync_user_access_groups, user_access_keys
from .models import AccessRoleAssignment


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


def _actor(request):
    return request.user.get_username() or request.user.email or "system"


def _log_data(item):
    user = item.user
    role = next((role for role in ACCESS_ROLES if role["key"] == item.role), None)
    today = timezone.localdate()
    active = (not item.start_date or item.start_date <= today) and (not item.end_date or item.end_date > today)
    return {
        "id": item.pk,
        "user": user.get_full_name() or user.get_username(),
        "username": user.get_username(),
        "email": user.email,
        "role": item.role,
        "roleLabel": role["label"] if role else item.role,
        "status": "Active" if active else "Revoked",
        "startDate": item.start_date.isoformat() if item.start_date else "",
        "endDate": item.end_date.isoformat() if item.end_date else "",
        "createdBy": item.created_by,
        "createdDate": item.created_date.isoformat() if item.created_date else "",
        "lastUpdatedBy": item.last_updated_by,
        "lastUpdatedDate": item.last_updated_date.isoformat() if item.last_updated_date else "",
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def access_control(request):
    denied = _forbidden(request)
    if denied:
        return denied

    User = get_user_model()
    if request.method == "GET":
        users = User.objects.prefetch_related("groups", "access_role_assignments").order_by("username")
        logs = AccessRoleAssignment.objects.select_related("user").order_by("-last_updated_date")[:200]
        return JsonResponse({
            "roles": ACCESS_ROLES,
            "users": [_user_data(item) for item in users],
            "logs": [_log_data(item) for item in logs],
        })

    data = _payload(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    action = data.get("action")

    try:
        with transaction.atomic():
            if action == "save_user":
                user_id = data.get("id")
                username = (data.get("username") or "").strip().lower()
                email = (data.get("email") or "").strip().lower()
                start_date = _clean_date(data.get("startDate")) or timezone.localdate()
                end_date = _clean_date(data.get("endDate"))
                if not username and not email:
                    return JsonResponse({"error": "Enter a username or email address."}, status=400)

                lookup = username or email
                user = User.objects.get(pk=user_id) if user_id else User(username=lookup[:150])
                if User.objects.exclude(pk=user.pk).filter(username__iexact=lookup).exists():
                    return JsonResponse({"error": "That username already has access."}, status=400)
                if email and User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
                    return JsonResponse({"error": "That email already has access."}, status=400)

                user.username = lookup[:150]
                user.email = email[:254]
                user.first_name = (data.get("firstName") or "").strip()[:150]
                user.last_name = (data.get("lastName") or "").strip()[:150]
                user.is_active = bool(data.get("isActive", True))
                user.is_staff = bool(data.get("isStaff", False)) or "administrator" in _clean_access(data.get("access"))
                if not user_id and not user.has_usable_password():
                    user.set_unusable_password()
                user.save()

                selected_access = _clean_access(data.get("access"))
                actor = _actor(request)
                today = timezone.localdate()
                for role in ACCESS_ROLES:
                    active_assignments = AccessRoleAssignment.objects.filter(
                        user=user,
                        role=role["key"],
                    ).filter(Q(end_date__isnull=True) | Q(end_date__gt=today)).order_by("-last_updated_date")
                    assignment = active_assignments.first()
                    if role["key"] in selected_access:
                        if assignment:
                            assignment.start_date = start_date
                            assignment.end_date = end_date
                            assignment.last_updated_by = actor
                            assignment.save(update_fields=["start_date", "end_date", "last_updated_by", "last_updated_date"])
                        else:
                            AccessRoleAssignment.objects.create(
                                user=user,
                                role=role["key"],
                                start_date=start_date,
                                end_date=end_date,
                                created_by=actor,
                                last_updated_by=actor,
                            )
                    elif assignment:
                        active_assignments.update(
                            end_date=today,
                            last_updated_by=actor,
                            last_updated_date=timezone.now(),
                        )
                sync_user_access_groups(user)
                return JsonResponse({"message": "Access saved.", "user": _user_data(user)})

            if action == "revoke_user":
                user = User.objects.get(pk=data.get("id"))
                if user.pk == request.user.pk:
                    return JsonResponse({"error": "You cannot remove your own access."}, status=400)
                actor = _actor(request)
                today = timezone.localdate()
                AccessRoleAssignment.objects.filter(user=user, end_date__isnull=True).update(
                    end_date=today,
                    last_updated_by=actor,
                    last_updated_date=timezone.now(),
                )
                user.is_active = False
                user.last_name = user.last_name
                user.save(update_fields=["is_active"])
                sync_user_access_groups(user)
                return JsonResponse({"message": "User access revoked."})
    except User.DoesNotExist:
        return JsonResponse({"error": "The selected user no longer exists."}, status=404)

    return JsonResponse({"error": "Unknown access-control action."}, status=400)
