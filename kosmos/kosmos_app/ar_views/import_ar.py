from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..ar_excel import ARWorkbookError, parse_ar_single_sheet, parse_ar_workbook
from ..models import ARAgingRecord, ARDataImport, ARPaymentRecord, ARRenewalRecord


@csrf_exempt
@require_POST
def import_ar(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "Choose an AR Dashboard .xlsx file."}, status=400)
    if not uploaded_file.name.lower().endswith(".xlsx"):
        return JsonResponse({"error": "Only .xlsx files are supported."}, status=400)

    mode = request.POST.get("mode", "replace")
    table = request.POST.get("table", "").strip()

    if mode == "insert":
        existing = ARDataImport.objects.first()
        if existing is None:
            return JsonResponse(
                {"error": "No existing AR import found. Please use Replace mode to create the first import."},
                status=400,
            )
        if table not in ("aging", "payments", "renewals"):
            return JsonResponse(
                {"error": "Invalid table. Must be 'aging', 'payments', or 'renewals'."},
                status=400,
            )
        try:
            rows = parse_ar_single_sheet(uploaded_file, table)
        except ARWorkbookError as exc:
            return JsonResponse({"error": str(exc)}, status=400)

        if not rows:
            return JsonResponse({"error": "No data rows found in the uploaded sheet."}, status=400)

        with transaction.atomic():
            if table == "aging":
                ARAgingRecord.objects.bulk_create(
                    [ARAgingRecord(data_import=existing, **row) for row in rows],
                    batch_size=250,
                )
                existing.aging_count += len(rows)
                existing.save(update_fields=["aging_count"])
                label = "aging"
            elif table == "payments":
                ARPaymentRecord.objects.bulk_create(
                    [ARPaymentRecord(data_import=existing, **row) for row in rows],
                    batch_size=250,
                )
                existing.payment_count += len(rows)
                existing.save(update_fields=["payment_count"])
                label = "payment"
            else:
                ARRenewalRecord.objects.bulk_create(
                    [ARRenewalRecord(data_import=existing, **row) for row in rows],
                    batch_size=250,
                )
                existing.renewal_count += len(rows)
                existing.save(update_fields=["renewal_count"])
                label = "renewal"

        return JsonResponse({
            "message": f"{len(rows)} {label} records inserted into the existing AR import.",
            "import_id": existing.id,
        }, status=201)

    try:
        parsed = parse_ar_workbook(uploaded_file)
    except ARWorkbookError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    with transaction.atomic():
        ARDataImport.objects.all().delete()
        data_import = ARDataImport.objects.create(
            file_name=uploaded_file.name,
            as_of_date=parsed["as_of_date"],
            aging_count=len(parsed["aging"]),
            payment_count=len(parsed["payments"]),
            renewal_count=len(parsed["renewals"]),
        )
        ARAgingRecord.objects.bulk_create(
            [ARAgingRecord(data_import=data_import, **row) for row in parsed["aging"]],
            batch_size=250,
        )
        ARPaymentRecord.objects.bulk_create(
            [ARPaymentRecord(data_import=data_import, **row) for row in parsed["payments"]],
            batch_size=250,
        )
        ARRenewalRecord.objects.bulk_create(
            [ARRenewalRecord(data_import=data_import, **row) for row in parsed["renewals"]],
            batch_size=250,
        )

    return JsonResponse({
        "message": (
            f"Imported {len(parsed['aging'])} aging, "
            f"{len(parsed['payments'])} payment, and "
            f"{len(parsed['renewals'])} pending-invoice records."
        ),
        "import_id": data_import.id,
    }, status=201)
