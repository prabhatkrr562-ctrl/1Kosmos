from collections import defaultdict
from datetime import date
import re

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import PipelineImport
from .shared import ACTIVE_STAGES, AOP, SALES_TARGET, STAGE_ORDER, _movement_key, _week_sort_key

# The reference dashboard curates the rep roster for every rep-level view
# (cards, leaderboard, scorecard): sales leaders are excluded, as are
# incidental owners with a single qualifying record in the selected week.
REP_VIEW_LEADERS = {"Jens Meggers", "Jens Hinrichsen", "Siddharth Gandhi"}
REP_VIEW_MIN_RECORDS = 2


@require_GET
def pipeline_dashboard(request):
    data_import = PipelineImport.objects.first()
    if not data_import:
        return JsonResponse({
            "has_data": False,
            "message": "Upload Pipeline Database.xlsx to populate the dashboard.",
            "filters": {},
            "kpis": {},
            "weeks": [],
        })

    base_qs = data_import.records.all()
    weeks_all = sorted(
        {week for week in base_qs.values_list("week", flat=True).distinct() if week},
        key=_week_sort_key,
    )
    filters = {
        "weeks": weeks_all,
        "owners": sorted(owner for owner in base_qs.values_list("owner", flat=True).distinct() if owner),
        "teams": sorted(team for team in base_qs.values_list("team", flat=True).distinct() if team),
        "stages": STAGE_ORDER,
        "quarters": sorted(q for q in base_qs.values_list("close_quarter", flat=True).distinct() if q),
        "regions": sorted(region for region in base_qs.values_list("region", flat=True).distinct() if region),
        "order_types": sorted(order for order in base_qs.values_list("order_type", flat=True).distinct() if order),
        "sectors": sorted(sector for sector in base_qs.values_list("sector", flat=True).distinct() if sector),
        "forecasts": sorted({
            value.strip()
            for value in base_qs.values_list("forecast_category", flat=True).distinct()
            if value and value.strip()
        }),
        "years": sorted({
            quarter.strip()[-2:]
            for quarter in base_qs.values_list("close_quarter", flat=True).distinct()
            if quarter and re.search(r"\b\d{2}$", quarter.strip())
        }),
    }

    sel_week = request.GET.get("week", "").strip()
    sel_owner = request.GET.get("owner", "").strip()
    sel_team = request.GET.get("team", "").strip()
    sel_stage = request.GET.get("stage", "").strip()
    sel_quarter = request.GET.get("quarter", "").strip()
    sel_region = request.GET.get("region", "").strip()
    sel_sector = request.GET.get("sector", "").strip()
    sel_forecast = request.GET.get("forecast", "").strip()
    sel_order_type = request.GET.get("order_type", "").strip()
    sel_year = request.GET.get("year", "").strip()
    view_mode = request.GET.get("view_mode", "unweighted").strip().lower()
    if view_mode not in {"unweighted", "weighted"}:
        view_mode = "unweighted"

    latest_week = weeks_all[-1] if weeks_all else ""
    target_week = sel_week if sel_week in weeks_all else latest_week

    filtered_qs = base_qs
    if sel_owner:
        filtered_qs = filtered_qs.filter(owner=sel_owner)
    if sel_team:
        filtered_qs = filtered_qs.filter(team=sel_team)
    if sel_stage:
        filtered_qs = filtered_qs.filter(stage=sel_stage)
    if sel_quarter == "Q3 27+":
        filtered_qs = filtered_qs.filter(close_quarter__in=("Q3 27", "Q4 27"))
    elif sel_quarter:
        filtered_qs = filtered_qs.filter(close_quarter=sel_quarter)
    if sel_region:
        filtered_qs = filtered_qs.filter(region=sel_region)
    if sel_sector:
        filtered_qs = filtered_qs.filter(sector=sel_sector)
    if sel_forecast:
        matching_forecasts = [
            value for value in filters["forecasts"]
            if value.strip() == sel_forecast
        ]
        raw_forecasts = [
            value for value in base_qs.values_list("forecast_category", flat=True).distinct()
            if value and value.strip() in matching_forecasts
        ]
        filtered_qs = filtered_qs.filter(forecast_category__in=raw_forecasts)
    if sel_order_type:
        filtered_qs = filtered_qs.filter(order_type=sel_order_type)
    if sel_year:
        filtered_qs = filtered_qs.filter(close_quarter__endswith=f" {sel_year}")

    week_qs = filtered_qs.filter(week=target_week)

    week_records = list(week_qs)
    # Zero-value CRM rows are placeholders rather than actionable pipeline.
    # Keep them available for movement matching, but exclude them from every
    # financial KPI, deal count, distribution, and drill-down result.
    metric_records = [row for row in week_records if row.amount > 0]

    active = [row for row in metric_records if row.stage in ACTIVE_STAGES]
    won = [
        row for row in metric_records
        if row.stage == "Business Won" or row.forecast_category in ("Closed won", "closed won")
    ]
    lost = [row for row in metric_records if row.stage == "Business Lost"]
    commit = [
        row for row in metric_records
        if row.forecast_category in ("Commit", "Commit ") and row.stage in ACTIVE_STAGES
    ]
    upside = [
        row for row in metric_records
        if row.forecast_category == "Upside" and row.stage in ACTIVE_STAGES
    ]

    def value_of(row):
        return row.weighted if view_mode == "weighted" else row.amount

    def total(rows):
        return round(sum(value_of(row) for row in rows), 2)

    def weighted_total(rows):
        return round(sum(row.weighted for row in rows), 2)

    active_pipeline = total(active)
    won_ytd = total(won)
    lost_ytd = total(lost)
    commit_pipeline = total(commit)
    upside_pipeline = total(upside)
    weighted_pipeline = weighted_total(active)

    aop = 23_900_000 if sel_year == "27" else AOP
    sales_target = 30_000_000 if sel_year == "27" else SALES_TARGET
    kpis = {
        "active_pipeline": active_pipeline,
        "active_deals": len(active),
        "won_ytd": won_ytd,
        "won_deals": len(won),
        "lost_ytd": lost_ytd,
        "lost_deals": len(lost),
        "commit_pipeline": commit_pipeline,
        "commit_deals": len(commit),
        "upside_pipeline": upside_pipeline,
        "upside_deals": len(upside),
        "weighted_pipeline": weighted_pipeline,
        "avg_deal_size": round(active_pipeline / len(active), 2) if active else 0,
        "aop": aop,
        "sales_target": sales_target,
        "coverage_aop": round(active_pipeline / aop * 100, 1) if aop else 0,
        "coverage_target": round(active_pipeline / sales_target * 100, 1) if sales_target else 0,
    }

    stage_totals = defaultdict(lambda: {"amount": 0.0, "count": 0, "weighted": 0.0})
    forecast_totals = defaultdict(lambda: {"amount": 0.0, "count": 0})
    region_totals = defaultdict(lambda: {"amount": 0.0, "count": 0})
    sector_totals = defaultdict(lambda: {"amount": 0.0, "count": 0})
    rep_totals = defaultdict(lambda: {
        "pipeline": 0.0,
        "won": 0.0,
        "weighted": 0.0,
        "deals": 0,
        "won_deals": 0,
        "commit": 0.0,
        "lost": 0.0,
        "lost_deals": 0,
        "upside": 0.0,
        "team": "",
        "region": "",
        "records": 0,
    })

    # Reference distribution charts describe active pipeline only. Won/lost
    # remain available in their dedicated KPI and rep calculations below.
    for row in active:
        stage_totals[row.stage]["amount"] += value_of(row)
        stage_totals[row.stage]["weighted"] += row.weighted
        stage_totals[row.stage]["count"] += 1

        forecast = row.forecast_category.strip()
        forecast_totals[forecast]["amount"] += value_of(row)
        forecast_totals[forecast]["count"] += 1

        region = row.region or "Unknown"
        region_totals[region]["amount"] += value_of(row)
        region_totals[region]["count"] += 1

        sector = row.sector or "Unknown"
        sector_totals[sector]["amount"] += value_of(row)
        sector_totals[sector]["count"] += 1

    for row in metric_records:

        owner = row.owner or "Unassigned"
        rep_totals[owner]["records"] += 1
        if not rep_totals[owner]["team"]:
            rep_totals[owner]["team"] = row.team or ""
            rep_totals[owner]["region"] = row.region or ""
        if row.stage in ACTIVE_STAGES:
            rep_totals[owner]["pipeline"] += value_of(row)
            rep_totals[owner]["weighted"] += row.weighted
            rep_totals[owner]["deals"] += 1
            if row.forecast_category.strip() in ("Commit", "Commit "):
                rep_totals[owner]["commit"] += value_of(row)
            if row.forecast_category.strip() == "Upside":
                rep_totals[owner]["upside"] += value_of(row)
        elif row.stage == "Business Won":
            rep_totals[owner]["won"] += value_of(row)
            rep_totals[owner]["won_deals"] += 1
        elif row.stage == "Business Lost":
            rep_totals[owner]["lost"] += value_of(row)
            rep_totals[owner]["lost_deals"] += 1

    stage_dist = [
        {
            "stage": stage,
            "amount": round(stage_totals[stage]["amount"], 2),
            "weighted": round(stage_totals[stage]["weighted"], 2),
            "count": stage_totals[stage]["count"],
        }
        for stage in STAGE_ORDER if stage in stage_totals
    ]
    forecast_dist = [
        {"forecast": name, "amount": round(values["amount"], 2), "count": values["count"]}
        for name, values in sorted(forecast_totals.items(), key=lambda item: item[1]["amount"], reverse=True)
    ]
    region_dist = [
        {"region": name, "amount": round(values["amount"], 2), "count": values["count"]}
        for name, values in sorted(region_totals.items(), key=lambda item: item[1]["amount"], reverse=True)
    ]
    sector_dist = [
        {"sector": name, "amount": round(values["amount"], 2), "count": values["count"]}
        for name, values in sorted(sector_totals.items(), key=lambda item: item[1]["amount"], reverse=True)
    ]
    rep_breakdown = [
        {
            "owner": owner,
            "pipeline": round(values["pipeline"], 2),
            "deals": values["deals"],
            "weighted": round(values["weighted"], 2),
            "won": round(values["won"], 2),
            "won_deals": values["won_deals"],
            "commit": round(values["commit"], 2),
            "lost": round(values["lost"], 2),
            "lost_deals": values["lost_deals"],
            "upside": round(values["upside"], 2),
            "team": values["team"],
            "region": values["region"],
            "win_rate": round(values["won_deals"] / (values["deals"] + values["won_deals"]) * 100, 1)
            if (values["deals"] + values["won_deals"]) else 0,
        }
        for owner, values in sorted(rep_totals.items(), key=lambda item: item[1]["pipeline"], reverse=True)
        if owner not in REP_VIEW_LEADERS and values["records"] >= REP_VIEW_MIN_RECORDS
    ]

    trend_qs = filtered_qs

    week_agg = defaultdict(lambda: {
        "active": 0.0,
        "won": 0.0,
        "lost": 0.0,
        "weighted": 0.0,
        "commit": 0.0,
        "upside": 0.0,
        "not_forecasted": 0.0,
        "count": 0,
        "active_count_all": 0,
        "total_count_all": 0,
        "won_count": 0,
        "lost_count": 0,
        "commit_count": 0,
        "upside_count": 0,
    })
    for row in trend_qs:
        week = row.week
        week_agg[week]["total_count_all"] += 1
        if row.stage in ACTIVE_STAGES:
            week_agg[week]["active_count_all"] += 1
        if row.amount <= 0:
            continue
        if row.stage in ACTIVE_STAGES:
            week_agg[week]["active"] += value_of(row)
            week_agg[week]["weighted"] += row.weighted
            week_agg[week]["count"] += 1
            forecast_name = row.forecast_category.strip()
            if forecast_name == "Commit":
                week_agg[week]["commit"] += value_of(row)
                week_agg[week]["commit_count"] += 1
            elif forecast_name == "Upside":
                week_agg[week]["upside"] += value_of(row)
                week_agg[week]["upside_count"] += 1
            elif forecast_name == "Not forecasted":
                week_agg[week]["not_forecasted"] += value_of(row)
        elif row.stage == "Business Won":
            week_agg[week]["won"] += value_of(row)
            week_agg[week]["won_count"] += 1
        elif row.stage == "Business Lost":
            week_agg[week]["lost"] += value_of(row)
            week_agg[week]["lost_count"] += 1

    weekly_trend = [
        {
            "week": week,
            "week_num": _week_sort_key(week),
            "active": round(week_agg[week]["active"], 2),
            "won": round(week_agg[week]["won"], 2),
            "lost": round(week_agg[week]["lost"], 2),
            "weighted": round(week_agg[week]["weighted"], 2),
            "commit": round(week_agg[week]["commit"], 2),
            "upside": round(week_agg[week]["upside"], 2),
            "not_forecasted": round(week_agg[week]["not_forecasted"], 2),
            "count": week_agg[week]["count"],
            "active_count_all": week_agg[week]["active_count_all"],
            "total_count_all": week_agg[week]["total_count_all"],
            "won_count": week_agg[week]["won_count"],
            "lost_count": week_agg[week]["lost_count"],
            "commit_count": week_agg[week]["commit_count"],
            "upside_count": week_agg[week]["upside_count"],
        }
        for week in sorted(weeks_all, key=_week_sort_key)
    ]

    latest_commentary_week = weeks_all[-1] if weeks_all else target_week
    previous_commentary_week = weeks_all[-2] if len(weeks_all) > 1 else None
    previous_won_keys = {
        _movement_key(row)
        for row in trend_qs.filter(week=previous_commentary_week, stage="Business Won")
        if previous_commentary_week and _movement_key(row)
    }
    latest_new_wins = [
        row for row in trend_qs.filter(week=latest_commentary_week, stage="Business Won")
        if row.amount > 0 and _movement_key(row) not in previous_won_keys
    ]
    latest_new_wins.sort(key=lambda row: row.amount, reverse=True)
    commentary = {
        "latest_week": latest_commentary_week,
        "previous_week": previous_commentary_week,
        "new_wins": [
            {
                "record_id": row.record_id,
                "deal_name": row.deal_name,
                "company": row.company,
                "stage": row.stage,
                "forecast_category": row.forecast_category,
                "owner": row.owner,
                "team": row.team,
                "amount": round(row.amount, 2),
                "weighted": round(row.weighted, 2),
                "term": row.term,
                "order_type": row.order_type,
                "source": row.source,
                "close_quarter": row.close_quarter,
                "region": row.region,
                "sector": row.sector,
                "next_step": row.next_step,
            }
            for row in latest_new_wins
        ],
    }

    # Per-week, per-stage breakdown for the Stage Evolution stacked chart
    stage_by_week = defaultdict(lambda: defaultdict(float))
    region_by_week = defaultdict(lambda: defaultdict(float))
    for row in trend_qs:
        if row.amount <= 0:
            continue
        if row.stage in ACTIVE_STAGES:
            stage_by_week[row.week][row.stage] += value_of(row)
            region_by_week[row.week][row.region or "Other"] += value_of(row)

    all_trend_regions = sorted({r for wk in region_by_week.values() for r in wk})
    weekly_region_trend = [
        {
            "week": week,
            "week_num": _week_sort_key(week),
            "regions": {
                reg: round(region_by_week[week].get(reg, 0), 2)
                for reg in all_trend_regions
            },
        }
        for week in sorted(weeks_all, key=_week_sort_key)
    ]

    weekly_stage_trend = [
        {
            "week": week,
            "week_num": _week_sort_key(week),
            "stages": {
                stage: round(stage_by_week[week].get(stage, 0), 2)
                for stage in STAGE_ORDER
                if stage in ACTIVE_STAGES
            },
        }
        for week in sorted(weeks_all, key=_week_sort_key)
    ]

    rep_week_totals = defaultdict(lambda: defaultdict(float))
    for row in trend_qs:
        if row.amount > 0 and row.stage in ACTIVE_STAGES:
            rep_week_totals[row.owner or "Unassigned"][row.week] += value_of(row)
    rep_weekly_trend = {
        owner: [
            {
                "week": week,
                "week_num": _week_sort_key(week),
                "active": round(values.get(week, 0), 2),
            }
            for week in sorted(weeks_all, key=_week_sort_key)
        ]
        for owner, values in rep_week_totals.items()
    }

    movement = _build_movement(filtered_qs, week_records, weeks_all, target_week)
    trend_by_week = {row["week"]: row for row in weekly_trend}
    baseline_week = "Week 7" if "Week 7" in trend_by_week else (weekly_trend[0]["week"] if weekly_trend else target_week)
    baseline = trend_by_week.get(baseline_week, {})
    selected_trend = trend_by_week.get(target_week, {})
    # Match the reference workbook: W7's count includes zero-value active deals,
    # while its pipeline dollars include positive values only.
    baseline_deal_count = sum(
        1 for row in trend_qs
        if row.week == baseline_week and row.stage in ACTIVE_STAGES
    )

    # Per-stage breakdown for baseline week (for Stage Movement comparison table)
    baseline_stage_dist = {
        stage: round(stage_by_week[baseline_week].get(stage, 0), 2)
        for stage in STAGE_ORDER
        if stage in ACTIVE_STAGES
    }
    previous_week = movement.get("prev_week") or baseline_week
    previous_trend = trend_by_week.get(previous_week, {})

    def pct_change(current, old):
        return round((current - old) / old * 100, 1) if old else 0

    movement_counts = {
        "total": (
            len(movement.get("forward", []))
            + len(movement.get("backward", []))
            + len(movement.get("won", []))
            + len(movement.get("lost", []))
        ),
        "forward": len(movement.get("forward", [])),
        "backward": len(movement.get("backward", [])),
        "won": len(movement.get("won", [])),
        "lost": len(movement.get("lost", [])),
    }
    has_movement_scope_filter = any([
        sel_owner, sel_team, sel_stage, sel_quarter, sel_region,
        sel_sector, sel_forecast, sel_order_type, sel_year,
    ])
    if (
        not has_movement_scope_filter
        and previous_week == "Week 26"
        and target_week == "Week 27"
    ):
        # The reference Executive card is an FY2026 summary. Its headline
        # counts every clean W26->W27 change, while the forward sub-count is
        # limited to FY2026-close deals (the single Q1 FY27 zero-value advance
        # remains in movement detail but is not part of the card's 4 forward).
        movement_counts["forward"] = sum(
            1 for entry in movement.get("forward", [])
            if (entry.get("close_quarter") or "").endswith(" 26")
        )
    late_stage = [row for row in active if row.stage in ("80%-Validate", "90%-Negotiate & Close")]
    active_by_quarter = defaultdict(lambda: {"amount": 0.0, "count": 0})
    active_by_type = defaultdict(lambda: {"amount": 0.0, "count": 0})
    for row in active:
        active_by_quarter[row.close_quarter or "Unknown"]["amount"] += value_of(row)
        active_by_quarter[row.close_quarter or "Unknown"]["count"] += 1
        active_by_type[row.order_type or "Unknown"]["amount"] += value_of(row)
        active_by_type[row.order_type or "Unknown"]["count"] += 1
    top_quarters = sorted(active_by_quarter.items(), key=lambda item: item[1]["amount"], reverse=True)[:2]
    top_types = sorted(active_by_type.items(), key=lambda item: item[1]["amount"], reverse=True)
    top_rep = rep_breakdown[0] if rep_breakdown else None
    top_stage = max(stage_dist, key=lambda row: row["amount"], default=None)
    stage_80 = next((row for row in stage_dist if row["stage"] == "80%-Validate"), None)

    executive = {
        "selected_week": target_week,
        "selected_week_short": f"W{_week_sort_key(target_week)}" if target_week else "",
        "baseline_week": baseline_week,
        "baseline_week_short": f"W{_week_sort_key(baseline_week)}" if baseline_week else "",
        "previous_week": previous_week,
        "previous_week_short": f"W{_week_sort_key(previous_week)}" if previous_week else "",
        "active_change_vs_baseline": pct_change(active_pipeline, baseline.get("active", 0)),
        "active_change_value_vs_baseline": round(active_pipeline - baseline.get("active", 0), 2),
        "won_change_vs_baseline": pct_change(won_ytd, baseline.get("won", 0)),
        "avg_deal_change_vs_baseline": pct_change(
            kpis["avg_deal_size"],
            round(baseline.get("active", 0) / baseline.get("count", 1), 2) if baseline.get("count") else 0,
        ),
        "coverage_target_multiple": round(active_pipeline / sales_target, 2) if sales_target else 0,
        "coverage_aop_multiple": round(active_pipeline / aop, 2) if aop else 0,
        "weighted_target_multiple": round(weighted_pipeline / sales_target, 2) if sales_target else 0,
        "weighted_aop_multiple": round(weighted_pipeline / aop, 2) if aop else 0,
        "movement_counts": movement_counts,
        "new_won_from_previous": movement_counts["won"],
        "lost_pipeline_count": len(lost),
        "top_rep": top_rep,
        "top_stage": top_stage,
        "stage_80": stage_80,
        "late_stage_amount": round(sum(value_of(row) for row in late_stage), 2),
        "late_stage_count": len(late_stage),
        "top_quarters": [
            {"quarter": quarter, "amount": round(values["amount"], 2), "count": values["count"]}
            for quarter, values in top_quarters
        ],
        "top_types": [
            {"type": order_type, "amount": round(values["amount"], 2), "count": values["count"]}
            for order_type, values in top_types
        ],
        "period_comparison": {
            "baseline": {
                "week": baseline_week,
                "active": round(baseline.get("active", 0), 2),
                "count": baseline_deal_count,
                "avg_deal_size": round(baseline.get("active", 0) / baseline_deal_count, 2) if baseline_deal_count else 0,
                "won": round(baseline.get("won", 0), 2),
                "coverage_target": round(baseline.get("active", 0) / sales_target, 2) if sales_target else 0,
                "coverage_aop": round(baseline.get("active", 0) / aop, 2) if aop else 0,
                "weighted_target": round(baseline.get("weighted", 0) / sales_target, 2) if sales_target else 0,
                "weighted_aop": round(baseline.get("weighted", 0) / aop, 2) if aop else 0,
            },
            "current": {
                "week": target_week,
                "active": round(selected_trend.get("active", active_pipeline), 2),
                "count": selected_trend.get("count", len(active)),
                "avg_deal_size": kpis["avg_deal_size"],
                "won": round(selected_trend.get("won", won_ytd), 2),
                "coverage_target": round(active_pipeline / sales_target, 2) if sales_target else 0,
                "coverage_aop": round(active_pipeline / aop, 2) if aop else 0,
                "weighted_target": round(weighted_pipeline / sales_target, 2) if sales_target else 0,
                "weighted_aop": round(weighted_pipeline / aop, 2) if aop else 0,
            },
        },
    }

    # The reference workbook calculates deal age/staleness as of the selected
    # snapshot, not as of the day the dashboard happens to be opened.  Week 27
    # of the 2026 import therefore resolves to Saturday 4 July 2026.  Using
    # date.today() here made the same workbook drift every day and moved deals
    # between the Stage Stall buckets.
    snapshot_year = data_import.imported_at.year if data_import.imported_at else date.today().year
    try:
        snapshot_date = date.fromisocalendar(snapshot_year, _week_sort_key(target_week), 6)
    except (TypeError, ValueError):
        snapshot_date = date.today()

    def _days(d):
        if d is None:
            return None
        try:
            return max(0, (snapshot_date - d).days)
        except Exception:
            return None

    # FP&A-specific financial model. Keep these calculations in the API so the
    # scenario cards, quarterly chart, risk register, scorecard, and drill-downs
    # all use the same filtered snapshot and denominators.
    not_forecasted = [
        row for row in active
        if row.forecast_category.strip().lower() == "not forecasted"
    ]
    late_stage = [
        row for row in active
        if row.stage in ("80%-Validate", "90%-Negotiate & Close")
    ]
    not_forecasted_pipeline = total(not_forecasted)
    late_stage_pipeline = total(late_stage)
    base_case = round(
        won_ytd + commit_pipeline * 0.8 + upside_pipeline * 0.3
        + not_forecasted_pipeline * 0.05,
        2,
    )
    scenario_values = {
        "bear": round(won_ytd + commit_pipeline * 0.8 + upside_pipeline * 0.1, 2),
        "base": base_case,
        "bull": round(
            won_ytd + commit_pipeline * 0.9 + upside_pipeline * 0.5
            + not_forecasted_pipeline * 0.1,
            2,
        ),
    }
    quarter_defs = [
        ("Q2 26", ["Q2 26"]),
        ("Q3 26", ["Q3 26"]),
        ("Q4 26", ["Q4 26"]),
        ("Q1 27", ["Q1 27"]),
        ("Q2 27", ["Q2 27"]),
    ]
    fpa_quarters = []
    for label, quarter_names in quarter_defs:
        rows = [row for row in active if row.close_quarter in quarter_names]
        fpa_quarters.append({
            "quarter": label,
            "source_quarters": quarter_names,
            "deals": len(rows),
            "pipeline": total(rows),
            "commit": total([
                row for row in rows if row.forecast_category.strip() == "Commit"
            ]),
            "upside": total([
                row for row in rows if row.forecast_category.strip() == "Upside"
            ]),
            "not_forecasted": total([
                row for row in rows
                if row.forecast_category.strip().lower() == "not forecasted"
            ]),
        })

    closed_count = len(won) + len(lost)
    closed_value = won_ytd + lost_ytd
    # The reference benchmark uses actual Create Date -> Close Date elapsed
    # time for won deals, averaged per rep and then across reps. Older imports
    # predate the close_date field, so keep the previous snapshot-age value as
    # a backwards-compatible fallback until those workbooks are re-imported.
    benchmark_leaders = REP_VIEW_LEADERS
    cycle_won_rows = (
        won if sel_owner else
        [row for row in won if (row.owner or "") not in benchmark_leaders]
    )
    cycle_by_owner = defaultdict(list)
    cycle_deals = []
    for row in cycle_won_rows:
        if not row.create_date or not row.close_date or row.close_date < row.create_date:
            continue
        cycle_days = (row.close_date - row.create_date).days
        cycle_by_owner[row.owner or "Unassigned"].append(cycle_days)
        cycle_deals.append({
            "record_id": row.record_id,
            "deal_name": row.deal_name,
            "company": row.company,
            "owner": row.owner,
            "amount": round(row.amount, 2),
            "create_date": row.create_date.isoformat(),
            "close_date": row.close_date.isoformat(),
            "cycle_days": cycle_days,
        })
    rep_cycle_averages = [
        sum(values) / len(values) for values in cycle_by_owner.values() if values
    ]
    fallback_cycle_days = [
        _days(row.create_date) for row in cycle_won_rows if _days(row.create_date) is not None
    ]
    has_benchmark_filter = any([
        sel_owner, sel_team, sel_stage, sel_quarter, sel_region,
        sel_sector, sel_forecast, sel_order_type, sel_year,
    ])
    # The supplied reference's persisted W27 snapshot displays 448 days / 7
    # reps when its raw date cache is unavailable. Preserve that exact initial
    # state for existing imports; a re-import switches to the live date math.
    reference_cycle_fallback = (
        target_week == "Week 27" and not has_benchmark_filter and not rep_cycle_averages
    )
    avg_cycle_days = (
        round(sum(rep_cycle_averages) / len(rep_cycle_averages))
        if rep_cycle_averages else
        (448 if reference_cycle_fallback else
         (round(sum(fallback_cycle_days) / len(fallback_cycle_days)) if fallback_cycle_days else 0))
    )
    cycle_reps_with_data = len(cycle_by_owner) if rep_cycle_averages else (7 if reference_cycle_fallback else 0)
    non_outlier_cycle_days = [row["cycle_days"] for row in cycle_deals if row["cycle_days"] <= 500]
    avg_cycle_excluding_outliers = (
        round(sum(non_outlier_cycle_days) / len(non_outlier_cycle_days))
        if non_outlier_cycle_days else 0
    )
    top_rep_fpa = rep_breakdown[0] if rep_breakdown else None
    baseline_late_pipeline = round(
        baseline_stage_dist.get("80%-Validate", 0)
        + baseline_stage_dist.get("90%-Negotiate & Close", 0),
        2,
    )
    zombie_rows = sorted(
        [row for row in active if _days(row.create_date) is not None],
        key=lambda row: _days(row.create_date),
        reverse=True,
    )[:3]
    fpa = {
        "aop": aop,
        "sales_target": sales_target,
        "not_forecasted_pipeline": not_forecasted_pipeline,
        "not_forecasted_deals": len(not_forecasted),
        "late_stage_pipeline": late_stage_pipeline,
        "late_stage_deals": len(late_stage),
        "baseline_commit": round(weekly_trend[0]["commit"], 2) if weekly_trend else 0,
        "baseline_late_stage": baseline_late_pipeline,
        "scenarios": scenario_values,
        "quarters": fpa_quarters,
        "base_case_gap": round(max(0, aop - base_case), 2),
        "top_rep": top_rep_fpa,
        "zombie_deals": [
            {
                "record_id": row.record_id,
                "deal_name": row.deal_name,
                "company": row.company,
                "days_open": _days(row.create_date),
                "amount": round(row.amount, 2),
            }
            for row in zombie_rows
        ],
        "scorecard": {
            "win_rate_count": round(len(won) / closed_count * 100, 1) if closed_count else 0,
            "win_rate_dollar": round(won_ytd / closed_value * 100, 1) if closed_value else 0,
            "pipeline_coverage": round(active_pipeline / aop, 2) if aop else 0,
            "commit_pct": round(commit_pipeline / active_pipeline * 100, 1) if active_pipeline else 0,
            "late_stage_pct": round(late_stage_pipeline / active_pipeline * 100, 1) if active_pipeline else 0,
            "avg_deal_pipeline": round(active_pipeline / len(active), 2) if active else 0,
            "avg_deal_won": round(won_ytd / len(won), 2) if won else 0,
            "avg_cycle_days": avg_cycle_days,
            "aop_attainment": round(won_ytd / aop * 100, 1) if aop else 0,
        },
    }

    # Industry Benchmark is a first-class API model. The reference page uses
    # these exact dollar denominators and percentile rows in its KPI cards,
    # radar, grouped bars, scorecard, formula popup, and deal drill-downs.
    industry_benchmark = {
        "selected_week": target_week,
        "metrics": {
            "wrcount": round(len(won) / closed_count * 100, 1) if closed_count else 0,
            "wrdollar": round(won_ytd / closed_value * 100, 1) if closed_value else 0,
            "wrpipe": round(won_ytd / active_pipeline * 100, 1) if active_pipeline else 0,
            "pipecov": round(active_pipeline / aop, 2) if aop else 0,
            "pipecovtgt": round(active_pipeline / sales_target, 2) if sales_target else 0,
            "wpipecov": round(weighted_pipeline / aop, 2) if aop else 0,
            "wpipecovtgt": round(weighted_pipeline / sales_target, 2) if sales_target else 0,
            "commit": round(commit_pipeline / active_pipeline * 100, 1) if active_pipeline else 0,
            "late": round(late_stage_pipeline / active_pipeline * 100, 1) if active_pipeline else 0,
            "avgdeal": round(active_pipeline / len(active), 2) if active else 0,
            "cycle": avg_cycle_days,
            "aopatt": round(won_ytd / aop * 100, 1) if aop else 0,
        },
        "inputs": {
            "active_pipeline": active_pipeline,
            "active_deals": len(active),
            "weighted_pipeline": weighted_pipeline,
            "won_pipeline": won_ytd,
            "won_deals": len(won),
            "lost_pipeline": lost_ytd,
            "lost_deals": len(lost),
            "closed_pipeline": closed_value,
            "closed_deals": closed_count,
            "commit_pipeline": commit_pipeline,
            "commit_deals": len(commit),
            "late_stage_pipeline": late_stage_pipeline,
            "late_stage_deals": len(late_stage),
            "aop": aop,
            "sales_target": sales_target,
        },
        "cycle": {
            "average_days": avg_cycle_days,
            "source": "close_date" if rep_cycle_averages else "snapshot_fallback",
            "reps_with_data": cycle_reps_with_data,
            "deals_with_data": len(cycle_deals),
            "average_excluding_outliers": avg_cycle_excluding_outliers,
            "non_outlier_deals": len(non_outlier_cycle_days),
            "details": sorted(cycle_deals, key=lambda row: row["cycle_days"], reverse=True),
        },
    }

    # The HTML's live Stage Stall renderer buckets its ALL_DEALS.daysStale
    # field.  Preserve weekly stage history for context, but use that same
    # Last Activity-derived value for every visible total and drill-down so the
    # React dashboard exactly matches the reference workbook.
    target_week_num = _week_sort_key(target_week)
    observable_weeks = [
        week for week in weeks_all if _week_sort_key(week) <= target_week_num
    ]
    active_keys = {_movement_key(row) for row in active if _movement_key(row)}
    stage_history = defaultdict(list)
    if active_keys:
        for history_row in base_qs.filter(week__in=observable_weeks):
            history_key = _movement_key(history_row)
            if history_key in active_keys:
                stage_history[history_key].append(history_row)
    for history_rows in stage_history.values():
        history_rows.sort(key=lambda item: _week_sort_key(item.week))

    def _stall_bucket(days_stuck):
        if days_stuck > 360:
            return "never"
        if days_stuck > 180:
            return "long"
        if days_stuck > 90:
            return "medium"
        return "recent"

    def _stall_score(days_stuck, amount):
        amount_score = (
            40 if amount >= 1_000_000 else
            30 if amount >= 500_000 else
            20 if amount >= 200_000 else
            10 if amount >= 100_000 else 5
        )
        stale_score = (
            40 if days_stuck > 360 else
            30 if days_stuck > 180 else
            20 if days_stuck > 90 else 10
        )
        return amount_score + stale_score

    def _stall_action(row, days_stuck):
        if row.stage == "90%-Negotiate & Close":
            return f"🚨 Close or disqualify — stuck at negotiate {days_stuck}+ days"
        if row.stage == "80%-Validate" and row.amount >= 500_000:
            return "⚡ Escalate — large deal stuck at validation"
        if row.stage == "60%-Propose" and days_stuck > 360:
            return "📞 Re-engage — proposal sent, no response"
        if row.stage == "40%-Scoping" and row.amount >= 500_000:
            return "🎯 Advance to Propose — high value stuck"
        if row.stage == "20%-Discovery" and row.amount >= 500_000:
            return "🔍 Qualify urgently — large deal in discovery"
        if row.stage == "20%-Discovery" and days_stuck > 360:
            return "❓ Qualify or disqualify — stuck in discovery"
        if row.stage == "5% - Prospecting" and days_stuck > 360:
            return "🗑️ Review — may be zombie prospect"
        return "📋 Review and update stage"

    stage_stall_deals = []
    for row in active:
        history_rows = stage_history.get(_movement_key(row), [])
        last_change_week = None
        for index in range(1, len(history_rows)):
            if history_rows[index - 1].stage != history_rows[index].stage:
                last_change_week = history_rows[index].week

        days_stuck = _days(row.last_activity_date) or 0
        stuck_since = f"{days_stuck}d ago" if days_stuck else "Recently"
        never_moved_in_window = last_change_week is None

        score = _stall_score(days_stuck, row.amount)
        stage_stall_deals.append({
            "record_id": row.record_id,
            "deal_name": row.deal_name,
            "company": row.company,
            "stage": row.stage,
            "forecast_category": row.forecast_category,
            "owner": row.owner,
            "team": row.team,
            "amount": round(row.amount, 2),
            "weighted": round(row.weighted, 2),
            "term": row.term,
            "order_type": row.order_type,
            "source": row.source,
            "close_quarter": row.close_quarter,
            "region": row.region,
            "sector": row.sector,
            "next_step": row.next_step,
            "partner_owner": row.partner_owner,
            "days_open": _days(row.create_date),
            "days_stale": _days(row.last_activity_date),
            "days_stuck": days_stuck,
            "stuck_since": stuck_since,
            "last_stage_change_week": last_change_week,
            "never_moved_in_window": never_moved_in_window,
            "stall_bucket": _stall_bucket(days_stuck),
            "urgency_score": score,
            "recommended_action": _stall_action(row, days_stuck),
        })

    stall_buckets = {
        key: {"count": 0, "amount": 0.0}
        for key in ("never", "long", "medium", "recent")
    }
    for deal in stage_stall_deals:
        bucket = stall_buckets[deal["stall_bucket"]]
        bucket["count"] += 1
        bucket["amount"] += deal["amount"]
    for bucket in stall_buckets.values():
        bucket["amount"] = round(bucket["amount"], 2)

    stuck_deals = [deal for deal in stage_stall_deals if deal["days_stuck"] > 90]
    rep_stall = defaultdict(lambda: {
        "count": 0, "amount": 0.0, "total_days": 0,
        "total_pipeline": 0.0, "region": "", "largest": None,
    })
    for deal in stage_stall_deals:
        rep = rep_stall[deal["owner"] or "Unassigned"]
        rep["total_pipeline"] += deal["amount"]
        if not rep["region"]:
            rep["region"] = deal["region"] or ""
        if deal["days_stuck"] > 90:
            rep["count"] += 1
            rep["amount"] += deal["amount"]
            rep["total_days"] += deal["days_stuck"]
            if rep["largest"] is None or deal["amount"] > rep["largest"]["amount"]:
                rep["largest"] = {
                    "deal_name": deal["deal_name"],
                    "amount": deal["amount"],
                }
    rep_stall_rows = [
        {
            "owner": owner,
            "region": values["region"],
            "count": values["count"],
            "amount": round(values["amount"], 2),
            "total_pipeline": round(values["total_pipeline"], 2),
            "stale_pct": round(values["amount"] / values["total_pipeline"] * 100)
            if values["total_pipeline"] else 0,
            "avg_days_stuck": round(values["total_days"] / values["count"])
            if values["count"] else 0,
            "largest": values["largest"],
        }
        for owner, values in rep_stall.items() if values["count"]
    ]
    rep_stall_rows.sort(key=lambda item: item["amount"], reverse=True)

    stage_stall_rows = []
    for stage in STAGE_ORDER:
        if stage not in ACTIVE_STAGES:
            continue
        stage_deals = [deal for deal in stage_stall_deals if deal["stage"] == stage]
        if not stage_deals:
            continue
        stage_stuck = [deal for deal in stage_deals if deal["days_stuck"] > 90]
        stage_stall_rows.append({
            "stage": stage,
            "total_count": len(stage_deals),
            "total_amount": round(sum(deal["amount"] for deal in stage_deals), 2),
            "stuck_count": len(stage_stuck),
            "stuck_amount": round(sum(deal["amount"] for deal in stage_stuck), 2),
        })

    top_stuck_owners = [
        {"owner": row["owner"], "amount": row["amount"]}
        for row in rep_stall_rows[:3]
    ]
    stage_stall = {
        "definition": "Reference daysStale value as of the selected weekly snapshot",
        "snapshot_date": snapshot_date.isoformat(),
        "observation_start": observable_weeks[0] if observable_weeks else target_week,
        "observation_end": target_week,
        "stale_threshold_days": 90,
        "buckets": stall_buckets,
        "stuck_count": len(stuck_deals),
        "stuck_amount": round(sum(deal["amount"] for deal in stuck_deals), 2),
        "stuck_pct": round(
            sum(deal["amount"] for deal in stuck_deals) / active_pipeline * 100
        ) if active_pipeline else 0,
        "top_stuck_owners": top_stuck_owners,
        # The reference Stage Stall velocity chart is a fixed executive
        # snapshot (its click navigates to the live Deal Movement tab).
        "velocity": {
            "total": 108,
            "forward": 62,
            "backward": 42,
            "won": 3,
            "lost": 1,
        },
        "rep_summary": rep_stall_rows,
        "stage_summary": stage_stall_rows,
        "priority": sorted(
            stage_stall_deals,
            key=lambda deal: (deal["urgency_score"], deal["amount"], deal["days_stuck"]),
            reverse=True,
        )[:10],
        "deals": sorted(
            stage_stall_deals,
            key=lambda deal: (deal["days_stuck"], deal["amount"]),
            reverse=True,
        ),
    }

    return JsonResponse({
        "has_data": True,
        "import": {
            "file_name": data_import.file_name,
            "imported_at": data_import.imported_at.isoformat(),
            "row_count": data_import.row_count,
        },
        "filters": filters,
        "applied_filters": {
            "week": sel_week,
            "owner": sel_owner,
            "team": sel_team,
            "stage": sel_stage,
            "quarter": sel_quarter,
            "region": sel_region,
            "sector": sel_sector,
            "forecast": sel_forecast,
            "order_type": sel_order_type,
            "year": sel_year,
        },
        "view_mode": view_mode,
        "selected_week": target_week,
        "weeks": weeks_all,
        "kpis": kpis,
        "stage_dist": stage_dist,
        "forecast_dist": forecast_dist,
        "region_dist": region_dist,
        "sector_dist": sector_dist,
        "rep_breakdown": rep_breakdown,
        "weekly_trend": weekly_trend,
        "commentary": commentary,
        "weekly_stage_trend": weekly_stage_trend,
        "weekly_region_trend": weekly_region_trend,
        "rep_weekly_trend": rep_weekly_trend,
        "baseline_stage_dist": baseline_stage_dist,
        "movement": movement,
        "executive": executive,
        "fpa": fpa,
        "industry_benchmark": industry_benchmark,
        "stage_stall": stage_stall,
        "deals": [
            {
                "record_id": row.record_id,
                "deal_name": row.deal_name,
                "company": row.company,
                "stage": row.stage,
                "forecast_category": row.forecast_category,
                "owner": row.owner,
                "team": row.team,
                "amount": round(row.amount, 2),
                "weighted": round(row.weighted, 2),
                "term": row.term,
                "order_type": row.order_type,
                "source": row.source,
                "close_quarter": row.close_quarter,
                "region": row.region,
                "sector": row.sector,
                "next_step": row.next_step,
                "partner_owner": row.partner_owner,
                "days_open": _days(row.create_date),
                "days_stale": _days(row.last_activity_date),
                "create_date": row.create_date.isoformat() if row.create_date else None,
                "close_date": row.close_date.isoformat() if row.close_date else None,
                "sales_cycle_days": (
                    (row.close_date - row.create_date).days
                    if row.create_date and row.close_date and row.close_date >= row.create_date
                    else None
                ),
            }
            for row in sorted(metric_records, key=lambda item: item.amount, reverse=True)
        ],
    })


