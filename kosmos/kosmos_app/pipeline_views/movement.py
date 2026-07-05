from collections import defaultdict
from datetime import date

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import PipelineImport
from .shared import STAGE_ORDER, _week_sort_key

ACTIVE_STAGES = {
    "5% - Prospecting", "20%-Discovery", "40%-Scoping",
    "60%-Propose", "80%-Validate", "90%-Negotiate & Close",
}


def _days(d):
    if d is None:
        return None
    try:
        return (date.today() - d).days
    except Exception:
        return None


def _build_movement_between(base_qs, from_week, to_week):
    """Compute stage movements between any two weeks with enriched deal fields."""
    prev_records = {row.record_id: row for row in base_qs.filter(week=from_week) if row.record_id}
    curr_records = {row.record_id: row for row in base_qs.filter(week=to_week)   if row.record_id}

    movement = {"matrix": {}, "forward": [], "backward": [], "won": [], "lost": [], "new": []}
    matrix   = defaultdict(lambda: defaultdict(int))

    for record_id, curr in curr_records.items():
        if record_id not in prev_records:
            movement["new"].append({
                "record_id":   record_id,
                "deal_name":   curr.deal_name,
                "company":     curr.company,
                "owner":       curr.owner,
                "amount":      round(curr.amount, 2),
                "stage":       curr.stage,
                "region":      curr.region,
                "forecast_category": curr.forecast_category,
            })
            continue

        prev = prev_records[record_id]
        if prev.stage == curr.stage:
            continue

        matrix[prev.stage][curr.stage] += 1

        entry = {
            "record_id":        record_id,
            "deal_name":        curr.deal_name,
            "company":          curr.company,
            "owner":            curr.owner,
            "team":             curr.team,
            "amount":           round(curr.amount, 2),
            "weighted":         round(curr.weighted, 2),
            "from_stage":       prev.stage,
            "to_stage":         curr.stage,
            "stage":            curr.stage,
            "forecast_category": curr.forecast_category,
            "region":           curr.region,
            "order_type":       curr.order_type,
            "close_quarter":    curr.close_quarter,
            "source":           curr.source,
            "term":             curr.term,
            "days_open":        _days(curr.create_date),
            "days_stale":       _days(curr.last_activity_date),
            "next_step":        curr.next_step,
            "partner_owner":    curr.partner_owner,
        }

        fi = STAGE_ORDER.index(prev.stage)  if prev.stage  in STAGE_ORDER else -1
        ti = STAGE_ORDER.index(curr.stage)  if curr.stage  in STAGE_ORDER else -1

        if curr.stage == "Business Won":
            movement["won"].append(entry)
        elif curr.stage == "Business Lost":
            movement["lost"].append(entry)
        elif fi >= 0 and ti > fi:
            movement["forward"].append(entry)
        elif fi >= 0 and ti < fi:
            movement["backward"].append(entry)

    movement["matrix"]    = {fs: dict(ts) for fs, ts in matrix.items()}
    movement["from_week"] = from_week
    movement["to_week"]   = to_week
    return movement


@require_GET
def pipeline_movement(request):
    data_import = PipelineImport.objects.first()
    if not data_import:
        return JsonResponse({"has_data": False, "movement": {}, "weeks": []})

    base_qs   = data_import.records.all()
    weeks_all = sorted(
        {w for w in base_qs.values_list("week", flat=True).distinct() if w},
        key=_week_sort_key,
    )

    # Optional global filters
    sel_owner  = request.GET.get("owner",  "").strip()
    sel_team   = request.GET.get("team",   "").strip()
    sel_region = request.GET.get("region", "").strip()
    if sel_owner:  base_qs = base_qs.filter(owner=sel_owner)
    if sel_team:   base_qs = base_qs.filter(team=sel_team)
    if sel_region: base_qs = base_qs.filter(region=sel_region)

    from_week = request.GET.get("from_week", "").strip()
    to_week   = request.GET.get("to_week",   "").strip()

    # Default: last two distinct weeks
    if from_week not in weeks_all or to_week not in weeks_all:
        if len(weeks_all) >= 2:
            from_week, to_week = weeks_all[-2], weeks_all[-1]
        elif weeks_all:
            from_week = to_week = weeks_all[-1]
        else:
            return JsonResponse({"has_data": True, "movement": {}, "weeks": weeks_all})

    movement = _build_movement_between(base_qs, from_week, to_week)

    return JsonResponse({
        "has_data":  True,
        "weeks":     weeks_all,
        "from_week": from_week,
        "to_week":   to_week,
        "movement":  movement,
    })
