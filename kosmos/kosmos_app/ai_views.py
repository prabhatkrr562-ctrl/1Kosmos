import json
import os
import re
import urllib.error
import urllib.request
from collections import defaultdict

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import ARDataImport, DataImport, PipelineImport
from .pipeline_views.shared import ACTIVE_STAGES, AOP, SALES_TARGET, STAGE_ORDER, _week_sort_key


LOCAL_MODEL = "local-dashboard-rag"

DASHBOARD_KNOWLEDGE = {
    "pipeline": [
        {
            "title": "Pipeline KPI definitions",
            "text": (
                "Active pipeline is the sum of opportunity amount for active stages only. "
                "Weighted pipeline is the sum of weighted amount for active stages. Commit and "
                "Upside are active opportunity subsets based on forecast category. Coverage is "
                "active pipeline divided by AOP or sales target."
            ),
        },
        {
            "title": "Pipeline stage order",
            "text": "Pipeline stages are ordered as: " + ", ".join(STAGE_ORDER) + ".",
        },
        {
            "title": "Pipeline movement",
            "text": (
                "Deal movement compares the selected week against the previous week. Forward "
                "movement means a deal moved to a later stage, backward movement means it moved "
                "to an earlier stage, won/lost movement means it closed."
            ),
        },
    ],
    "arr": [
        {
            "title": "ARR KPI definitions",
            "text": (
                "ARR is recurring annualized revenue at the latest available month. LTM metrics "
                "summarize the last twelve months. GRR measures retained recurring revenue before "
                "expansion; NRR includes expansion from upsell."
            ),
        },
        {
            "title": "ARR analysis",
            "text": (
                "ARR dashboard answers should compare current ARR, booking, customer count, "
                "waterfall movement, at-risk customers, top gainers, business-unit mix, and rep "
                "leaderboard where available."
            ),
        },
    ],
    "ar": [
        {
            "title": "AR KPI definitions",
            "text": (
                "Total AR is open receivables. Overdue is open receivables past due date. Aging "
                "buckets are Not Due, 0-30, 31-60, 61-90, and 91+ days. Collection cycle measures "
                "days from invoice date to payment date."
            ),
        },
        {
            "title": "AR analysis",
            "text": (
                "AR dashboard answers should focus on overdue concentration, 91+ risk, customer "
                "and region exposure, collection speed, late payments, and pending renewals."
            ),
        },
    ],
}


def _money(value):
    return round(float(value or 0), 2)


def _top_rows(rows, key, limit=8):
    return sorted(rows, key=lambda row: row.get(key, 0), reverse=True)[:limit]


def _selected_filters(source):
    return {
        key: value
        for key, value in (source or {}).items()
        if isinstance(value, str) and value.strip()
    }


def _retrieve_docs(dashboard, question, limit=4):
    docs = DASHBOARD_KNOWLEDGE.get(dashboard, [])
    terms = set(re.findall(r"[a-z0-9]+", (question or "").lower()))

    def score(doc):
        haystack = f"{doc['title']} {doc['text']}".lower()
        return sum(1 for term in terms if term in haystack)

    ranked = sorted(docs, key=score, reverse=True)
    return ranked[:limit]


