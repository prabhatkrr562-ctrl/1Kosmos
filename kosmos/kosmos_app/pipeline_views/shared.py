import re


AOP = 17_300_000
SALES_TARGET = 23_900_000

STAGE_ORDER = [
    "5% - Prospecting",
    "20%-Discovery",
    "40%-Scoping",
    "60%-Propose",
    "80%-Validate",
    "90%-Negotiate & Close",
    "Business Won",
    "Business Lost",
]

ACTIVE_STAGES = {
    "5% - Prospecting",
    "20%-Discovery",
    "40%-Scoping",
    "60%-Propose",
    "80%-Validate",
    "90%-Negotiate & Close",
}


def _week_sort_key(week):
    match = re.search(r"(\d+)", week or "")
    return int(match.group(1)) if match else 0


def _movement_key(row):
    """Return the CRM business identity used to compare weekly snapshots.

    Record IDs are not stable enough for this workbook: the same named deal
    can be exported under a different ID, while an ID can survive a deal-name
    replacement.  The reference dashboard therefore compares Deal Name +
    Company and only falls back to Record ID when the name is unavailable.
    """
    name = " ".join((getattr(row, "deal_name", "") or "").split()).casefold()
    company = " ".join((getattr(row, "company", "") or "").split()).casefold()
    if name:
        return (name, company)

    record_id = (getattr(row, "record_id", "") or "").strip()
    return ("record-id", record_id) if record_id else None
