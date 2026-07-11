from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("kosmos_app", "0011_accessroleassignment_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccessAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("user_created", "User Created"), ("user_updated", "User Updated"), ("role_granted", "Role Granted"), ("role_revoked", "Role Revoked")], max_length=40)),
                ("role", models.CharField(blank=True, max_length=40)),
                ("description", models.TextField()),
                ("created_by", models.CharField(blank=True, max_length=150)),
                ("created_date", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="access_audit_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_date"],
            },
        ),
        migrations.AddIndex(
            model_name="accessauditlog",
            index=models.Index(fields=["user", "created_date"], name="kosmos_app_user_id_9cb7cc_idx"),
        ),
        migrations.AddIndex(
            model_name="accessauditlog",
            index=models.Index(fields=["action", "created_date"], name="kosmos_app_action_8a0f89_idx"),
        ),
        migrations.AddIndex(
            model_name="accessauditlog",
            index=models.Index(fields=["role", "created_date"], name="kosmos_app_role_b63072_idx"),
        ),
    ]
