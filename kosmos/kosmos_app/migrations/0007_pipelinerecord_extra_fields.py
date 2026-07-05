from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kosmos_app', '0006_rename_kosmos_app__data_im_pip_week_idx_kosmos_app__data_im_4478db_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='pipelinerecord',
            name='create_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='pipelinerecord',
            name='last_activity_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='pipelinerecord',
            name='next_step',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='pipelinerecord',
            name='partner_owner',
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