def _pipeline_context(filters):
    data_import = PipelineImport.objects.first()
    if not data_import:
        return {"has_data": False, "message": "No pipeline import found."}

    base_qs = data_import.records.all()
    weeks = sorted(
        {week for week in base_qs.values_list("week", flat=True).distinct() if week},
        key=_week_sort_key,
    )
    selected_week = filters.get("week") if filters.get("week") in weeks else (weeks[-1] if weeks else "")
    records = base_qs.filter(week=selected_week) if selected_week else base_qs

    field_map = {
        "owner": "owner",
        "team": "team",
        "stage": "stage",
        "quarter": "close_quarter",
        "region": "region",
        "sector": "sector",
    }
    for query_key, field_name in field_map.items():
        value = filters.get(query_key)
        if value:
            records = records.filter(**{field_name: value})

    rows = list(records)
    active = [row for row in rows if row.stage in ACTIVE_STAGES]
    won = [row for row in rows if row.stage == "Business Won" or row.forecast_category.lower() == "closed won"]
    lost = [row for row in rows if row.stage == "Business Lost"]
    commit = [row for row in active if row.forecast_category.strip() == "Commit"]
    upside = [row for row in active if row.forecast_category.strip() == "Upside"]

    by_stage = defaultdict(lambda: {"amount": 0.0, "count": 0})
    by_region = defaultdict(lambda: {"amount": 0.0, "count": 0})
    by_owner = defaultdict(lambda: {"amount": 0.0, "count": 0})
    for row in active:
        by_stage[row.stage]["amount"] += row.amount
        by_stage[row.stage]["count"] += 1
        by_region[row.region or "Unknown"]["amount"] += row.amount
        by_region[row.region or "Unknown"]["count"] += 1
        by_owner[row.owner or "Unassigned"]["amount"] += row.amount
        by_owner[row.owner or "Unassigned"]["count"] += 1

    active_pipeline = sum(row.amount for row in active)
    weighted_pipeline = sum(row.weighted for row in active)
    trend = []
    for week in weeks[-8:]:
        week_active = base_qs.filter(week=week, stage__in=ACTIVE_STAGES)
        trend.append({
            "week": week,
            "active_pipeline": _money(sum(row.amount for row in week_active)),
            "deal_count": week_active.count(),
        })

    owner_rows = [
        {"owner": owner, "amount": _money(values["amount"]), "count": values["count"]}
        for owner, values in by_owner.items()
    ]
    deal_rows = [
        {
            "deal_name": row.deal_name,
            "company": row.company,
            "owner": row.owner,
            "stage": row.stage,
            "amount": _money(row.amount),
            "close_quarter": row.close_quarter,
            "region": row.region,
            "next_step": row.next_step[:240],
        }
        for row in sorted(active, key=lambda item: item.amount, reverse=True)
    ]

    return {
        "has_data": True,
        "dashboard": "Pipeline Intelligence",
        "selected_filters": filters,
        "selected_week": selected_week,
        "import": {
            "file_name": data_import.file_name,
            "row_count": data_import.row_count,
            "imported_at": data_import.imported_at.isoformat(),
        },
        "kpis": {
            "active_pipeline": _money(active_pipeline),
            "active_deals": len(active),
            "weighted_pipeline": _money(weighted_pipeline),
            "won_ytd": _money(sum(row.amount for row in won)),
            "won_deals": len(won),
            "lost_ytd": _money(sum(row.amount for row in lost)),
            "lost_deals": len(lost),
            "commit_pipeline": _money(sum(row.amount for row in commit)),
            "commit_deals": len(commit),
            "upside_pipeline": _money(sum(row.amount for row in upside)),
            "upside_deals": len(upside),
            "avg_deal_size": _money(active_pipeline / len(active)) if active else 0,
            "coverage_aop_percent": round(active_pipeline / AOP * 100, 1) if AOP else 0,
            "coverage_target_percent": round(active_pipeline / SALES_TARGET * 100, 1) if SALES_TARGET else 0,
        },
        "top_stages": _top_rows([
            {"stage": stage, "amount": _money(values["amount"]), "count": values["count"]}
            for stage, values in by_stage.items()
        ], "amount"),
        "top_regions": _top_rows([
            {"region": region, "amount": _money(values["amount"]), "count": values["count"]}
            for region, values in by_region.items()
        ], "amount"),
        "top_owners": _top_rows(owner_rows, "amount"),
        "all_owners": owner_rows,
        "recent_trend": trend,
        "largest_deals": deal_rows[:10],
        "all_active_deals": deal_rows,
    }


