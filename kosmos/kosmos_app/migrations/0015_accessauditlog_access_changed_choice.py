from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0014_accessroleassignment_developer_choice"),
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
                ],
                max_length=40,
            ),
        ),
    ]
