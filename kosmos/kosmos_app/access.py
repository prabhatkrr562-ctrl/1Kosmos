from django.contrib.auth.models import Group
from django.utils import timezone

from .models import AccessRoleAssignment


ACCESS_ROLES = [
    {
        "key": "administrator",
        "label": "Administrator",
        "group": "Administrator",
        "description": "Can manage settings and assign access to other users.",
    },
    {
        "key": "pipeline",
        "label": "Pipeline Dashboard",
        "group": "Pipeline Dashboard",
        "description": "Can open and use the Pipeline Dashboard.",
    },
    {
        "key": "ar",
        "label": "A/R Dashboard",
        "group": "A/R Dashboard",
        "description": "Can open and use the A/R Dashboard.",
    },
    {
        "key": "arr",
        "label": "ARR Dashboard",
        "group": "ARR Dashboard",
        "description": "Can open and use the ARR Dashboard.",
    },
]

ROLE_BY_KEY = {role["key"]: role for role in ACCESS_ROLES}
GROUP_TO_ROLE = {role["group"]: role["key"] for role in ACCESS_ROLES}


def ensure_access_groups():
    return {
        role["key"]: Group.objects.get_or_create(name=role["group"])[0]
        for role in ACCESS_ROLES
    }


def user_access_keys(user):
    if not user or not user.is_authenticated:
        return []
    if user.is_superuser:
        return [role["key"] for role in ACCESS_ROLES]
    today = timezone.localdate()
    active_roles = set(user.access_role_assignments.filter(
        models_q_active(today)
    ).values_list("role", flat=True))
    return [role["key"] for role in ACCESS_ROLES if role["key"] in active_roles]


def has_app_access(user, access_key):
    return user.is_authenticated and (
        user.is_superuser or access_key in user_access_keys(user)
    )


def can_manage_access(user):
    return user.is_authenticated and (
        user.is_superuser or "administrator" in user_access_keys(user)
    )


def models_q_active(today=None):
    from django.db.models import Q

    today = today or timezone.localdate()
    return (Q(start_date__isnull=True) | Q(start_date__lte=today)) & (
        Q(end_date__isnull=True) | Q(end_date__gt=today)
    )


def sync_user_access_groups(user):
    role_groups = ensure_access_groups()
    current_app_groups = set(role_groups.values())
    active_keys = user_access_keys(user)
    selected_groups = [role_groups[key] for key in active_keys if key in role_groups]
    keep_existing = [group for group in user.groups.all() if group not in current_app_groups]
    user.groups.set(keep_existing + selected_groups)


def backfill_group_assignments(user, actor="system"):
    today = timezone.localdate()
    group_names = set(user.groups.values_list("name", flat=True))
    for role in ACCESS_ROLES:
        if role["group"] not in group_names:
            continue
        if AccessRoleAssignment.objects.filter(user=user, role=role["key"], end_date__isnull=True).exists():
            continue
        AccessRoleAssignment.objects.create(
            user=user,
            role=role["key"],
            start_date=today,
            created_by=actor,
            last_updated_by=actor,
        )
