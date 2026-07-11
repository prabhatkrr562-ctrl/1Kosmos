from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0013_rename_kosmos_app_user_id_9cb7cc_idx_kosmos_app__user_id_bb182e_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accessroleassignment",
            name="role",
            field=models.CharField(
                choices=[
                    ("administrator", "Administrator"),
                    ("developer", "Developer"),
                    ("pipeline", "Pipeline Dashboard"),
                    ("ar", "A/R Dashboard"),
                    ("arr", "ARR Dashboard"),
                ],
                max_length=40,
            ),
        ),
    ]
