from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0018_rename_kosmos_app_start_d_8a0fb5_idx_kosmos_app__start_d_4fb941_idx"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accessroleassignment",
            name="role",
            field=models.CharField(
                choices=[
                    ("administrator", "Administrator"),
                    ("developer", "Developer"),
                    ("data_manager", "Data Manager"),
                    ("pipeline", "Pipeline Dashboard"),
                    ("ar", "A/R Dashboard"),
                    ("arr", "ARR Dashboard"),
                ],
                max_length=40,
            ),
        ),
    ]
