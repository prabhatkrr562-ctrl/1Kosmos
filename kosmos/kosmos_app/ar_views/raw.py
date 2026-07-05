from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import ARDataImport


@require_GET
def ar_raw(request):
    data_import = ARDataImport.objects.first()
    if not data_import:
        return JsonResponse({"has_data": False, "aging": [], "payments": [], "renewals": []})
    return JsonResponse({
        "has_data": True,
        "import_id": data_import.id,
        "as_of_date": data_import.as_of_date.isoformat() if data_import.as_of_date else None,
        "aging": [
            {
                "id": r.id,
                "customer": r.customer,
                "end_user": r.end_user,
                "region": r.region,
                "sales_rep": r.sales_rep,
                "type": r.document_type,
                "date": r.document_date.isoformat() if r.document_date else "",
                "doc": r.document_number,
                "due": r.due_date.isoformat() if r.due_date else "",
                "bal": round(r.open_balance, 2),
            }
            for r in data_import.aging_records.all().order_by("id")
        ],
        "payments": [
            {
                "id": r.id,
                "invoice_number": r.invoice_number,
                "customer": r.customer,
                "end_user": r.end_user,
                "sales_rep": r.sales_rep,
                "region": r.region,
                "payment_type": r.payment_type,
                "date": r.event_date.isoformat() if r.event_date else "",
                "due_date": r.due_date.isoformat() if r.due_date else "",
                "amount": round(r.amount, 2),
            }
            for r in data_import.payment_records.all().order_by("id")
        ],
        "renewals": [
            {
                "id": r.id,
                "end_user": r.end_user,
                "renewal_status": r.renewal_status,
                "status": r.status,
                "amount": round(r.amount, 2),
                "sales_rep": r.sales_rep,
                "region": r.region,
                "remarks": r.remarks,
            }
            for r in data_import.renewal_records.all().order_by("id")
        ],
    })
