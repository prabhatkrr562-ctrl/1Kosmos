from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


ACCESS_GROUPS = {
    "Administrator": "administrator",
    "Pipeline Dashboard": "pipeline",
    "A/R Dashboard": "ar",
    "ARR Dashboard": "arr",
}


def copy_existing_groups_to_assignments(apps, schema_editor):
    User = apps.get_model(settings.AUTH_USER_MODEL.split(".")[0], settings.AUTH_USER_MODEL.split(".")[1])
    Group = apps.get_model("auth", "Group")
    AccessRoleAssignment = apps.get_model("kosmos_app", "AccessRoleAssignment")
    today = __import__("datetime").date.today()
    for group_name, role_key in ACCESS_GROUPS.items():
        try:
            group = Group.objects.get(name=group_name)
        except Group.DoesNotExist:
            continue
        for user in User.objects.filter(groups=group):
            if AccessRoleAssignment.objects.filter(user=user, role=role_key, end_date__isnull=True).exists():
                continue
            AccessRoleAssignment.objects.create(
                user=user,
                role=role_key,
                start_date=today,
                created_by="migration",
                last_updated_by="migration",
            )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("kosmos_app", "0008_bookingrecord_monthly_changes"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccessRoleAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("administrator", "Administrator"), ("pipeline", "Pipeline Dashboard"), ("ar", "A/R Dashboard"), ("arr", "ARR Dashboard")], max_length=40)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("created_by", models.CharField(blank=True, max_length=150)),
                ("created_date", models.DateTimeField(auto_now_add=True)),
                ("last_updated_by", models.CharField(blank=True, max_length=150)),
                ("last_updated_date", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="access_role_assignments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-last_updated_date", "user__username", "role"],
            },
        ),
        migrations.AddIndex(
            model_name="accessroleassignment",
            index=models.Index(fields=["user", "role", "end_date"], name="kosmos_app_user_id_18b3ee_idx"),
        ),
        migrations.AddIndex(
            model_name="accessroleassignment",
            index=models.Index(fields=["role", "start_date", "end_date"], name="kosmos_app_role_66c93b_idx"),
        ),
        migrations.RunPython(copy_existing_groups_to_assignments, migrations.RunPython.noop),
    ]
