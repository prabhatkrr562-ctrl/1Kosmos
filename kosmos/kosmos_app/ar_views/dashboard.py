import re
from collections import defaultdict
from datetime import date

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import ARDataImport
from ..views_shared import _money
from .shared import _bucket_label, _group_amount


def _parse_date(value):
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError:
        return None


def _stretch_range(bounds, value):
    if not value:
        return
    if bounds[0] is None or value < bounds[0]:
        bounds[0] = value
    if bounds[1] is None or value > bounds[1]:
        bounds[1] = value


@require_GET
def ar_dashboard(request):
    data_import = ARDataImport.objects.first()
    if not data_import:
        return JsonResponse({
            "has_data": False,
            "message": "Upload AR Dashboard - Master Sheet - 15 June.xlsx.",
            "filters": {},
            "aging": {},
            "collections": {},
            "renewals": {},
        })

    aging_base = data_import.aging_records.all()
    payments_base = data_import.payment_records.all()
    renewals_base = data_import.renewal_records.all()
    filters = {
        "region": sorted({
            *aging_base.values_list("region", flat=True),
            *payments_base.values_list("region", flat=True),
            *renewals_base.values_list("region", flat=True),
        } - {""}),
        "sales_rep": sorted({
            *aging_base.values_list("sales_rep", flat=True),
            *payments_base.values_list("sales_rep", flat=True),
            *renewals_base.values_list("sales_rep", flat=True),
        } - {""}),
        "customer": sorted({
            *aging_base.values_list("end_user", flat=True),
            *payments_base.values_list("end_user", flat=True),
            *renewals_base.values_list("end_user", flat=True),
        } - {""}),
    }

    aging = aging_base
    payments = payments_base
    renewals = renewals_base
    region = request.GET.get("region", "").strip()
    sales_rep = request.GET.get("sales_rep", "").strip()
    customer = request.GET.get("customer", "").strip()
    if region:
        aging = aging.filter(region=region)
        payments = payments.filter(region=region)
        renewals = renewals.filter(region=region)
    if sales_rep:
        aging = aging.filter(sales_rep=sales_rep)
        payments = payments.filter(sales_rep=sales_rep)
        renewals = renewals.filter(sales_rep=sales_rep)
    if customer:
        aging = aging.filter(end_user=customer)
        payments = payments.filter(end_user=customer)
        renewals = renewals.filter(end_user=customer)

    aging = list(aging)
    payments = list(payments)
    renewals = list(renewals)
    as_of = data_import.as_of_date or data_import.imported_at.date()

    # Collections date filter: invoice rows carry invoice/due dates, payment
    # rows carry the payment date; an invoice passes when its selected date
    # falls inside the requested range.
    date_type = request.GET.get("date_type", "inv").strip()
    if date_type not in ("inv", "pay", "due"):
        date_type = "inv"
    date_from = _parse_date(request.GET.get("date_from"))
    date_to = _parse_date(request.GET.get("date_to"))

    date_ranges = {"inv": [None, None], "pay": [None, None], "due": [None, None]}
    for item in payments_base:
        if float(item.amount or 0) > 0:
            _stretch_range(date_ranges["inv"], item.event_date)
            _stretch_range(date_ranges["due"], item.due_date)
        else:
            _stretch_range(date_ranges["pay"], item.event_date)

    invoice_dates = {}
    for item in payments:
        if not item.invoice_number:
            continue
        dates = invoice_dates.setdefault(item.invoice_number, {"inv": None, "pay": None, "due": None})
        if float(item.amount or 0) > 0:
            if item.event_date and (dates["inv"] is None or item.event_date < dates["inv"]):
                dates["inv"] = item.event_date
            if item.due_date and (dates["due"] is None or item.due_date < dates["due"]):
                dates["due"] = item.due_date
        elif item.event_date and (dates["pay"] is None or item.event_date > dates["pay"]):
            dates["pay"] = item.event_date

    total_invoices = len(invoice_dates)
    filtered_invoices = total_invoices
    if date_from or date_to:
        passing = set()
        for invoice_number, dates in invoice_dates.items():
            selected = dates[date_type]
            if not selected:
                continue
            if date_from and selected < date_from:
                continue
            if date_to and selected > date_to:
                continue
            passing.add(invoice_number)
        payments = [item for item in payments if item.invoice_number in passing]
        filtered_invoices = len(passing)

    bucket_order = ["Not Due", "0-30", "31-60", "61-90", "91+"]
    aging_buckets = {label: 0.0 for label in bucket_order}
    overdue = 0.0

    region_buckets_data = defaultdict(lambda: {b: {"amount": 0.0, "count": 0} for b in bucket_order})
    region_customers = defaultdict(set)
    overdue_alerts = []

    for item in aging:
        days = (as_of - item.due_date).days if item.due_date else -1
        bucket = _bucket_label(days)
        aging_buckets[bucket] += item.open_balance
        if days > 0:
            overdue += item.open_balance
        r = item.region or "Other"
        region_buckets_data[r][bucket]["amount"] += item.open_balance
        region_buckets_data[r][bucket]["count"] += 1
        region_customers[r].add(item.end_user or item.customer)

        if days >= 31:
            overdue_alerts.append({
                "customer": item.end_user or item.customer,
                "sales_rep": item.sales_rep,
                "open_balance": _money(item.open_balance),
                "days_overdue": days,
                "bucket": bucket,
                "document_number": item.document_number,
                "due_date": item.due_date.isoformat() if item.due_date else None,
            })

    overdue_alerts.sort(key=lambda x: x["days_overdue"], reverse=True)

    total_ar = sum(item.open_balance for item in aging)
    invoice_events = {}
    for item in payments:
        invoice_number = item.invoice_number
        if not invoice_number:
            continue
        if invoice_number not in invoice_events:
            invoice_events[invoice_number] = {
                "invoice_number": invoice_number,
                "customer": item.customer,
                "end_user": item.end_user,
                "sales_rep": item.sales_rep,
                "region": item.region,
                "invoice_date": None,
                "due_date": None,
                "payment_date": None,
                "invoice_amount": 0.0,
                "payment_amount": 0.0,
            }

        event = invoice_events[invoice_number]
        amount = float(item.amount or 0)
        if amount > 0:
            event["invoice_amount"] += amount
            if item.event_date and (event["invoice_date"] is None or item.event_date < event["invoice_date"]):
                event["invoice_date"] = item.event_date
            if item.due_date and (event["due_date"] is None or item.due_date < event["due_date"]):
                event["due_date"] = item.due_date
        else:
            event["payment_amount"] += abs(amount)
            if item.event_date and (event["payment_date"] is None or item.event_date > event["payment_date"]):
                event["payment_date"] = item.event_date

    cycles = []
    paid_invoice_count = 0
    total_collected = 0.0
    collected_by_month = defaultdict(float)
    customer_cycles = defaultdict(list)
    rep_cycles = defaultdict(list)
    paid_invoice_detail = []
    invoice_detail = []

    for inv_no, event in invoice_events.items():
        invoice_amount = event["invoice_amount"]
        payment_amount = event["payment_amount"]
        fully_paid = abs(invoice_amount - payment_amount) < 0.01
        if fully_paid:
            paid_invoice_count += 1
            total_collected += invoice_amount
            if event["payment_date"]:
                collected_by_month[event["payment_date"].strftime("%Y-%m")] += invoice_amount
            paid_invoice_detail.append({
                "invoice_number": inv_no,
                "customer": event["end_user"] or event["customer"],
                "region": event["region"],
                "sales_rep": event["sales_rep"],
                "amount": _money(invoice_amount),
                "invoice_date": event["invoice_date"].isoformat() if event["invoice_date"] else None,
                "due_date": event["due_date"].isoformat() if event["due_date"] else None,
                "payment_date": event["payment_date"].isoformat() if event["payment_date"] else None,
            })

        if fully_paid and event["invoice_date"] and event["payment_date"]:
            cycle = (event["payment_date"] - event["invoice_date"]).days
            if cycle > 0:
                cycles.append(cycle)
                cust_name = event["end_user"] or event["customer"]
                customer_cycles[cust_name].append(cycle)
                rep_cycles[event["sales_rep"] or "Unspecified"].append(cycle)

                due_date = event["due_date"]
                is_late = due_date and event["payment_date"] > due_date

                invoice_detail.append({
                    "invoice_number": inv_no,
                    "customer": cust_name,
                    "region": event["region"],
                    "sales_rep": event["sales_rep"],
                    "amount": _money(invoice_amount),
                    "invoice_date": event["invoice_date"].isoformat(),
                    "due_date": due_date.isoformat() if due_date else None,
                    "payment_date": event["payment_date"].isoformat(),
                    "cycle": cycle,
                    "status": "Late" if is_late else "On Time",
                })

    invoice_detail.sort(key=lambda x: x["cycle"], reverse=True)

    fast = len([v for v in cycles if v <= 30])
    medium = len([v for v in cycles if 30 < v <= 60])
    slow = len([v for v in cycles if v > 60])
    average_cycle = round(sum(cycles) / len(cycles)) if cycles else 0

    on_time_rows = [r for r in invoice_detail if r["status"] == "On Time"]
    late_rows = [r for r in invoice_detail if r["status"] == "Late"]
    ot_cycles = [r["cycle"] for r in on_time_rows]
    lt_cycles = [r["cycle"] for r in late_rows]

    region_payment = defaultdict(lambda: {"count": 0, "total": 0.0, "cycles": [], "before_due": 0, "after_due": 0})
    for inv in invoice_detail:
        r = inv["region"] or "Other"
        region_payment[r]["count"] += 1
        region_payment[r]["total"] += inv["amount"]
        region_payment[r]["cycles"].append(inv["cycle"])
        if inv["status"] == "On Time":
            region_payment[r]["before_due"] += 1
        else:
            region_payment[r]["after_due"] += 1

    by_region_detail = {
        r: {
            "count": v["count"],
            "total": _money(v["total"]),
            "avg": round(sum(v["cycles"]) / len(v["cycles"])) if v["cycles"] else 0,
            "min": min(v["cycles"]) if v["cycles"] else 0,
            "max": max(v["cycles"]) if v["cycles"] else 0,
            "before_due": v["before_due"],
            "after_due": v["after_due"],
        }
        for r, v in sorted(region_payment.items())
    }

    renewal_total = sum(item.amount for item in renewals)
    signed = [item for item in renewals if "signed" in item.status.lower()]
    annual = [item for item in renewals if "annual" in item.status.lower()]
    multi = [item for item in renewals if "multi year" in item.status.lower()]

    def months_value(value):
        match = re.search(r"\d+", value or "")
        return int(match.group()) if match else 0

    longest = max(renewals, key=lambda item: months_value(item.renewal_status), default=None)

    customer_summary = defaultdict(lambda: {
        "open_ar": 0.0, "overdue": 0.0, "invoice_count": 0, "region": "", "sales_rep": ""
    })
    for item in aging:
        name = item.end_user or item.customer or "Unspecified"
        summary = customer_summary[name]
        summary["open_ar"] += item.open_balance
        summary["invoice_count"] += 1
        summary["region"] = item.region
        summary["sales_rep"] = item.sales_rep
        if item.due_date and item.due_date <= as_of:
            summary["overdue"] += item.open_balance

    customer_aging_detail = defaultdict(lambda: {b: 0.0 for b in bucket_order})
    for item in aging:
        days = (as_of - item.due_date).days if item.due_date else -1
        bucket = _bucket_label(days)
        name = item.end_user or item.customer or "Unspecified"
        customer_aging_detail[name][bucket] += item.open_balance

    customer_summary_list = [
        {
            "customer": name,
            "region": values["region"],
            "sales_rep": values["sales_rep"],
            "open_ar": _money(values["open_ar"]),
            "overdue": _money(values["overdue"]),
            "invoice_count": values["invoice_count"],
            "buckets": {b: _money(customer_aging_detail[name][b]) for b in bucket_order},
        }
        for name, values in sorted(
            customer_summary.items(),
            key=lambda pair: pair[1]["open_ar"],
            reverse=True,
        )
    ]

    return JsonResponse({
        "has_data": True,
        "import": {
            "file_name": data_import.file_name,
            "imported_at": data_import.imported_at.isoformat(),
            "as_of_date": as_of.isoformat(),
            "aging_count": data_import.aging_count,
            "payment_count": data_import.payment_count,
            "renewal_count": data_import.renewal_count,
        },
        "filters": filters,
        "aging": {
            "kpis": {
                "total_ar": _money(total_ar),
                "overdue": _money(overdue),
                "overdue_percent": round(overdue / total_ar * 100, 1) if total_ar else 0,
                "critical_91_plus": _money(aging_buckets["91+"]),
                "not_due": _money(aging_buckets["Not Due"]),
                "regions": len({item.region for item in aging if item.region}),
            },
            "buckets": [
                {"label": label, "value": _money(aging_buckets[label])}
                for label in bucket_order
            ],
            "bucket_percents": [
                {
                    "label": label,
                    "value": _money(aging_buckets[label]),
                    "pct": round(aging_buckets[label] / total_ar * 100, 1) if total_ar else 0,
                }
                for label in bucket_order
            ],
            "region_buckets": {
                r: {
                    "total": _money(sum(v["amount"] for v in bmap.values())),
                    "customers": len(region_customers[r]),
                    "buckets": {b: {"amount": _money(bmap[b]["amount"]), "count": bmap[b]["count"]} for b in bucket_order},
                }
                for r, bmap in sorted(region_buckets_data.items())
            },
            "overdue_alerts": overdue_alerts,
            "by_region": _group_amount(aging, "region", "open_balance"),
            "by_sales_rep": _group_amount(aging, "sales_rep", "open_balance"),
            "by_customer": _group_amount(aging, "end_user", "open_balance", 12),
            "records": [
                {
                    "customer": item.end_user or item.customer,
                    "legal_customer": item.customer,
                    "region": item.region,
                    "sales_rep": item.sales_rep,
                    "document_number": item.document_number,
                    "document_date": item.document_date.isoformat() if item.document_date else None,
                    "due_date": item.due_date.isoformat() if item.due_date else None,
                    "days_overdue": max((as_of - item.due_date).days, 0) if item.due_date else 0,
                    "open_balance": _money(item.open_balance),
                }
                for item in sorted(aging, key=lambda row: row.open_balance, reverse=True)
            ],
            "customer_summary": customer_summary_list,
        },
        "collections": {
            "date_filter": {
                "type": date_type,
                "from": date_from.isoformat() if date_from else None,
                "to": date_to.isoformat() if date_to else None,
                "total_invoices": total_invoices,
                "filtered_invoices": filtered_invoices,
                "ranges": {
                    key: {
                        "min": bounds[0].isoformat() if bounds[0] else None,
                        "max": bounds[1].isoformat() if bounds[1] else None,
                    }
                    for key, bounds in date_ranges.items()
                },
            },
            "kpis": {
                "total_collected": _money(total_collected),
                "paid_invoices": paid_invoice_count,
                "tracked_invoices": len(invoice_detail),
                "average_cycle": average_cycle,
                "fast": fast,
                "medium": medium,
                "slow": slow,
            },
            "on_time_late": {
                "on_time": {
                    "count": len(on_time_rows),
                    "amount": _money(sum(r["amount"] for r in on_time_rows)),
                    "avg_cycle": round(sum(ot_cycles) / len(ot_cycles)) if ot_cycles else 0,
                    "pct": round(len(on_time_rows) / len(invoice_detail) * 100) if invoice_detail else 0,
                },
                "late": {
                    "count": len(late_rows),
                    "amount": _money(sum(r["amount"] for r in late_rows)),
                    "avg_cycle": round(sum(lt_cycles) / len(lt_cycles)) if lt_cycles else 0,
                    "pct": round(len(late_rows) / len(invoice_detail) * 100) if invoice_detail else 0,
                },
            },
            "by_region_detail": by_region_detail,
            "trend": [
                {"month": month, "value": _money(value)}
                for month, value in sorted(collected_by_month.items())
            ],
            "speed": [
                {"label": "Fast (<=30d)", "value": fast},
                {"label": "Medium (31-60d)", "value": medium},
                {"label": "Slow (60d+)", "value": slow},
            ],
            "by_region": _group_amount(
                [item for item in payments if item.payment_type.lower() != "invoice"],
                "region",
                "amount",
            ),
            "customer_cycles": [
                {"label": label, "value": round(sum(values) / len(values), 1)}
                for label, values in sorted(
                    customer_cycles.items(),
                    key=lambda pair: sum(pair[1]) / len(pair[1]),
                    reverse=True,
                )[:20]
            ],
            "rep_cycles": [
                {"label": label, "value": round(sum(values) / len(values), 1)}
                for label, values in sorted(
                    rep_cycles.items(),
                    key=lambda pair: sum(pair[1]) / len(pair[1]),
                    reverse=True,
                )
            ],
            "invoice_detail": invoice_detail,
            "paid_invoice_detail": paid_invoice_detail,
        },
        "renewals": {
            "kpis": {
                "pending_total": _money(renewal_total),
                "pending_count": len(renewals),
                "signed_not_invoiced": _money(sum(item.amount for item in signed)),
                "annual_renewal": _money(sum(item.amount for item in annual)),
                "multi_year": _money(sum(item.amount for item in multi)),
                "longest_status": longest.renewal_status if longest else "",
                "longest_customer": longest.end_user if longest else "",
            },
            "by_region": _group_amount(renewals, "region", "amount"),
            "by_sales_rep": _group_amount(renewals, "sales_rep", "amount"),
            "by_status": _group_amount(renewals, "status", "amount"),
            "records": [
                {
                    "customer": item.end_user,
                    "renewal_status": item.renewal_status,
                    "status": item.status,
                    "amount": _money(item.amount),
                    "sales_rep": item.sales_rep,
                    "region": item.region,
                    "remarks": item.remarks,
                }
                for item in sorted(renewals, key=lambda row: row.amount, reverse=True)
            ],
        },
    })
