from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import PipelineImport, PipelineRecord
from ..pipeline_excel import PipelineWorkbookError, parse_pipeline_workbook
from .shared import _week_sort_key


@csrf_exempt
@require_POST
def import_pipeline(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "Choose a Pipeline .xlsx file."}, status=400)
    if not uploaded_file.name.lower().endswith(".xlsx"):
        return JsonResponse({"error": "Only .xlsx files are supported."}, status=400)
    try:
        rows = parse_pipeline_workbook(uploaded_file)
    except PipelineWorkbookError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    mode = request.POST.get("mode", "replace")
    new_weeks = sorted({row["week"] for row in rows}, key=_week_sort_key)

    if mode == "insert":
        existing = PipelineImport.objects.first()
        if existing is None:
            return JsonResponse(
                {"error": "No existing pipeline import found. Please use Replace mode to create the first import."},
                status=400,
            )
        with transaction.atomic():
            PipelineRecord.objects.bulk_create(
                [PipelineRecord(data_import=existing, **row) for row in rows],
                batch_size=500,
            )
            existing.row_count += len(rows)
            existing.weeks = sorted(set(existing.weeks or []) | set(new_weeks), key=_week_sort_key)
            existing.save(update_fields=["row_count", "weeks"])
        return JsonResponse({
            "message": f"{len(rows)} pipeline records inserted into existing import across {len(new_weeks)} week(s).",
            "import_id": existing.id,
            "row_count": len(rows),
            "weeks": new_weeks,
        }, status=201)

    with transaction.atomic():
        PipelineImport.objects.all().delete()
        data_import = PipelineImport.objects.create(
            file_name=uploaded_file.name,
            row_count=len(rows),
            weeks=new_weeks,
        )
        PipelineRecord.objects.bulk_create(
            [PipelineRecord(data_import=data_import, **row) for row in rows],
            batch_size=500,
        )

    return JsonResponse({
        "message": f"Imported {len(rows)} pipeline records across {len(new_weeks)} weeks.",
        "import_id": data_import.id,
        "row_count": len(rows),
        "weeks": new_weeks,
    }, status=201)
