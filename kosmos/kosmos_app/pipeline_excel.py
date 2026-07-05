"""Dependency-free reader for the Pipeline Intelligence XLSX template."""

import re
from datetime import datetime, timedelta
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

STAGE_PROBS = {
    '5% - Prospecting': 0.05,
    '20%-Discovery': 0.20,
    '40%-Scoping': 0.40,
    '60%-Propose': 0.60,
    '80%-Validate': 0.80,
    '90%-Negotiate & Close': 0.90,
    'Business Won': 1.0,
    'Business Lost': 0.0,
}

VALID_REGIONS = {'North America', 'APAC', 'Commercial', 'Public'}


class PipelineWorkbookError(ValueError):
    pass


def _col_idx(ref):
    """Convert column letter(s) like 'A','AB' to 0-based int."""
    col = re.match(r'([A-Z]+)', ref or '').group(1)
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n - 1


def _get_cell_value(cell, strings):
    t = cell.get('t', '')
    v = cell.find(f'{{{MAIN_NS}}}v')
    if v is None or v.text is None:
        return ''
    if t == 's':
        try:
            return strings[int(v.text)]
        except (IndexError, ValueError):
            return ''
    return v.text.strip()


def _week_num(week_str):
    m = re.search(r'(\d+)', week_str or '')
    return int(m.group(1)) if m else 0


def _excel_date(serial_str):
    """Convert Excel serial date float string to Python date, or None."""
    if not serial_str:
        return None
    try:
        serial = float(serial_str)
        # Excel epoch: Jan 1, 1900 = serial 1, with 1900 wrongly treated as leap year
        epoch = datetime(1899, 12, 30)
        return (epoch + timedelta(days=serial)).date()
    except (ValueError, TypeError):
        return None


def parse_pipeline_workbook(file_obj):
    """Parse Pipeline Excel. Returns list of record dicts."""
    if isinstance(file_obj, (bytes, bytearray)):
        file_obj = BytesIO(file_obj)

    try:
        zf = ZipFile(file_obj)
    except BadZipFile:
        raise PipelineWorkbookError("Invalid Excel file.")

    # Shared strings
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            ss_root = ET.fromstring(f.read())
        strings = []
        for si in ss_root.iter(f'{{{MAIN_NS}}}si'):
            text = ''.join((t.text or '') for t in si.iter(f'{{{MAIN_NS}}}t'))
            strings.append(text)
    except Exception:
        raise PipelineWorkbookError("Cannot read shared strings.")

    # Sheet
    try:
        with zf.open('xl/worksheets/sheet1.xml') as f:
            sheet_root = ET.fromstring(f.read())
    except Exception:
        raise PipelineWorkbookError("Cannot read worksheet.")

    records = []
    rows = list(sheet_root.iter(f'{{{MAIN_NS}}}row'))

    for row in rows[1:]:  # skip header row
        # Build col_idx → cell element map
        cells = {}
        for c in row.findall(f'{{{MAIN_NS}}}c'):
            r = c.get('r', '')
            col_match = re.match(r'([A-Z]+)', r)
            if col_match:
                idx = _col_idx(col_match.group(1))
                cells[idx] = c

        def g(idx):
            c = cells.get(idx)
            return _get_cell_value(c, strings) if c is not None else ''

        week = g(18)  # col S
        if not week.startswith('Week '):
            continue

        stage = g(3)   # col D
        raw_amount = g(8)  # col I
        try:
            amount = float(raw_amount) if raw_amount else 0.0
        except ValueError:
            amount = 0.0

        raw_weighted = g(21)  # col V
        try:
            weighted = float(raw_weighted) if raw_weighted else amount * STAGE_PROBS.get(stage, 0)
        except ValueError:
            weighted = amount * STAGE_PROBS.get(stage, 0)

        region = g(22)  # col W
        if region not in VALID_REGIONS:
            region = ''

        records.append({
            'record_id':          g(0),              # A — Record ID
            'deal_name':          g(1),              # B — Deal Name
            'company':            g(2),              # C — Associated Company
            'stage':              stage,             # D — Deal Stage
            'forecast_category':  g(4).strip(),      # E — Forecast category
            # F (5): Close Date — serial, not stored separately
            'owner':              g(6),              # G — Deal owner
            'team':               g(7),              # H — HubSpot Team
            'amount':             amount,            # I — Amount
            'term':               g(9),              # J — Term of Contract
            'order_type':         g(10),             # K — Order Type
            'create_date':        _excel_date(g(11)), # L — Create Date
            'last_activity_date': _excel_date(g(12)), # M — Last Activity Date
            'next_step':          g(13),             # N — Next step
            'source':             g(14),             # O — Deal Source Type
            # P (15): Deal Source Type 2 — omitted (redundant)
            # Q (16): Deal Source — often empty, covered by O
            'partner_owner':      g(17),             # R — Partner Owner
            'week':               week,              # S — Week
            # T (19): Close Month — covered by close_quarter
            'close_quarter':      g(20),             # U — Close Quarter
            'weighted':           weighted,          # V — Weighted
            'region':             region,            # W — Region
            # X (23): Create Month — redundant with create_date
            'sector':             g(24),             # Y — Sector
            # Z (25): Close Year — covered by close_quarter
            'week_num':           _week_num(week),
        })

    if not records:
        raise PipelineWorkbookError("No valid pipeline records found in file.")

    return records