def _arr_context(filters):
    data_import = DataImport.objects.first()
    if not data_import:
        return {"has_data": False, "message": "No ARR import found."}

    records = data_import.records.all()
    field_map = {
        "business_unit": "business_unit",
        "sales_person": "sales_person",
        "sub_product_type": "sub_product_type",
        "line_of_business": "line_of_business",
    }
    for query_key, field_name in field_map.items():
        value = filters.get(query_key)
        if value:
            records = records.filter(**{field_name: value})

    rows = list(records)
    months = sorted({month for row in rows for month, amount in (row.monthly_arr or {}).items() if float(amount or 0)})
    latest_month = months[-1] if months else ""

    def arr_at(row):
        return float((row.monthly_arr or {}).get(latest_month) or 0)

    by_bu = defaultdict(lambda: {"arr": 0.0, "count": 0})
    by_region = defaultdict(lambda: {"arr": 0.0, "new": 0.0, "upsell": 0.0, "churn": 0.0, "downsell": 0.0, "count": 0})
    by_product = defaultdict(lambda: {"arr": 0.0, "new": 0.0, "upsell": 0.0, "churn": 0.0, "downsell": 0.0, "count": 0})
    by_rep = defaultdict(lambda: {"arr": 0.0, "count": 0})
    by_customer = defaultdict(lambda: {"arr": 0.0, "count": 0})
    rep_period = defaultdict(lambda: {"arr": 0.0, "new": 0.0, "upsell": 0.0, "churn": 0.0, "downsell": 0.0, "customers": set()})
    customer_period = defaultdict(lambda: {"arr": 0.0, "new": 0.0, "upsell": 0.0, "churn": 0.0, "downsell": 0.0, "rep": "", "region": ""})
    year_prefix = latest_month[:4] if latest_month else ""
    ytd_months = [month for month in months if year_prefix and month.startswith(year_prefix)]
    for row in rows:
        arr = arr_at(row)
        rep = row.sales_person or "Unassigned"
        region = row.business_unit or row.entity or "Unspecified"
        product = row.sub_product_type or row.product_type or "Unspecified"
        customer = row.end_user or row.bill_to or "Unspecified"
        if arr <= 0:
            pass
        else:
            by_bu[row.business_unit or "Unspecified"]["arr"] += arr
            by_bu[row.business_unit or "Unspecified"]["count"] += 1
            by_region[region]["arr"] += arr
            by_region[region]["count"] += 1
            by_product[product]["arr"] += arr
            by_product[product]["count"] += 1
            by_rep[rep]["arr"] += arr
            by_rep[rep]["count"] += 1
            by_customer[customer]["arr"] += arr
            by_customer[customer]["count"] += 1
            rep_period[rep]["arr"] += arr
            rep_period[rep]["customers"].add(customer)
            customer_period[customer]["arr"] += arr
            customer_period[customer]["rep"] = rep
            customer_period[customer]["region"] = region

        for month, changes in (row.monthly_changes or {}).items():
            if month not in ytd_months:
                continue
            new = float(changes.get("New") or 0)
            upsell = float(changes.get("Upsell") or 0)
            churn = abs(float(changes.get("Churn") or 0))
            downsell = abs(float(changes.get("Downsell") or 0))
            rep_period[rep]["new"] += max(new, 0)
            rep_period[rep]["upsell"] += max(upsell, 0)
            rep_period[rep]["churn"] += churn
            rep_period[rep]["downsell"] += downsell
            customer_period[customer]["new"] += max(new, 0)
            customer_period[customer]["upsell"] += max(upsell, 0)
            customer_period[customer]["churn"] += churn
            customer_period[customer]["downsell"] += downsell
            by_region[region]["new"] += max(new, 0)
            by_region[region]["upsell"] += max(upsell, 0)
            by_region[region]["churn"] += churn
            by_region[region]["downsell"] += downsell
            by_product[product]["new"] += max(new, 0)
            by_product[product]["upsell"] += max(upsell, 0)
            by_product[product]["churn"] += churn
            by_product[product]["downsell"] += downsell

    trend = []
    for month in months[-12:]:
        trend.append({
            "month": month,
            "arr": _money(sum(float((row.monthly_arr or {}).get(month) or 0) for row in rows)),
        })

    rep_rows = [
        {
            "sales_person": label,
            "arr": _money(values["arr"]),
            "new": _money(rep_period[label]["new"]),
            "upsell": _money(rep_period[label]["upsell"]),
            "churn": _money(rep_period[label]["churn"]),
            "downsell": _money(rep_period[label]["downsell"]),
            "customers": len(rep_period[label]["customers"]),
        }
        for label, values in by_rep.items()
    ]
    customer_rows = [
        {
            "customer": label,
            "arr": _money(values["arr"]),
            "contracts": values["count"],
            "new": _money(customer_period[label]["new"]),
            "upsell": _money(customer_period[label]["upsell"]),
            "churn": _money(customer_period[label]["churn"]),
            "downsell": _money(customer_period[label]["downsell"]),
            "rep": customer_period[label]["rep"],
            "region": customer_period[label]["region"],
        }
        for label, values in by_customer.items()
    ]

    return {
        "has_data": True,
        "dashboard": "ARR Dashboard",
        "selected_filters": filters,
        "latest_month": latest_month,
        "import": {
            "file_name": data_import.file_name,
            "row_count": data_import.row_count,
            "imported_at": data_import.imported_at.isoformat(),
        },
        "kpis": {
            "total_arr": _money(sum(arr_at(row) for row in rows)),
            "total_booking": _money(sum(row.booking for row in rows)),
            "customers": len({row.end_user or row.bill_to for row in rows if row.end_user or row.bill_to}),
            "recurring_contracts": len([row for row in rows if row.revenue_type.lower() == "recurring"]),
        },
        "ytd_movement": {
            "label": f"{year_prefix} YTD" if year_prefix else "YTD",
            "new": _money(sum(row["new"] for row in rep_period.values())),
            "upsell": _money(sum(row["upsell"] for row in rep_period.values())),
            "churn": _money(sum(row["churn"] for row in rep_period.values())),
            "downsell": _money(sum(row["downsell"] for row in rep_period.values())),
        },
        "top_business_units": _top_rows([
            {"business_unit": label, "arr": _money(values["arr"]), "count": values["count"]}
            for label, values in by_bu.items()
        ], "arr"),
        "top_regions": _top_rows([
            {
                "region": label,
                "arr": _money(values["arr"]),
                "new": _money(values["new"]),
                "upsell": _money(values["upsell"]),
                "churn": _money(values["churn"]),
                "downsell": _money(values["downsell"]),
            }
            for label, values in by_region.items()
        ], "arr"),
        "top_products": _top_rows([
            {
                "product": label,
                "arr": _money(values["arr"]),
                "new": _money(values["new"]),
                "upsell": _money(values["upsell"]),
                "churn": _money(values["churn"]),
                "downsell": _money(values["downsell"]),
            }
            for label, values in by_product.items()
        ], "arr"),
        "top_reps": _top_rows(rep_rows, "arr"),
        "top_customers": _top_rows(customer_rows, "arr", 10),
        "all_reps": rep_rows,
        "all_customers": customer_rows,
        "recent_trend": trend,
    }


