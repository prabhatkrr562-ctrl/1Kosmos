from collections import defaultdict
import re

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..views_shared import _money, _latest_import
from .shared import (
    _build_waterfall,
    _build_customer_360,
    _record_parts,
    _movement_parts,
)


def _arr_at(record, month):
    return float((record.monthly_arr or {}).get(month) or 0)


def _customer_name(record):
    return record.end_user or record.bill_to or "Unspecified"


def _previous_month(month):
    year, number = map(int, month.split("-"))
    if number == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{number - 1:02d}"


def _period_range(period, latest_month, custom_from="", custom_to=""):
    if not latest_month:
        return "", ""
    year, month = map(int, latest_month.split("-"))
    if period == "custom":
        valid = re.compile(r"^\d{4}-\d{2}$")
        start = custom_from if valid.match(custom_from or "") else latest_month
        end = custom_to if valid.match(custom_to or "") else latest_month
        return start, min(end, latest_month)
    if period == "qtd":
        quarter_start = ((month - 1) // 3) * 3 + 1
        return f"{year:04d}-{quarter_start:02d}", latest_month
    if period == "ltm":
        start_month = month + 1
        start_year = year - 1
        if start_month > 12:
            start_month -= 12
            start_year += 1
        return f"{start_year:04d}-{start_month:02d}", latest_month
    return f"{year:04d}-01", latest_month


def _compute_period_metrics(records, months, start_month, latest_month):
    opening_month = _previous_month(start_month) if start_month else ""
    opening = sum(_arr_at(record, opening_month) for record in records)
    closing = sum(_arr_at(record, latest_month) for record in records)
    # The reference dashboard nets each month/type across filtered deals before
    # calculating headline movement KPIs. This preserves offsetting corrections.
    movements = defaultdict(float)
    for record in records:
        for month in months:
            for label, raw_amount in ((record.monthly_changes or {}).get(month) or {}).items():
                amount = float(raw_amount or 0)
                key = str(label or "").strip().lower()
                movements[(month, key)] += amount

    new_arr = upsell = renewal = churn = downsell = 0.0
    for month in months:
        new_arr += max(0.0, movements[(month, "new")])
        upsell += max(0.0, movements[(month, "upsell")])
        renewal += movements[(month, "renewal")]
        churn_amount = movements[(month, "churn")]
        if churn_amount < 0:
            churn += abs(churn_amount)
        downsell += abs(movements[(month, "downsell")])
    grr = ((opening - churn - downsell) / opening * 100) if opening else 0.0
    nrr = ((opening - churn - downsell + upsell) / opening * 100) if opening else 0.0
    return {
        "opening_arr": round(opening, 2),
        "new_arr": round(new_arr, 2),
        "upsell": round(upsell, 2),
        "renewal": round(renewal, 2),
        "churn": round(churn, 2),
        "downsell": round(downsell, 2),
        "ltm_change": round(closing - opening, 2),
        "growth_pct": round(((closing - opening) / opening * 100) if opening else 0.0, 1),
        "grr": round(grr, 1),
        "nrr": round(nrr, 1),
    }


def _build_rep_leaderboard(records, latest_month, months):
    reps = defaultdict(lambda: {
        "rep": "", "arr": 0.0, "new_arr": 0.0, "upsell": 0.0,
        "churn": 0.0, "downsell": 0.0, "customers": set(),
    })
    period = months
    has_explicit_changes = any(record.monthly_changes for record in records)
    for record in records:
        rep = record.sales_person or "Unassigned"
        row = reps[rep]
        row["rep"] = rep
        row["arr"] += _arr_at(record, latest_month)
        if _arr_at(record, latest_month) > 0:
            row["customers"].add(_customer_name(record))
        for month in period:
            parts = _movement_parts(record, month) if has_explicit_changes else _record_parts(record, month)
            row["new_arr"] += parts["new"]
            row["upsell"] += parts["upsell"]
            row["churn"] += parts["churn"]
            row["downsell"] += parts["downsell"]
    return [
        {
            **{k: round(v, 2) for k, v in row.items() if k not in ("rep", "customers")},
            "rep": row["rep"],
            "customers": len(row["customers"]),
        }
        for row in sorted(reps.values(), key=lambda item: item["arr"], reverse=True)
    ]


def _build_cohort_retention(records, months):
    starts = defaultdict(lambda: defaultdict(float))
    for record in records:
        monthly = record.monthly_arr or {}
        first_month = next((m for m in sorted(monthly) if float(monthly.get(m) or 0) > 0), "")
        if not first_month:
            continue
        year = first_month[:4]
        for month, amount in monthly.items():
            starts[year][month] += float(amount or 0)
    result = []
    for year, values in sorted(starts.items()):
        first_value = next((values[m] for m in sorted(values) if values[m] > 0), 0)
        if not first_value:
            continue
        result.append({
            "cohort": year,
            "start_arr": round(first_value, 2),
            "m12": round((values.get(f"{int(year)+1}-01", 0) / first_value) * 100, 1) if first_value else 0,
            "m24": round((values.get(f"{int(year)+2}-01", 0) / first_value) * 100, 1) if first_value else 0,
            "latest": round((values.get(months[-1], 0) / first_value) * 100, 1) if months else 0,
        })
    return result


def _build_health_heatmap(customer_360, months):
    last_months = months[-12:]
    return [
        {
            "customer": customer["customer"],
            "months": [
                {
                    "month": month,
                    "value": next((point["value"] for point in customer.get("trend", []) if point["month"] == month), 0),
                }
                for month in last_months
            ],
        }
        for customer in customer_360[:40]
    ]


def _build_new_logos(records, months):
    period = set(months)
    has_explicit_changes = any(record.monthly_changes for record in records)
    first_seen = {}
    amounts = defaultdict(float)
    for record in records:
        customer = _customer_name(record)
        for month, value in (record.monthly_arr or {}).items():
            if float(value or 0) > 0 and (customer not in first_seen or month < first_seen[customer]):
                first_seen[customer] = month
            parts = _movement_parts(record, month) if has_explicit_changes else _record_parts(record, month)
            if parts["new"]:
                amounts[(customer, month)] += parts["new"]
    rows = []
    for (customer, month), amount in amounts.items():
        if month in period and first_seen.get(customer) == month:
            rows.append({"customer": customer, "month": month, "arr": round(amount, 2)})
    return sorted(rows, key=lambda item: item["arr"], reverse=True)


def _build_concentration(customer_360):
    values = sorted([float(c["arr"] or 0) for c in customer_360 if float(c["arr"] or 0) > 0], reverse=True)
    total = sum(values)
    return [
        {"label": f"Top {n}", "value": round((sum(values[:n]) / total * 100) if total else 0, 1)}
        for n in (1, 3, 5, 10)
    ]


@require_GET
def dashboard(request):
    data_import = _latest_import()
    if not data_import:
        return JsonResponse(
            {
                "has_data": False,
                "message": "Upload Booking Database.xlsx to populate the dashboard.",
                "filters": {},
                "kpis": {},
                "trend": [],
                "breakdowns": {},
                "records": [],
            }
        )

    base_records = data_import.records.all()
    filter_map = {
        "business_unit": "business_unit",
        "industry": "industry",
        "sales_person": "sales_person",
        "product_type": "product_type",
        "sub_product_type": "sub_product_type",
        "company_size": "company_size",
        "line_of_business": "line_of_business",
    }
    global_month_totals = defaultdict(float)
    base_record_list = list(base_records)
    for record in base_record_list:
        for month, amount in (record.monthly_arr or {}).items():
            global_month_totals[month] += float(amount or 0)
    available_months = sorted(month for month, amount in global_month_totals.items() if amount)
    global_latest_month = available_months[-1] if available_months else ""
    active_records = [
        record for record in base_record_list
        if _arr_at(record, global_latest_month) > 0
    ]
    filters = {
        query_name: sorted({
            getattr(record, field_name)
            for record in active_records
            if getattr(record, field_name)
        })
        for query_name, field_name in filter_map.items()
    }
    period = request.GET.get("period", "ytd").strip().lower()
    if period not in {"ytd", "qtd", "ltm", "custom"}:
        period = "ytd"
    period_from, period_to = _period_range(
        period,
        global_latest_month,
        request.GET.get("from", "").strip(),
        request.GET.get("to", "").strip(),
    )
    period_months = [
        month for month in available_months
        if (not period_from or month >= period_from) and (not period_to or month <= period_to)
    ]

    records = base_records
    for query_name, field_name in filter_map.items():
        value = request.GET.get(query_name, "").strip()
        if value:
            records = records.filter(**{field_name: value})

    records = list(records)
    trend_totals = defaultdict(float)
    for item in records:
        for month, amount in item.monthly_arr.items():
            trend_totals[month] += float(amount or 0)
    sorted_months = period_months
    latest_month = period_to or (sorted_months[-1] if sorted_months else "")

    total_arr = sum(_arr_at(item, latest_month) for item in records)
    total_booking = sum(item.booking for item in records)
    active_records = [item for item in records if _arr_at(item, latest_month) > 0]
    recurring_records = [
        item for item in active_records if item.revenue_type.lower() == "recurring"
    ]
    customers = {
        item.end_user or item.bill_to
        for item in active_records
        if item.end_user or item.bill_to
    }

    def breakdown(field, value_field="current_arr", limit=8):
        totals = defaultdict(float)
        for item in records:
            label = getattr(item, field) or "Unspecified"
            if value_field == "current_arr":
                totals[label] += _arr_at(item, latest_month)
            else:
                totals[label] += float(getattr(item, value_field) or 0)
        return [
            {"label": label, "value": _money(value)}
            for label, value in sorted(
                totals.items(), key=lambda pair: pair[1], reverse=True
            )[:limit]
        ]

    customer_arr = defaultdict(list)
    for item in records:
        if item.revenue_type.lower() != "recurring":
            continue
        customer = item.end_user or item.bill_to or "Unspecified"
        customer_arr[customer].append(_arr_at(item, latest_month))
    average_arr_by_customer = [
        {
            "label": customer,
            "value": _money(sum(amounts) / len(amounts)),
            "contract_count": len(amounts),
        }
        for customer, amounts in sorted(
            customer_arr.items(),
            key=lambda pair: sum(pair[1]) / len(pair[1]),
            reverse=True,
        )[:10]
    ]

    ltm = _compute_period_metrics(records, sorted_months, period_from, latest_month)
    waterfall = _build_waterfall(records, sorted_months)
    customer_360 = _build_customer_360(records, sorted_months)
    at_risk = [c for c in customer_360 if c['ltm_change'] < 0]
    top_gainers = sorted(
        [c for c in customer_360 if c['ltm_change'] > 0],
        key=lambda x: x['ltm_change'],
        reverse=True,
    )[:10]

    return JsonResponse(
        {
            "has_data": True,
            "import": {
                "file_name": data_import.file_name,
                "imported_at": data_import.imported_at.isoformat(),
                "row_count": data_import.row_count,
            },
            "filters": filters,
            "period": {
                "value": period,
                "from": period_from,
                "to": period_to,
                "latest_month": global_latest_month,
                "months": available_months,
            },
            "kpis": {
                "total_arr": _money(total_arr),
                "total_booking": _money(total_booking),
                "customers": len(customers),
                "recurring_contracts": len(recurring_records),
                "average_arr": _money(total_arr / len(recurring_records))
                if recurring_records
                else 0,
                "ltm_change": ltm['ltm_change'],
                "ltm_new_arr": ltm['new_arr'],
                "ltm_upsell": ltm['upsell'],
                "ltm_renewal": ltm['renewal'],
                "ltm_churn": ltm['churn'],
                "ltm_downsell": ltm['downsell'],
                "ltm_opening_arr": ltm['opening_arr'],
                "grr": ltm['grr'],
                "nrr": ltm['nrr'],
                "growth_pct": ltm['growth_pct'],
            },
            "trend": [
                {"month": month, "value": _money(trend_totals.get(month, 0))}
                for month in sorted_months
            ],
            "waterfall": waterfall,
            "breakdowns": {
                "business_units": breakdown("business_unit"),
                "industries": breakdown("industry"),
                "customers": breakdown("end_user", limit=15),
                "average_arr_by_customer": average_arr_by_customer,
                "products": breakdown("sub_product_type"),
                "line_of_business": breakdown("line_of_business"),
            },
            "customer_360": customer_360[:150],
            "at_risk": at_risk,
            "top_gainers": top_gainers,
            "rep_leaderboard": _build_rep_leaderboard(records, latest_month, sorted_months),
            "cohort_retention": _build_cohort_retention(records, sorted_months),
            "health_heatmap": _build_health_heatmap(customer_360, sorted_months),
            "new_logos": _build_new_logos(records, sorted_months),
            "concentration": _build_concentration(customer_360),
            "records": [
                {
                    "key_id": item.key_id,
                    "entity": item.entity,
                    "currency": item.currency,
                    "contract_id": item.contract_id,
                    "contract_name": item.contract_name,
                    "sales_person": item.sales_person,
                    "mode": item.mode,
                    "company_size": item.company_size,
                    "industry": item.industry,
                    "business_unit": item.business_unit,
                    "bill_to": item.bill_to,
                    "end_user": item.end_user,
                    "product_type": item.product_type,
                    "sub_product_type": item.sub_product_type,
                    "revenue_method": item.revenue_method,
                    "tcv_usd": round(float(item.tcv_usd or 0), 2),
                    "arr_usd": round(float(item.arr_usd or 0), 2),
                    "booking": round(float(item.booking or 0), 2),
                    "booking_status": item.booking_status,
                    "order_status": item.order_status,
                    "revenue_type": item.revenue_type,
                    "term_start": item.term_start.isoformat() if item.term_start else "",
                    "term_end": item.term_end.isoformat() if item.term_end else "",
                    "line_of_business": item.line_of_business,
                    "current_arr": round(_arr_at(item, latest_month), 2),
                    "monthly_arr": item.monthly_arr,
                    "monthly_changes": item.monthly_changes,
                    "customer": _customer_name(item),
                    "product": item.sub_product_type or item.product_type,
                    "status": "Active" if _arr_at(item, latest_month) > 0 else (item.order_status or item.booking_status),
                    "deal_type": item.line_of_business,
                    "attribute1": item.attribute1,
                    "attribute2": item.attribute2,
                    "attribute3": item.attribute3,
                    "attribute4": item.attribute4,
                    "attribute5": item.attribute5,
                    "attribute6": item.attribute6,
                    "attribute7": item.attribute7,
                    "attribute8": item.attribute8,
                    "attribute9": item.attribute9,
                    "attribute10": item.attribute10,
                    "attribute11": item.attribute11,
                    "attribute12": item.attribute12,
                    "attribute13": item.attribute13,
                    "attribute14": item.attribute14,
                    "attribute15": item.attribute15,
                    "created_by": item.created_by,
                    "creation_date": item.creation_date.isoformat() if item.creation_date else "",
                    "last_update_by": item.last_update_by,
                    "last_update_date": item.last_update_date.isoformat() if item.last_update_date else "",
                }
                for item in records
            ],
        }
    )
