from .models import DataImport


def _money(value):
    return round(float(value or 0), 2)


def _latest_import():
    return DataImport.objects.first()