def _ar_context(filters):
    data_import = ARDataImport.objects.first()
    if not data_import:
        return {"has_data": False, "message": "No AR import found."}

    aging = data_import.aging_records.all()
    payments = data_import.payment_records.all()
    renewals = data_import.renewal_records.all()
    for key in ("region", "sales_rep"):
        value = filters.get(key)
        if value:
            aging = aging.filter(**{key: value})
            payments = payments.filter(**{key: value})
            renewals = renewals.filter(**{key: value})
    customer = filters.get("customer")
    if customer:
        aging = aging.filter(end_user=customer)
        payments = payments.filter(end_user=customer)
        renewals = renewals.filter(end_user=customer)

    as_of = data_import.as_of_date or data_import.imported_at.date()
    aging_rows = list(aging)
    bucket_totals = defaultdict(float)
    by_customer = defaultdict(lambda: {"open_ar": 0.0, "overdue": 0.0, "count": 0})
    by_region = defaultdict(lambda: {"open_ar": 0.0, "overdue": 0.0, "count": 0})
    overdue = 0.0
    for row in aging_rows:
        days = (as_of - row.due_date).days if row.due_date else -1
        bucket = "Not Due" if days < 0 else "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "91+"
        bucket_totals[bucket] += row.open_balance
        is_overdue = days > 0
        if is_overdue:
            overdue += row.open_balance
        customer_name = row.end_user or row.customer or "Unspecified"
        region = row.region or "Other"
        by_customer[customer_name]["open_ar"] += row.open_balance
        by_customer[customer_name]["overdue"] += row.open_balance if is_overdue else 0
        by_customer[customer_name]["count"] += 1
        by_region[region]["open_ar"] += row.open_balance
        by_region[region]["overdue"] += row.open_balance if is_overdue else 0
        by_region[region]["count"] += 1

    total_ar = sum(row.open_balance for row in aging_rows)
    renewal_rows = list(renewals)
    customer_rows = [
        {
            "customer": customer,
            "open_ar": _money(values["open_ar"]),
            "overdue": _money(values["overdue"]),
            "invoice_count": values["count"],
        }
        for customer, values in by_customer.items()
    ]
    return {
        "has_data": True,
        "dashboard": "AR Dashboard",
        "selected_filters": filters,
        "as_of_date": as_of.isoformat(),
        "import": {
            "file_name": data_import.file_name,
            "aging_count": data_import.aging_count,
            "payment_count": data_import.payment_count,
            "renewal_count": data_import.renewal_count,
        },
        "kpis": {
            "total_ar": _money(total_ar),
            "overdue": _money(overdue),
            "overdue_percent": round(overdue / total_ar * 100, 1) if total_ar else 0,
            "critical_91_plus": _money(bucket_totals["91+"]),
            "not_due": _money(bucket_totals["Not Due"]),
            "pending_renewal_total": _money(sum(row.amount for row in renewal_rows)),
            "pending_renewal_count": len(renewal_rows),
        },
        "aging_buckets": [
            {"bucket": bucket, "amount": _money(bucket_totals[bucket])}
            for bucket in ["Not Due", "0-30", "31-60", "61-90", "91+"]
        ],
        "top_customers": _top_rows(customer_rows, "open_ar", 10),
        "top_overdue_customers": _top_rows(
            [row for row in customer_rows if row["overdue"] > 0], "overdue", 10
        ),
        "all_customers": customer_rows,
        "top_regions": _top_rows([
            {
                "region": region,
                "open_ar": _money(values["open_ar"]),
                "overdue": _money(values["overdue"]),
                "invoice_count": values["count"],
            }
            for region, values in by_region.items()
        ], "open_ar"),
    }


CONTEXT_BUILDERS = {
    "pipeline": _pipeline_context,
    "arr": _arr_context,
    "ar": _ar_context,
}


def _build_context(dashboard, filters):
    builder = CONTEXT_BUILDERS.get(dashboard)
    if not builder:
        return {"has_data": False, "message": f"Unknown dashboard '{dashboard}'."}
    return builder(filters)


def _fmt_money(value):
    value = float(value or 0)
    sign = "-" if value < 0 else ""
    value = abs(value)
    if value >= 1_000_000:
        return f"{sign}${value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"{sign}${value / 1_000:.0f}K"
    return f"{sign}${value:.0f}"


def _first_label(rows, label_key, value_key):
    if not rows:
        return None
    row = rows[0]
    return f"{row.get(label_key)} at {_fmt_money(row.get(value_key))}"


def _markdown_table(headers, rows):
    if not rows:
        return "No matching data found."
    out = ["| " + " | ".join(headers) + " |"]
    out.append("|" + "|".join(["---"] * len(headers)) + "|")
    out.extend("| " + " | ".join(str(value) for value in row) + " |" for row in rows)
    return "\n".join(out)


