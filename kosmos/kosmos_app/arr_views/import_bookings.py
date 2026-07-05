from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..excel import BookingWorkbookError, parse_booking_csv, parse_booking_workbook
from ..models import BookingRecord, DataImport
from ..views_shared import _latest_import


@csrf_exempt
@require_POST
def import_bookings(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "Choose a file to upload."}, status=400)

    name_lower = uploaded_file.name.lower()
    if name_lower.endswith(".csv"):
        parser = parse_booking_csv
    elif name_lower.endswith((".xlsx", ".xls")):
        parser = parse_booking_workbook
    else:
        return JsonResponse(
            {"error": "Unsupported file format. Please upload a .xlsx or .csv file."},
            status=400,
        )

    try:
        rows = parser(uploaded_file)
    except BookingWorkbookError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    mode = request.POST.get("mode", "replace")

    with transaction.atomic():
        if mode == "insert":
            data_import = _latest_import()
            if data_import is None:
                data_import = DataImport.objects.create(
                    file_name=uploaded_file.name, row_count=len(rows)
                )
            else:
                data_import.row_count += len(rows)
                data_import.save(update_fields=["row_count"])
        else:
            DataImport.objects.all().delete()
            data_import = DataImport.objects.create(
                file_name=uploaded_file.name, row_count=len(rows)
            )

        BookingRecord.objects.bulk_create(
            [BookingRecord(data_import=data_import, **row) for row in rows],
            batch_size=250,
        )

    action = "inserted into existing data" if mode == "insert" else "imported (replaced existing data)"
    return JsonResponse(
        {
            "message": f"{len(rows)} booking records {action}.",
            "import_id": data_import.id,
            "row_count": len(rows),
        },
        status=201,
    )
