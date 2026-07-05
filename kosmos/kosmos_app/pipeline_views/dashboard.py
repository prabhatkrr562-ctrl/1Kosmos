from collections import defaultdict
from datetime import date

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import PipelineImport
from .shared import ACTIVE_STAGES, AOP, SALES_TARGET, STAGE_ORDER, _week_sort_key


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
    }

    sel_week = request.GET.get("week", "").strip()
    sel_owner = request.GET.get("owner", "").strip()
    sel_team = request.GET.get("team", "").strip()
    sel_stage = request.GET.get("stage", "").strip()
    sel_quarter = request.GET.get("quarter", "").strip()
    sel_region = request.GET.get("region", "").strip()
    sel_sector = request.GET.get("sector", "").strip()

    latest_week = weeks_all[-1] if weeks_all else ""
    target_week = sel_week if sel_week in weeks_all else latest_week

    week_qs = base_qs.filter(week=target_week)
    if sel_owner:
        week_qs = week_qs.filter(owner=sel_owner)
    if sel_team:
        week_qs = week_qs.filter(team=sel_team)
    if sel_stage:
        week_qs = week_qs.filter(stage=sel_stage)
    if sel_quarter:
        week_qs = week_qs.filter(close_quarter=sel_quarter)
    if sel_region:
        week_qs = week_qs.filter(region=sel_region)
    if sel_sector:
        week_qs = week_qs.filter(sector=sel_sector)

    week_records = list(week_qs)

    active = [row for row in week_records if row.stage in ACTIVE_STAGES]
    won = [
        row for row in week_records
        if row.stage == "Business Won" or row.forecast_category in ("Closed won", "closed won")
    ]
    lost = [row for row in week_records if row.stage == "Business Lost"]
    commit = [
        row for row in week_records
        if row.forecast_category in ("Commit", "Commit ") and row.stage in ACTIVE_STAGES
    ]
    upside = [
        row for row in week_records
        if row.forecast_category == "Upside" and row.stage in ACTIVE_STAGES
    ]

    def total(rows):
        return round(sum(row.amount for row in rows), 2)

    def weighted_total(rows):
        return round(sum(row.weighted for row in rows), 2)

    active_pipeline = total(active)
    won_ytd = total(won)
    lost_ytd = total(lost)
    commit_pipeline = total(commit)
    upside_pipeline = total(upside)
    weighted_pipeline = weighted_total(active)

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
        "aop": AOP,
        "sales_target": SALES_TARGET,
        "coverage_aop": round(active_pipeline / AOP * 100, 1) if AOP else 0,
        "coverage_target": round(active_pipeline / SALES_TARGET * 100, 1) if SALES_TARGET else 0,
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
    })

    for row in week_records:
        stage_totals[row.stage]["amount"] += row.amount
        stage_totals[row.stage]["weighted"] += row.weighted
        stage_totals[row.stage]["count"] += 1

        forecast = row.forecast_category.strip()
        forecast_totals[forecast]["amount"] += row.amount
        forecast_totals[forecast]["count"] += 1

        region = row.region or "Unknown"
        region_totals[region]["amount"] += row.amount
        region_totals[region]["count"] += 1

        sector = row.sector or "Unknown"
        sector_totals[sector]["amount"] += row.amount
        sector_totals[sector]["count"] += 1

        owner = row.owner or "Unassigned"
        if not rep_totals[owner]["team"]:
            rep_totals[owner]["team"] = row.team or ""
            rep_totals[owner]["region"] = row.region or ""
        if row.stage in ACTIVE_STAGES:
            rep_totals[owner]["pipeline"] += row.amount
            rep_totals[owner]["weighted"] += row.weighted
            rep_totals[owner]["deals"] += 1
            if row.forecast_category.strip() in ("Commit", "Commit "):
                rep_totals[owner]["commit"] += row.amount
            if row.forecast_category.strip() == "Upside":
                rep_totals[owner]["upside"] += row.amount
        elif row.stage == "Business Won":
            rep_totals[owner]["won"] += row.amount
            rep_totals[owner]["won_deals"] += 1
        elif row.stage == "Business Lost":
            rep_totals[owner]["lost"] += row.amount
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
    ]

    trend_qs = base_qs
    if sel_owner:
        trend_qs = trend_qs.filter(owner=sel_owner)
    if sel_team:
        trend_qs = trend_qs.filter(team=sel_team)
    if sel_quarter:
        trend_qs = trend_qs.filter(close_quarter=sel_quarter)
    if sel_region:
        trend_qs = trend_qs.filter(region=sel_region)

    week_agg = defaultdict(lambda: {
        "active": 0.0,
        "won": 0.0,
        "lost": 0.0,
        "weighted": 0.0,
        "commit": 0.0,
        "count": 0,
    })
    for row in trend_qs:
        week = row.week
        if row.stage in ACTIVE_STAGES:
            week_agg[week]["active"] += row.amount
            week_agg[week]["weighted"] += row.weighted
            week_agg[week]["count"] += 1
            if row.forecast_category.strip() in ("Commit", "Commit "):
                week_agg[week]["commit"] += row.amount
        elif row.stage == "Business Won":
            week_agg[week]["won"] += row.amount
        elif row.stage == "Business Lost":
            week_agg[week]["lost"] += row.amount

    weekly_trend = [
        {
            "week": week,
            "week_num": _week_sort_key(week),
            "active": round(week_agg[week]["active"], 2),
            "won": round(week_agg[week]["won"], 2),
            "lost": round(week_agg[week]["lost"], 2),
            "weighted": round(week_agg[week]["weighted"], 2),
            "commit": round(week_agg[week]["commit"], 2),
            "count": week_agg[week]["count"],
        }
        for week in sorted(weeks_all, key=_week_sort_key)
    ]

    # Per-week, per-stage breakdown for the Stage Evolution stacked chart
    stage_by_week = defaultdict(lambda: defaultdict(float))
    region_by_week = defaultdict(lambda: defaultdict(float))
    for row in trend_qs:
        if row.stage in ACTIVE_STAGES:
            stage_by_week[row.week][row.stage] += row.amount
            region_by_week[row.week][row.region or "Other"] += row.amount

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

    movement = _build_movement(base_qs, week_records, weeks_all, target_week)
    trend_by_week = {row["week"]: row for row in weekly_trend}
    baseline_week = "Week 7" if "Week 7" in trend_by_week else (weekly_trend[0]["week"] if weekly_trend else target_week)
    baseline = trend_by_week.get(baseline_week, {})
    selected_trend = trend_by_week.get(target_week, {})

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
    late_stage = [row for row in active if row.stage in ("80%-Validate", "90%-Negotiate & Close")]
    active_by_quarter = defaultdict(lambda: {"amount": 0.0, "count": 0})
    active_by_type = defaultdict(lambda: {"amount": 0.0, "count": 0})
    for row in active:
        active_by_quarter[row.close_quarter or "Unknown"]["amount"] += row.amount
        active_by_quarter[row.close_quarter or "Unknown"]["count"] += 1
        active_by_type[row.order_type or "Unknown"]["amount"] += row.amount
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
        "coverage_target_multiple": round(active_pipeline / SALES_TARGET, 2) if SALES_TARGET else 0,
        "coverage_aop_multiple": round(active_pipeline / AOP, 2) if AOP else 0,
        "weighted_target_multiple": round(weighted_pipeline / SALES_TARGET, 2) if SALES_TARGET else 0,
        "weighted_aop_multiple": round(weighted_pipeline / AOP, 2) if AOP else 0,
        "movement_counts": movement_counts,
        "new_won_from_previous": movement_counts["won"],
        "lost_pipeline_count": len(lost),
        "top_rep": top_rep,
        "top_stage": top_stage,
        "stage_80": stage_80,
        "late_stage_amount": round(sum(row.amount for row in late_stage), 2),
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
                "count": baseline.get("count", 0),
                "avg_deal_size": round(baseline.get("active", 0) / baseline.get("count", 1), 2) if baseline.get("count") else 0,
                "won": round(baseline.get("won", 0), 2),
                "coverage_target": round(baseline.get("active", 0) / SALES_TARGET, 2) if SALES_TARGET else 0,
                "coverage_aop": round(baseline.get("active", 0) / AOP, 2) if AOP else 0,
            },
            "current": {
                "week": target_week,
                "active": round(selected_trend.get("active", active_pipeline), 2),
                "count": selected_trend.get("count", len(active)),
                "avg_deal_size": kpis["avg_deal_size"],
                "won": round(selected_trend.get("won", won_ytd), 2),
                "coverage_target": round(active_pipeline / SALES_TARGET, 2) if SALES_TARGET else 0,
                "coverage_aop": round(active_pipeline / AOP, 2) if AOP else 0,
            },
        },
    }

    today = date.today()

    def _days(d):
        if d is None:
            return None
        try:
            return (today - d).days
        except Exception:
            return None

    return JsonResponse({
        "has_data": True,
        "import": {
            "file_name": data_import.file_name,
            "imported_at": data_import.imported_at.isoformat(),
            "row_count": data_import.row_count,
        },
        "filters": filters,
        "selected_week": target_week,
        "weeks": weeks_all,
        "kpis": kpis,
        "stage_dist": stage_dist,
        "forecast_dist": forecast_dist,
        "region_dist": region_dist,
        "sector_dist": sector_dist,
        "rep_breakdown": rep_breakdown,
        "weekly_trend": weekly_trend,
        "weekly_stage_trend": weekly_stage_trend,
        "weekly_region_trend": weekly_region_trend,
        "baseline_stage_dist": baseline_stage_dist,
        "movement": movement,
        "executive": executive,
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
            }
            for row in sorted(week_records, key=lambda item: item.amount, reverse=True)
        ],
    })


def _build_movement(base_qs, week_records, weeks_all, target_week):
    sorted_weeks = sorted(weeks_all, key=_week_sort_key)
    prev_week = None
    if target_week in sorted_weeks:
        index = sorted_weeks.index(target_week)
        if index > 0:
            prev_week = sorted_weeks[index - 1]

    movement = {"matrix": {}, "forward": [], "backward": [], "won": [], "lost": [], "new": []}
    if not prev_week:
        return movement

    prev_records = {row.record_id: row for row in base_qs.filter(week=prev_week) if row.record_id}
    curr_records = {row.record_id: row for row in week_records if row.record_id}
    matrix = defaultdict(lambda: defaultdict(int))

    for record_id, curr in curr_records.items():
        if record_id not in prev_records:
            movement["new"].append({
                "record_id": record_id,
                "deal_name": curr.deal_name,
                "owner": curr.owner,
                "amount": curr.amount,
                "stage": curr.stage,
            })
            continue

        prev = prev_records[record_id]
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
    movement["prev_week"] = prev_week
    return movement