def _local_pipeline_answer(question, context, docs):
    kpis = context.get("kpis", {})
    question_l = question.lower()

    owner_match = _find_entity(question_l, context.get("all_owners", []), "owner")
    if owner_match:
        return (
            f"**{owner_match['owner']}** — active pipeline is {_fmt_money(owner_match['amount'])} "
            f"across {owner_match['count']} active deal(s) for {context.get('selected_week')}."
        )

    company_deals = [
        deal for deal in context.get("all_active_deals", [])
        if deal.get("company") and deal["company"].lower() in question_l
    ]
    if company_deals:
        company_name = max({deal["company"] for deal in company_deals}, key=len)
        total_amount = sum(deal["amount"] for deal in company_deals)
        rows = [
            [
                deal.get("deal_name"),
                deal.get("stage"),
                _fmt_money(deal.get("amount")),
                deal.get("owner"),
                deal.get("next_step") or "-",
            ]
            for deal in company_deals[:8]
        ]
        return (
            f"**{company_name}** — {len(company_deals)} active deal(s) totaling {_fmt_money(total_amount)} "
            f"for {context.get('selected_week')}.\n\n"
            + _markdown_table(["Deal", "Stage", "Amount", "Owner", "Next Step"], rows)
        )

    if "owner" in question_l or "rep" in question_l or "sales" in question_l:
        rows = [
            [item.get("owner"), _fmt_money(item.get("amount")), item.get("count", 0)]
            for item in context.get("top_owners", [])
        ]
        return f"**Pipeline by Owner - {context.get('selected_week')}**\n\n" + _markdown_table(["Owner", "Pipeline", "Deals"], rows)

    if "region" in question_l:
        rows = [
            [item.get("region"), _fmt_money(item.get("amount")), item.get("count", 0)]
            for item in context.get("top_regions", [])
        ]
        return f"**Pipeline by Region - {context.get('selected_week')}**\n\n" + _markdown_table(["Region", "Pipeline", "Deals"], rows)

    if "stage" in question_l:
        rows = [
            [item.get("stage"), _fmt_money(item.get("amount")), item.get("count", 0)]
            for item in context.get("top_stages", [])
        ]
        return f"**Pipeline by Stage - {context.get('selected_week')}**\n\n" + _markdown_table(["Stage", "Pipeline", "Deals"], rows)

    top_stage = _first_label(context.get("top_stages", []), "stage", "amount")
    top_region = _first_label(context.get("top_regions", []), "region", "amount")
    top_owner = _first_label(context.get("top_owners", []), "owner", "amount")
    largest_deal = context.get("largest_deals", [{}])[0] if context.get("largest_deals") else {}
    trend = context.get("recent_trend", [])
    trend_note = ""
    if len(trend) >= 2:
        change = trend[-1]["active_pipeline"] - trend[-2]["active_pipeline"]
        trend_note = f" Active pipeline changed by {_fmt_money(change)} versus the previous listed week."

    if any(term in question_l for term in ("deal", "attention", "risk", "focus")) and largest_deal:
        return (
            f"The biggest active deal needing visibility is {largest_deal.get('deal_name') or largest_deal.get('company')} "
            f"for {_fmt_money(largest_deal.get('amount'))}, owned by {largest_deal.get('owner') or 'Unassigned'}, "
            f"currently in {largest_deal.get('stage') or 'an unknown stage'}. "
            f"Next step: {largest_deal.get('next_step') or 'not provided'}"
        )

    return (
        f"For {context.get('selected_week')}, active pipeline is {_fmt_money(kpis.get('active_pipeline'))} "
        f"across {kpis.get('active_deals', 0)} active deals. Weighted pipeline is "
        f"{_fmt_money(kpis.get('weighted_pipeline'))}. Commit is {_fmt_money(kpis.get('commit_pipeline'))} "
        f"and upside is {_fmt_money(kpis.get('upside_pipeline'))}. Coverage is "
        f"{kpis.get('coverage_target_percent', 0)}% of sales target and {kpis.get('coverage_aop_percent', 0)}% of AOP. "
        f"The largest stage concentration is {top_stage or 'not available'}, the top region is "
        f"{top_region or 'not available'}, and the top owner is {top_owner or 'not available'}.{trend_note}"
    )


