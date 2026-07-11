from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0015_accessauditlog_access_changed_choice"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accessauditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("user_created", "User Created"),
                    ("user_updated", "User Updated"),
                    ("access_changed", "Access Changed"),
                    ("role_granted", "Role Granted"),
                    ("role_revoked", "Role Revoked"),
                    ("user_activated", "User Activated"),
                    ("user_deactivated", "User Deactivated"),
                    ("user_revoked", "User Revoked"),
                ],
                max_length=40,
            ),
        ),
    ]
