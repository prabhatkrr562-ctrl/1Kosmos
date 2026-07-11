from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0016_accessauditlog_activation_choices"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AccessUserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("created_by", models.CharField(blank=True, max_length=150)),
                ("created_date", models.DateTimeField(auto_now_add=True)),
                ("last_updated_by", models.CharField(blank=True, max_length=150)),
                ("last_updated_date", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="accessuserprofile",
            index=models.Index(fields=["start_date", "end_date"], name="kosmos_app_start_d_8a0fb5_idx"),
        ),
    ]