def _local_arr_answer(question, context, docs):
    kpis = context.get("kpis", {})
    q = question.lower()
    ytd = context.get("ytd_movement", {})
    ytd_label = ytd.get("label", "YTD")

    customer_match = _find_entity(q, context.get("all_customers", []), "customer")
    if customer_match:
        return (
            f"**{customer_match['customer']}** — current ARR is {_fmt_money(customer_match['arr'])} "
            f"across {customer_match['contracts']} contract(s), managed by "
            f"{customer_match['rep'] or 'Unassigned'} in {customer_match['region'] or 'an unspecified region'}. "
            f"{ytd_label} movement: new {_fmt_money(customer_match['new'])}, "
            f"upsell {_fmt_money(customer_match['upsell'])}, churn {_fmt_money(customer_match['churn'])}, "
            f"downsell {_fmt_money(customer_match['downsell'])}."
        )

    rep_match = _find_entity(q, context.get("all_reps", []), "sales_person")
    if rep_match:
        return (
            f"**{rep_match['sales_person']}** — current ARR is {_fmt_money(rep_match['arr'])} "
            f"across {rep_match['customers']} customer(s). {ytd_label} movement: "
            f"new {_fmt_money(rep_match['new'])}, upsell {_fmt_money(rep_match['upsell'])}, "
            f"churn {_fmt_money(rep_match['churn'])}, downsell {_fmt_money(rep_match['downsell'])}."
        )

    if "churn" in q:
        rows = []
        if "rep" in q or "sales" in q:
            for rep in sorted(context.get("top_reps", []), key=lambda row: row.get("churn", 0), reverse=True):
                if rep.get("churn", 0) > 0:
                    rows.append([
                        rep.get("sales_person"),
                        _fmt_money(rep.get("churn")),
                        _fmt_money(rep.get("downsell")),
                        _fmt_money(rep.get("new") + rep.get("upsell") - rep.get("churn") - rep.get("downsell")),
                    ])
            return f"**Churn by Sales Rep - {ytd_label}**\n\n" + _markdown_table(["Rep", "Churn", "Downsell", "Net"], rows)

        rows = [
            [
                item.get("customer"),
                item.get("rep") or "Unassigned",
                _fmt_money(item.get("churn")),
                _fmt_money(item.get("downsell")),
            ]
            for item in sorted(context.get("top_customers", []), key=lambda row: row.get("churn", 0), reverse=True)
            if item.get("churn", 0) > 0 or item.get("downsell", 0) > 0
        ]
        if rows:
            return f"**Customer Churn / Downsell - {ytd_label}**\n\n" + _markdown_table(["Customer", "Rep", "Churn", "Downsell"], rows)
        return f"No churn or downsell is visible in the current {ytd_label} context."

    if "region" in q or "apac" in q or "nam" in q or "oem" in q:
        total = sum(item.get("arr", 0) for item in context.get("top_regions", [])) or 1
        rows = [
            [
                item.get("region"),
                _fmt_money(item.get("arr")),
                _fmt_money(item.get("new")),
                _fmt_money(item.get("upsell")),
                _fmt_money(item.get("churn")),
                f"{item.get('arr', 0) / total * 100:.1f}%",
            ]
            for item in context.get("top_regions", [])
        ]
        return f"**ARR by Region - {context.get('latest_month') or 'Latest'}**\n\n" + _markdown_table(
            ["Region", "ARR", "New", "Upsell", "Churn", "Mix"],
            rows,
        )

    if "product" in q or "mix" in q:
        rows = [
            [
                item.get("product"),
                _fmt_money(item.get("arr")),
                _fmt_money(item.get("new")),
                _fmt_money(item.get("upsell")),
                _fmt_money(item.get("churn")),
            ]
            for item in context.get("top_products", [])
        ]
        return f"**Product Mix - {context.get('latest_month') or 'Latest'}**\n\n" + _markdown_table(
            ["Product", "ARR", "New", "Upsell", "Churn"],
            rows,
        )

    if "rep" in q or "sales" in q or "performed" in q or "best" in q:
        rows = [
            [
                item.get("sales_person"),
                _fmt_money(item.get("arr")),
                _fmt_money(item.get("new")),
                _fmt_money(item.get("upsell")),
                _fmt_money(item.get("churn")),
                item.get("customers", 0),
            ]
            for item in context.get("top_reps", [])[:10]
        ]
        return f"**Sales Rep Performance - {ytd_label}**\n\n" + _markdown_table(
            ["Rep", "Current ARR", "New", "Upsell", "Churn", "Customers"],
            rows,
        )

    if "customer" in q or "account" in q or "client" in q:
        rows = [
            [
                item.get("customer"),
                _fmt_money(item.get("arr")),
                item.get("rep") or "Unassigned",
                item.get("region") or "Unspecified",
                _fmt_money(item.get("upsell")),
                _fmt_money(item.get("churn") + item.get("downsell")),
            ]
            for item in context.get("top_customers", [])[:10]
        ]
        heading = "Top Customers by ARR"
        if "risk" in q or "at risk" in q:
            rows = sorted(rows, key=lambda row: row[5], reverse=True)
            heading = "Customer Risk View"
        return f"**{heading} - {context.get('latest_month') or 'Latest'}**\n\n" + _markdown_table(
            ["Customer", "ARR", "Rep", "Region", "Upsell", "Churn/Downsell"],
            rows,
        )

    if "nrr" in q or "grr" in q or "retention" in q:
        opening = max(kpis.get("total_arr", 0) - ytd.get("new", 0) - ytd.get("upsell", 0) + ytd.get("churn", 0) + ytd.get("downsell", 0), 0)
        grr = ((opening - ytd.get("churn", 0) - ytd.get("downsell", 0)) / opening * 100) if opening else 0
        nrr = ((opening + ytd.get("upsell", 0) - ytd.get("churn", 0) - ytd.get("downsell", 0)) / opening * 100) if opening else 0
        return (
            f"**Retention Breakdown - {ytd_label}**\n\n"
            + _markdown_table(
                ["Metric", "Value"],
                [
                    ["Estimated Opening ARR", _fmt_money(opening)],
                    ["Upsell", _fmt_money(ytd.get("upsell"))],
                    ["Churn", _fmt_money(ytd.get("churn"))],
                    ["Downsell", _fmt_money(ytd.get("downsell"))],
                    ["GRR", f"{grr:.1f}%"],
                    ["NRR", f"{nrr:.1f}%"],
                ],
            )
        )

    if "trend" in q or "growth" in q or "monthly" in q:
        rows = []
        trend = context.get("recent_trend", [])
        for index, item in enumerate(trend):
            previous = trend[index - 1]["arr"] if index else 0
            change = item["arr"] - previous if previous else 0
            rows.append([item["month"], _fmt_money(item["arr"]), _fmt_money(change) if index else "-"])
        return "**ARR Monthly Trend**\n\n" + _markdown_table(["Month", "ARR", "MoM Change"], rows)

    top_bu = _first_label(context.get("top_business_units", []), "business_unit", "arr")
    top_rep = _first_label(context.get("top_reps", []), "sales_person", "arr")
    top_customer = _first_label(context.get("top_customers", []), "customer", "arr")
    trend = context.get("recent_trend", [])
    trend_note = ""
    if len(trend) >= 2:
        change = trend[-1]["arr"] - trend[-2]["arr"]
        trend_note = f" ARR changed by {_fmt_money(change)} versus the previous month in the trend."

    return (
        f"As of {context.get('latest_month') or 'the latest month'}, ARR is "
        f"{_fmt_money(kpis.get('total_arr'))} with {_fmt_money(kpis.get('total_booking'))} in booking, "
        f"{kpis.get('customers', 0)} customers, and {kpis.get('recurring_contracts', 0)} recurring contracts. "
        f"{ytd_label} movement: new {_fmt_money(ytd.get('new'))}, upsell {_fmt_money(ytd.get('upsell'))}, "
        f"churn {_fmt_money(ytd.get('churn'))}, downsell {_fmt_money(ytd.get('downsell'))}. "
        f"The top business unit is {top_bu or 'not available'}, the top rep is {top_rep or 'not available'}, "
        f"and the top customer is {top_customer or 'not available'}.{trend_note}"
    )