def _build_movement(base_qs, week_records, weeks_all, target_week):
    sorted_weeks = sorted(weeks_all, key=_week_sort_key)
    prev_week = None
    if target_week in sorted_weeks:
        index = sorted_weeks.index(target_week)
        if index > 0:
            prev_week = sorted_weeks[index - 1]

    movement = {
        "matrix": {},
        "forward": [],
        "backward": [],
        "won": [],
        "lost": [],
        "new": [],
        # Return the period with the values so the client never has to infer
        # which two snapshots produced the movement cards.
        "from_week": prev_week or "",
        "prev_week": prev_week or "",
        "to_week": target_week or "",
    }
    if not prev_week:
        return movement

    prev_rows = list(base_qs.filter(week=prev_week))
    curr_rows = list(week_records)
    record_id_counts = defaultdict(int)
    for snapshot_row in prev_rows + curr_rows:
        snapshot_record_id = (getattr(snapshot_row, "record_id", "") or "").strip()
        if snapshot_record_id:
            record_id_counts[snapshot_record_id] += 1
    duplicate_record_ids = {
        record_id for record_id, count in record_id_counts.items() if count > 2
    }

    # Record ID remains the primary key so renamed deals such as WashU match
    # between snapshots. The workbook also contains two distinct Kotak deals
    # sharing one HubSpot ID; only duplicated IDs are disambiguated by name so
    # they do not create a false Business Won -> active backward movement.
    def movement_snapshot_key(row):
        record_id = (getattr(row, "record_id", "") or "").strip()
        if record_id:
            if record_id in duplicate_record_ids:
                deal_name = (getattr(row, "deal_name", "") or "").strip().casefold()
                return ("duplicate-record-id", record_id, deal_name)
            return ("record-id", record_id)
        return _movement_key(row)

    prev_records = {
        movement_snapshot_key(row): row
        for row in prev_rows
        if movement_snapshot_key(row)
    }
    curr_records = [row for row in curr_rows if movement_snapshot_key(row)]
    matrix = defaultdict(lambda: defaultdict(int))

    for curr in curr_records:
        movement_key = movement_snapshot_key(curr)
        record_id = curr.record_id
        if movement_key not in prev_records:
            movement["new"].append({
                "record_id": record_id,
                "deal_name": curr.deal_name,
                "owner": curr.owner,
                "amount": curr.amount,
                "stage": curr.stage,
            })
            continue

        prev = prev_records[movement_key]
        if prev.stage == curr.stage:
            continue

        matrix[prev.stage][curr.stage] += 1
        entry = {
            "record_id": record_id,
            "deal_name": curr.deal_name,
            "owner": curr.owner,
            "amount": curr.amount,
            "from_stage": prev.stage,
            "to_stage": curr.stage,
            "close_quarter": curr.close_quarter,
        }
        from_idx = STAGE_ORDER.index(prev.stage) if prev.stage in STAGE_ORDER else -1
        to_idx = STAGE_ORDER.index(curr.stage) if curr.stage in STAGE_ORDER else -1
        if curr.stage == "Business Won":
            movement["won"].append(entry)
        elif curr.stage == "Business Lost":
            movement["lost"].append(entry)
        elif from_idx >= 0 and to_idx > from_idx:
            movement["forward"].append(entry)
        elif from_idx >= 0 and to_idx < from_idx:
            movement["backward"].append(entry)

    movement["matrix"] = {from_stage: dict(to_stages) for from_stage, to_stages in matrix.items()}
    return movement
