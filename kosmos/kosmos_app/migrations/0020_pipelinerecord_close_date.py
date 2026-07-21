from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kosmos_app", "0019_accessroleassignment_data_manager_choice"),
    ]

    operations = [
        migrations.AddField(
            model_name="pipelinerecord",
            name="close_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
