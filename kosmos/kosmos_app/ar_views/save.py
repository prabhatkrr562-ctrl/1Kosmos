import json
from datetime import datetime

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import ARAgingRecord, ARDataImport, ARPaymentRecord, ARRenewalRecord
from ..views_shared import _money


@csrf_exempt
@require_POST
def ar_save(request):
    data_import = ARDataImport.objects.first()
    if not data_import:
        return JsonResponse({"error": "No AR import found."}, status=400)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    aging_data = body.get("aging", [])
    payments_data = body.get("payments", [])
    renewals_data = body.get("renewals", [])
    delete_data = body.get("delete", {})

    try:
        with transaction.atomic():
            aging_deleted = ARAgingRecord.objects.filter(
                id__in=delete_data.get("aging", []),
                data_import=data_import,
            ).delete()[0]
            payments_deleted = ARPaymentRecord.objects.filter(
                id__in=delete_data.get("payments", []),
                data_import=data_import,
            ).delete()[0]
            renewals_deleted = ARRenewalRecord.objects.filter(
                id__in=delete_data.get("renewals", []),
                data_import=data_import,
            ).delete()[0]

            aging_updated = 0
            aging_created = 0
            for row in aging_data:
                record_id = row.get("id")
                if record_id:
                    ARAgingRecord.objects.filter(id=record_id, data_import=data_import).update(
                        customer=row.get("customer", ""),
                        end_user=row.get("end_user", ""),
                        region=row.get("region", ""),
                        sales_rep=row.get("sales_rep", ""),
                        document_type=row.get("type", ""),
                        document_date=_parse_date(row.get("date")),
                        document_number=row.get("doc", ""),
                        due_date=_parse_date(row.get("due")),
                        open_balance=_money(row.get("bal")),
                        last_update_by=row.get("last_update_by", "Live Editor"),
                        last_update_date=datetime.now().date(),
                    )
                    aging_updated += 1
                else:
                    ARAgingRecord.objects.create(
                        data_import=data_import,
                        customer=row.get("customer", ""),
                        end_user=row.get("end_user", ""),
                        region=row.get("region", ""),
                        sales_rep=row.get("sales_rep", ""),
                        document_type=row.get("type", ""),
                        document_date=_parse_date(row.get("date")),
                        document_number=row.get("doc", ""),
                        due_date=_parse_date(row.get("due")),
                        open_balance=_money(row.get("bal")),
                        created_by="Live Editor",
                        create_date=datetime.now().date(),
                    )
                    aging_created += 1

            payments_updated = 0
            payments_created = 0
            for row in payments_data:
                record_id = row.get("id")
                if record_id:
                    ARPaymentRecord.objects.filter(id=record_id, data_import=data_import).update(
                        invoice_number=row.get("invoice_number", ""),
                        customer=row.get("customer", ""),
                        end_user=row.get("end_user", ""),
                        sales_rep=row.get("sales_rep", ""),
                        region=row.get("region", ""),
                        payment_type=row.get("payment_type", ""),
                        event_date=_parse_date(row.get("date")),
                        due_date=_parse_date(row.get("due_date")),
                        amount=_money(row.get("amount")),
                        last_update_by=row.get("last_update_by", "Live Editor"),
                        last_update_date=datetime.now().date(),
                    )
                    payments_updated += 1
                else:
                    ARPaymentRecord.objects.create(
                        data_import=data_import,
                        invoice_number=row.get("invoice_number", ""),
                        customer=row.get("customer", ""),
                        end_user=row.get("end_user", ""),
                        sales_rep=row.get("sales_rep", ""),
                        region=row.get("region", ""),
                        payment_type=row.get("payment_type", ""),
                        event_date=_parse_date(row.get("date")),
                        due_date=_parse_date(row.get("due_date")),
                        amount=_money(row.get("amount")),
                        created_by="Live Editor",
                        create_date=datetime.now().date(),
                    )
                    payments_created += 1

            renewals_updated = 0
            renewals_created = 0
            for row in renewals_data:
                record_id = row.get("id")
                if record_id:
                    ARRenewalRecord.objects.filter(id=record_id, data_import=data_import).update(
                        end_user=row.get("end_user", ""),
                        renewal_status=row.get("renewal_status", ""),
                        status=row.get("status", ""),
                        amount=_money(row.get("amount")),
                        sales_rep=row.get("sales_rep", ""),
                        region=row.get("region", ""),
                        remarks=row.get("remarks", ""),
                        last_update_by=row.get("last_update_by", "Live Editor"),
                        last_update_date=datetime.now().date(),
                    )
                    renewals_updated += 1
                else:
                    ARRenewalRecord.objects.create(
                        data_import=data_import,
                        end_user=row.get("end_user", ""),
                        renewal_status=row.get("renewal_status", ""),
                        status=row.get("status", ""),
                        amount=_money(row.get("amount")),
                        sales_rep=row.get("sales_rep", ""),
                        region=row.get("region", ""),
                        remarks=row.get("remarks", ""),
                        created_by="Live Editor",
                        create_date=datetime.now().date(),
                    )
                    renewals_created += 1

            data_import.aging_count = data_import.aging_records.count()
            data_import.payment_count = data_import.payment_records.count()
            data_import.renewal_count = data_import.renewal_records.count()
            data_import.save(update_fields=["aging_count", "payment_count", "renewal_count"])

        return JsonResponse({
            "success": True,
            "aging": {"updated": aging_updated, "created": aging_created, "deleted": aging_deleted},
            "payments": {"updated": payments_updated, "created": payments_created, "deleted": payments_deleted},
            "renewals": {"updated": renewals_updated, "created": renewals_created, "deleted": renewals_deleted},
        })
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None
