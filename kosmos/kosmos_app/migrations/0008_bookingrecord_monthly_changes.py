from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0007_pipelinerecord_extra_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookingrecord",
            name="monthly_changes",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