def _find_entity(question_lower, rows, name_key):
    candidates = [
        row for row in rows
        if row.get(name_key) and row[name_key].lower() in question_lower
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda row: len(row[name_key]))


def _local_ar_answer(question, context, docs):
    kpis = context.get("kpis", {})
    q = question.lower()

    customer_match = _find_entity(q, context.get("all_customers", []), "customer")
    if customer_match:
        status = "overdue" if customer_match["overdue"] > 0 else "not overdue"
        return (
            f"**{customer_match['customer']}** as of {context.get('as_of_date')}: "
            f"open AR is {_fmt_money(customer_match['open_ar'])}, of which "
            f"{_fmt_money(customer_match['overdue'])} is {status} across "
            f"{customer_match['invoice_count']} invoice(s)."
        )

    if "region" in q:
        rows = [
            [
                item.get("region"),
                _fmt_money(item.get("open_ar")),
                _fmt_money(item.get("overdue")),
                item.get("invoice_count", 0),
            ]
            for item in context.get("top_regions", [])
        ]
        return f"**AR by Region - {context.get('as_of_date')}**\n\n" + _markdown_table(["Region", "Open AR", "Overdue", "Invoices"], rows)

    if "overdue" in q:
        rows = [
            [
                item.get("customer"),
                _fmt_money(item.get("open_ar")),
                _fmt_money(item.get("overdue")),
                item.get("invoice_count", 0),
            ]
            for item in context.get("top_overdue_customers", [])
        ]
        if not rows:
            return f"No customers currently show overdue AR as of {context.get('as_of_date')}."
        return f"**Top Overdue Customers - {context.get('as_of_date')}**\n\n" + _markdown_table(["Customer", "Open AR", "Overdue", "Invoices"], rows)

    if "customer" in q or "collection" in q:
        rows = [
            [
                item.get("customer"),
                _fmt_money(item.get("open_ar")),
                _fmt_money(item.get("overdue")),
                item.get("invoice_count", 0),
            ]
            for item in context.get("top_customers", [])
        ]
        return f"**Collection Focus - {context.get('as_of_date')}**\n\n" + _markdown_table(["Customer", "Open AR", "Overdue", "Invoices"], rows)

    if "bucket" in q or "91" in q or "aging" in q:
        rows = [[item.get("bucket"), _fmt_money(item.get("amount"))] for item in context.get("aging_buckets", [])]
        return f"**Aging Buckets - {context.get('as_of_date')}**\n\n" + _markdown_table(["Bucket", "Amount"], rows)

    top_customer = context.get("top_customers", [{}])[0] if context.get("top_customers") else {}
    top_region = context.get("top_regions", [{}])[0] if context.get("top_regions") else {}
    buckets = context.get("aging_buckets", [])
    critical = next((item for item in buckets if item.get("bucket") == "91+"), {})

    return (
        f"As of {context.get('as_of_date')}, total AR is {_fmt_money(kpis.get('total_ar'))}. "
        f"Overdue AR is {_fmt_money(kpis.get('overdue'))}, or {kpis.get('overdue_percent', 0)}% of total AR. "
        f"The 91+ bucket is {_fmt_money(critical.get('amount'))}. "
        f"The largest customer exposure is {top_customer.get('customer', 'not available')} with "
        f"{_fmt_money(top_customer.get('open_ar'))} open AR and {_fmt_money(top_customer.get('overdue'))} overdue. "
        f"The top region is {top_region.get('region', 'not available')} with "
        f"{_fmt_money(top_region.get('open_ar'))} open AR. Pending renewals total "
        f"{_fmt_money(kpis.get('pending_renewal_total'))} across {kpis.get('pending_renewal_count', 0)} records."
    )


