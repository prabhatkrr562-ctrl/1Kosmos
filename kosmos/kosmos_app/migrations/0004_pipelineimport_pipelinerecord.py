from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("kosmos_app", "0003_arpaymentrecord_source_of_payment"),
    ]

    operations = [
        migrations.CreateModel(
            name="PipelineImport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file_name", models.CharField(max_length=255)),
                ("imported_at", models.DateTimeField(auto_now_add=True)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("weeks", models.JSONField(blank=True, default=list)),
            ],
            options={"ordering": ["-imported_at"]},
        ),
        migrations.CreateModel(
            name="PipelineRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data_import", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="records", to="kosmos_app.pipelineimport")),
                ("record_id", models.CharField(blank=True, max_length=150)),
                ("deal_name", models.CharField(blank=True, max_length=500)),
                ("company", models.CharField(blank=True, max_length=500)),
                ("stage", models.CharField(blank=True, max_length=150)),
                ("forecast_category", models.CharField(blank=True, max_length=100)),
                ("owner", models.CharField(blank=True, max_length=150)),
                ("team", models.CharField(blank=True, max_length=150)),
                ("amount", models.FloatField(default=0)),
                ("weighted", models.FloatField(default=0)),
                ("term", models.CharField(blank=True, max_length=100)),
                ("order_type", models.CharField(blank=True, max_length=100)),
                ("source", models.CharField(blank=True, max_length=150)),
                ("week", models.CharField(blank=True, max_length=30)),
                ("week_num", models.IntegerField(default=0)),
                ("close_quarter", models.CharField(blank=True, max_length=20)),
                ("region", models.CharField(blank=True, max_length=100)),
                ("sector", models.CharField(blank=True, max_length=150)),
            ],
        ),
        migrations.AddIndex(
            model_name="pipelinerecord",
            index=models.Index(fields=["data_import", "week"], name="kosmos_app__data_im_pip_week_idx"),
        ),
        migrations.AddIndex(
            model_name="pipelinerecord",
            index=models.Index(fields=["data_import", "stage"], name="kosmos_app__data_im_pip_stg_idx"),
        ),
        migrations.AddIndex(
            model_name="pipelinerecord",
            index=models.Index(fields=["data_import", "owner"], name="kosmos_app__data_im_pip_own_idx"),
        ),
    ]
