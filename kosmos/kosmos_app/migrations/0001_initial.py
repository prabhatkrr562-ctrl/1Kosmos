from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="DataImport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file_name", models.CharField(max_length=255)),
                ("imported_at", models.DateTimeField(auto_now_add=True)),
                ("row_count", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["-imported_at"]},
        ),
        migrations.CreateModel(
            name="BookingRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key_id", models.CharField(blank=True, max_length=100)),
                ("entity", models.CharField(blank=True, max_length=100)),
                ("currency", models.CharField(blank=True, max_length=20)),
                ("contract_id", models.CharField(blank=True, max_length=150)),
                ("contract_name", models.CharField(blank=True, max_length=255)),
                ("sales_person", models.CharField(blank=True, max_length=150)),
                ("mode", models.CharField(blank=True, max_length=100)),
                ("company_size", models.CharField(blank=True, max_length=100)),
                ("industry", models.CharField(blank=True, max_length=150)),
                ("business_unit", models.CharField(blank=True, max_length=100)),
                ("bill_to", models.CharField(blank=True, max_length=255)),
                ("end_user", models.CharField(blank=True, max_length=255)),
                ("product_type", models.CharField(blank=True, max_length=150)),
                ("sub_product_type", models.CharField(blank=True, max_length=150)),
                ("revenue_method", models.CharField(blank=True, max_length=100)),
                ("tcv_usd", models.FloatField(default=0)),
                ("arr_usd", models.FloatField(default=0)),
                ("booking", models.FloatField(default=0)),
                ("booking_status", models.CharField(blank=True, max_length=150)),
                ("order_status", models.CharField(blank=True, max_length=150)),
                ("revenue_type", models.CharField(blank=True, max_length=100)),
                ("term_start", models.DateField(blank=True, null=True)),
                ("term_end", models.DateField(blank=True, null=True)),
                ("line_of_business", models.CharField(blank=True, max_length=150)),
                ("current_arr", models.FloatField(default=0)),
                ("monthly_arr", models.JSONField(blank=True, default=dict)),
                ("data_import", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="records", to="kosmos_app.dataimport")),
            ],
        ),
        migrations.AddIndex(
            model_name="bookingrecord",
            index=models.Index(fields=["data_import", "business_unit"], name="kosmos_app__data_im_77ca7a_idx"),
        ),
        migrations.AddIndex(
            model_name="bookingrecord",
            index=models.Index(fields=["data_import", "industry"], name="kosmos_app__data_im_dd1efc_idx"),
        ),
    ]