def _local_answer(dashboard, question, context, docs):
    if not context.get("has_data"):
        return context.get("message") or "No dashboard data is available yet."
    if dashboard == "pipeline":
        return _local_pipeline_answer(question, context, docs)
    if dashboard == "arr":
        return _local_arr_answer(question, context, docs)
    if dashboard == "ar":
        return _local_ar_answer(question, context, docs)
    doc_text = " ".join(doc.get("text", "") for doc in docs)
    return doc_text or "I can answer after dashboard data is available."


def _call_ollama(question, context, docs, messages):
    ollama_url = os.environ.get("OLLAMA_URL") or getattr(settings, "OLLAMA_URL", "http://localhost:11434/api/chat")
    model = os.environ.get("OLLAMA_DASHBOARD_MODEL") or getattr(settings, "OLLAMA_DASHBOARD_MODEL", "llama3.1")

    prior_messages = [
        {"role": item.get("role"), "content": item.get("content", "")}
        for item in (messages or [])[-6:]
        if item.get("role") in ("user", "assistant") and item.get("content")
    ]
    system_text = (
        "You are the 1Kosmos dashboard assistant. Answer using only the supplied dashboard "
        "context and retrieved knowledge. Be concise, explain the business reason behind the "
        "numbers, and say when the context does not contain enough data. Do not invent data."
    )
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_text},
            *prior_messages,
            {
                "role": "user",
                "content": (
                    "Retrieved knowledge:\n"
                    f"{json.dumps(docs, ensure_ascii=False)}\n\n"
                    "Dashboard context:\n"
                    f"{json.dumps(context, ensure_ascii=False)}\n\n"
                    f"Question: {question}"
                ),
            },
        ],
    }
    request = urllib.request.Request(
        ollama_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama error {exc.code}: {detail[:500]}") from exc
    except urllib.error.URLError:
        # Ollama isn't running locally — fall back to the free rule-based answer.
        return _local_answer(context.get("dashboard_key", ""), question, context, docs), LOCAL_MODEL

    content = (result.get("message") or {}).get("content", "").strip()
    return content or "I could not produce an answer from the current context.", model


@require_GET
def ai_context(request):
    dashboard = request.GET.get("dashboard", "pipeline").strip().lower()
    filters = _selected_filters(request.GET)
    filters.pop("dashboard", None)
    return JsonResponse({
        "dashboard": dashboard,
        "context": _build_context(dashboard, filters),
        "retrieved": _retrieve_docs(dashboard, ""),
    })


@csrf_exempt
@require_POST
def ai_chat(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    dashboard = str(payload.get("dashboard") or "pipeline").strip().lower()
    question = str(payload.get("question") or "").strip()
    if not question:
        return JsonResponse({"error": "Question is required."}, status=400)

    filters = _selected_filters(payload.get("filters") or {})
    context = _build_context(dashboard, filters)
    context["dashboard_key"] = dashboard
    context["active_tab"] = payload.get("active_tab") or ""
    docs = _retrieve_docs(dashboard, question)
    try:
        answer, model = _call_ollama(question, context, docs, payload.get("messages") or [])
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc), "context": context, "retrieved": docs}, status=503)

    return JsonResponse({
        "answer": answer,
        "model": model,
        "context": {
            "dashboard": context.get("dashboard"),
            "selected_filters": context.get("selected_filters"),
            "active_tab": context.get("active_tab"),
        },
        "retrieved": docs,
    })
