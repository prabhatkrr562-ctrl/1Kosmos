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
