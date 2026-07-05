from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("kosmos_app", "0004_pipelineimport_pipelinerecord"),
    ]

    operations = [
        migrations.AddField(model_name="bookingrecord", name="attribute1",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute2",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute3",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute4",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute5",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute6",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute7",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute8",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute9",  field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute10", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute11", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute12", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute13", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute14", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="attribute15", field=models.CharField(blank=True, max_length=255, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="created_by",      field=models.CharField(blank=True, max_length=150, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="creation_date",   field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="bookingrecord", name="last_update_by",  field=models.CharField(blank=True, max_length=150, default=""), preserve_default=False),
        migrations.AddField(model_name="bookingrecord", name="last_update_date",field=models.DateField(blank=True, null=True)),
    ]
