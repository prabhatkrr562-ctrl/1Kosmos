from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("kosmos_app", "0002_ardataimport_arrenewalrecord_aragingrecord_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="arpaymentrecord",
            name="source_of_payment",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
