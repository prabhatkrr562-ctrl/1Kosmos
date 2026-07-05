from collections import defaultdict

from ..views_shared import _money


def _bucket_label(days):
    if days < 0:
        return "Not Due"
    elif days <= 30:
        return "0-30"
    elif days <= 60:
        return "31-60"
    elif days <= 90:
        return "61-90"
    return "91+"


def _group_amount(records, field, amount_field, limit=10):
    totals = defaultdict(float)
    for item in records:
        totals[getattr(item, field) or "Unspecified"] += float(
            getattr(item, amount_field) or 0
        )
    return [
        {"label": label, "value": _money(value)}
        for label, value in sorted(
            totals.items(), key=lambda pair: pair[1], reverse=True
        )[:limit]
    ]
