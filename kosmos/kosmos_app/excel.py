"""Dependency-free reader for the Booking Database XLSX / CSV templates."""

import csv
import io
import re
from datetime import datetime, timedelta
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS, "p": PACKAGE_REL_NS}

# Matches YYYY-MM month-column headers (e.g. "2019-01" from preparing_own.xls)
_MONTH_YYYYMM = re.compile(r'^\d{4}-\d{2}$')

# All recognised lowercase header text → model field name.
# Includes both underscore-style (internal) and human-readable aliases
# (as they appear in preparing_own.xls after .strip().lower()).
ALL_HEADER_COLUMNS = {
    # ── Internal / underscore-style names ──────────────────────────────────
    "key_id":            "key_id",
    "entity":            "entity",
    "currency":          "currency",
    "contract_id":       "contract_id",
    "contract_name":     "contract_name",
    "sales_person":      "sales_person",
    "mode":              "mode",
    "company_size":      "company_size",
    "industry":          "industry",
    "business_unit":     "business_unit",
    "bill_to":           "bill_to",
    "end_user":          "end_user",
    "product_type":      "product_type",
    "sub_product_type":  "sub_product_type",
    "revenue_method":    "revenue_method",
    "tcv_usd":           "tcv_usd",
    "arr_usd":           "arr_usd",
    "booking":           "booking",
    "booking_status":    "booking_status",
    "order_status":      "order_status",
    "revenue_type":      "revenue_type",
    "term_start":        "term_start",
    "term_end":          "term_end",
    "line_of_business":  "line_of_business",
    "current_arr":       "current_arr",
    # ── preparing_own.xls human-readable aliases ────────────────────────────
    "key id":            "key_id",
    "cur.":              "currency",
    "cur":               "currency",
    "contract id":       "contract_id",
    "contract name":     "contract_name",
    "sales person":      "sales_person",
    "size":              "company_size",
    "company size":      "company_size",
    "bu":                "business_unit",
    "bill to":           "bill_to",
    "end user":          "end_user",
    "product type":      "product_type",
    "sub-product":       "sub_product_type",
    "sub product":       "sub_product_type",
    "sub product type":  "sub_product_type",
    "rev. method":       "revenue_method",
    "rev method":        "revenue_method",
    "tcv (usd)":         "tcv_usd",
    "tcv usd":           "tcv_usd",
    "arr usd":           "arr_usd",
    "arr model":         "arr_usd",
    "booking status":    "booking_status",
    "order status booking": "booking_status",
    "order status":      "order_status",
    "rev. type":         "revenue_type",
    "rev type":          "revenue_type",
    "rec/non rec":       "revenue_type",
    "term start":        "term_start",
    "term end":          "term_end",
    "line of business":  "line_of_business",
    "lob":               "line_of_business",
    "type":              "line_of_business",
    "current arr":       "current_arr",
    # ── Booking_Database_YYYY-MM export ─────────────────────────────────────
    # Parse-time pseudo-field: resolved into the status columns during
    # normalisation because BookingRecord has no deal_type field.
    "deal type":         "deal_type",
    # ── Attribute fields (15) ───────────────────────────────────────────────
    "attribute1":        "attribute1",
    "attribute2":        "attribute2",
    "attribute3":        "attribute3",
    "attribute4":        "attribute4",
    "attribute5":        "attribute5",
    "attribute6":        "attribute6",
    "attribute7":        "attribute7",
    "attribute8":        "attribute8",
    "attribute9":        "attribute9",
    "attribute10":       "attribute10",
    "attribute11":       "attribute11",
    "attribute12":       "attribute12",
    "attribute13":       "attribute13",
    "attribute14":       "attribute14",
    "attribute15":       "attribute15",
    # ── Audit fields ────────────────────────────────────────────────────────
    "created_by":        "created_by",
    "creation_date":     "creation_date",
    "last_update_by":    "last_update_by",
    "last_updated_by":   "last_update_by",
    "last_update_date":  "last_update_date",
    "last_updated_date": "last_update_date",
}

NUMERIC_FIELDS = {"tcv_usd", "arr_usd", "booking", "current_arr"}
DATE_FIELDS = {"term_start", "term_end", "creation_date", "last_update_date"}

MONTH_ABBR = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


class BookingWorkbookError(ValueError):
    pass


def _normalize_current_arr(records):
    month_totals = {}
    for record in records:
        record.setdefault("monthly_changes", {})
        # The Booking_Database_YYYY-MM export ships a "Deal Type" column while
        # leaving both Order Status columns blank; use it to backfill them.
        deal_type = record.pop("deal_type", "")
        if deal_type:
            record["booking_status"] = record.get("booking_status") or deal_type
            record["order_status"] = record.get("order_status") or deal_type
        for month, amount in (record.get("monthly_arr") or {}).items():
            month_totals[month] = month_totals.get(month, 0) + float(amount or 0)
    active_months = sorted(month for month, total in month_totals.items() if total)
    latest_month = active_months[-1] if active_months else ""
    if latest_month:
        for record in records:
            monthly = record.get("monthly_arr") or {}
            record["current_arr"] = monthly.get(latest_month, 0)
    return records


def column_name(cell_reference):
    match = re.match(r"[A-Z]+", cell_reference or "")
    return match.group(0) if match else ""


def excel_date(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return (datetime(1899, 12, 30) + timedelta(days=number)).date()


def _month_from_header(value):
    text = str(value or "").strip()
    match = re.match(r"^(\d{4}-\d{2})(?:-\d{2})?(?:\s+00:00:00)?$", text)
    if match:
        return match.group(1)
    parsed = excel_date(text)
    return parsed.strftime("%Y-%m") if parsed else ""


def _deal_type_month(value):
    match = re.match(r"^dealtype\s+([a-z]{3})-(\d{2})$", str(value or "").strip(), re.I)
    if not match:
        return ""
    month = MONTH_ABBR.get(match.group(1).lower())
    return f"20{match.group(2)}-{month}" if month else ""


def _booking_column_maps(header_items):
    """Split headers into fields, ARR months, movement amounts and deal types."""
    col_to_field = {}
    assigned_fields = set()
    month_occurrences = {}
    arr_month_cols = {}
    change_amount_cols = {}
    deal_type_cols = {}

    for column, raw_header in header_items:
        header = str(raw_header or "").strip()
        field = ALL_HEADER_COLUMNS.get(header.lower())
        if field:
            # Helper/reporting blocks in the source workbook repeat fields such
            # as Sub Product Type. The main data-table occurrence must win.
            if field not in assigned_fields:
                col_to_field[column] = field
                assigned_fields.add(field)
            continue

        month = _month_from_header(header)
        if month:
            occurrence = month_occurrences.get(month, 0)
            month_occurrences[month] = occurrence + 1
            if occurrence == 0:
                arr_month_cols[column] = month
            elif occurrence == 1:
                change_amount_cols[column] = month
            continue

        deal_month = _deal_type_month(header)
        if deal_month:
            deal_type_cols[column] = deal_month

    return col_to_field, arr_month_cols, change_amount_cols, deal_type_cols


def _shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(".//m:t", NS))
        for item in root.findall("m:si", NS)
    ]


def _first_sheet_path(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    first_sheet = workbook.find("m:sheets/m:sheet", NS)
    if first_sheet is None:
        raise BookingWorkbookError("The workbook does not contain a worksheet.")
    relationship_id = first_sheet.attrib[f"{{{REL_NS}}}id"]
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target = next(
        (
            rel.attrib["Target"]
            for rel in rels.findall("p:Relationship", NS)
            if rel.attrib["Id"] == relationship_id
        ),
        None,
    )
    if not target:
        raise BookingWorkbookError("The first worksheet could not be resolved.")
    target = target.lstrip("/")
    return target if target.startswith("xl/") else f"xl/{target}"


def _cell_value(cell, shared):
    value_node = cell.find("m:v", NS)
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(
            node.text or "" for node in cell.findall(".//m:is/m:t", NS)
        )
    if value_node is None:
        return ""
    value = value_node.text or ""
    if cell_type == "s":
        try:
            return shared[int(value)]
        except (ValueError, IndexError):
            return ""
    return value


def _row_cells(row, shared):
    return {
        column_name(cell.attrib.get("r")): _cell_value(cell, shared)
        for cell in row.findall("m:c", NS)
    }


def _parse_date_string(value):
    """Parse common date string formats into a date object."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


# ── XML Spreadsheet (.xls) parser ────────────────────────────────────────────
_SS = "urn:schemas-microsoft-com:office:spreadsheet"


def _xls_xml_row_to_list(row_elem):
    """Convert an XML Spreadsheet Row element to a 0-indexed list of strings."""
    values = []
    pos = 0
    for cell in row_elem.findall(f"{{{_SS}}}Cell"):
        idx = cell.get(f"{{{_SS}}}Index")
        if idx is not None:
            pos = int(idx) - 1          # ss:Index is 1-based → 0-based
        data = cell.find(f"{{{_SS}}}Data")
        text = (data.text or "") if data is not None else ""
        while len(values) <= pos:
            values.append("")
        values[pos] = text
        pos += 1
    return values


def _parse_xls_xml(payload):
    """Parse Microsoft XML Spreadsheet format (the .xls we generate as sample)."""
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        raise BookingWorkbookError(
            "Could not parse the file. Please upload a valid .xlsx or .csv file."
        ) from exc

    worksheet = root.find(f".//{{{_SS}}}Worksheet")
    if worksheet is None:
        raise BookingWorkbookError("No worksheet found in the XLS file.")

    table = worksheet.find(f"{{{_SS}}}Table")
    if table is None:
        raise BookingWorkbookError("No table found in the XLS worksheet.")

    xml_rows = table.findall(f"{{{_SS}}}Row")
    if not xml_rows:
        raise BookingWorkbookError("The worksheet is empty.")

    # Find header row
    header_list = None
    header_idx = None
    for i, row_elem in enumerate(xml_rows):
        cells = _xls_xml_row_to_list(row_elem)
        if any(ALL_HEADER_COLUMNS.get(v.strip().lower()) for v in cells if v.strip()):
            header_list = cells
            header_idx = i
            break

    if header_list is None:
        raise BookingWorkbookError(
            "No recognised header row found. "
            "Ensure row 1 contains field names such as KEY_ID, ENTITY, CONTRACT_ID, etc."
        )

    col_to_field, arr_month_cols, change_amount_cols, deal_type_cols = (
        _booking_column_maps(enumerate(header_list))
    )

    key_idxs = {idx for idx, f in col_to_field.items() if f in ("key_id", "contract_id")}

    records = []
    for row_elem in xml_rows[header_idx + 1:]:
        row = _xls_xml_row_to_list(row_elem)
        if not any(row):
            continue
        if key_idxs and not any(row[i].strip() for i in key_idxs if i < len(row)):
            continue

        record = {}
        for idx, field in col_to_field.items():
            value = row[idx].strip() if idx < len(row) else ""
            if field in NUMERIC_FIELDS:
                try:
                    value = float(value.replace(",", "") or 0)
                except (TypeError, ValueError):
                    value = 0.0
            elif field in DATE_FIELDS:
                value = _parse_date_string(value)
            else:
                value = str(value or "").strip()
            record[field] = value

        # Collect monthly ARR from YYYY-MM columns
        monthly = {}
        for idx, month_key in arr_month_cols.items():
            raw = row[idx].strip() if idx < len(row) else ""
            try:
                amount = float(raw.replace(",", "") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            if amount:
                monthly[month_key] = amount

        change_amounts = {}
        for idx, month_key in change_amount_cols.items():
            raw = row[idx].strip() if idx < len(row) else ""
            try:
                amount = float(raw.replace(",", "") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            if amount:
                change_amounts[month_key] = amount

        monthly_changes = {}
        for idx, month_key in deal_type_cols.items():
            amount = change_amounts.get(month_key)
            deal_type = row[idx].strip() if idx < len(row) else ""
            if not amount or not deal_type:
                continue
            bucket = monthly_changes.setdefault(month_key, {})
            bucket[deal_type] = bucket.get(deal_type, 0) + amount

        record["monthly_arr"] = monthly
        record["monthly_changes"] = monthly_changes

        # current_arr: use explicit column value first, then latest monthly, then arr_usd
        if not record.get("current_arr"):
            record["current_arr"] = (
                monthly.get(max(monthly), 0) if monthly else record.get("arr_usd", 0)
            )

        records.append(record)

    if not records:
        raise BookingWorkbookError("No booking records were found in the file.")
    return _normalize_current_arr(records)


def parse_booking_workbook(uploaded_file):
    try:
        payload = uploaded_file.read()
        archive = ZipFile(BytesIO(payload))
    except (BadZipFile, OSError):
        # Not a ZIP (XLSX) — try XML Spreadsheet format (.xls we generate)
        return _parse_xls_xml(payload)

    with archive:
        shared = _shared_strings(archive)
        sheet = ET.fromstring(archive.read(_first_sheet_path(archive)))
        rows = sheet.findall("m:sheetData/m:row", NS)

        if not rows:
            raise BookingWorkbookError("The worksheet is empty.")

        # ── Find header row ───────────────────────────────────────────────────
        # Scan from the top; the first row where at least one cell text matches
        # a known field name is treated as the header row.
        header_cells = None
        header_row_num = None
        for row in rows:
            cells = _row_cells(row, shared)
            if any(ALL_HEADER_COLUMNS.get(v.strip().lower()) for v in cells.values() if v):
                header_cells = cells
                header_row_num = int(row.attrib.get("r", 0))
                break

        if header_cells is None:
            raise BookingWorkbookError(
                "No recognised header row found. "
                "Ensure row 1 contains field names such as KEY_ID, ENTITY, CONTRACT_ID, etc."
            )

        # ── Build column mappings from header row ─────────────────────────────
        col_to_field, arr_month_cols, change_amount_cols, deal_type_cols = (
            _booking_column_maps(header_cells.items())
        )

        # Identify skip-check columns for empty-row detection
        key_cols = {c for c, f in col_to_field.items() if f in ("key_id", "contract_id")}

        # ── Parse data rows ───────────────────────────────────────────────────
        records = []
        for row in rows:
            if int(row.attrib.get("r", 0)) <= header_row_num:
                continue

            cells = _row_cells(row, shared)

            # Skip rows with no key_id or contract_id value
            if not any(cells.get(c, "").strip() for c in key_cols):
                continue

            record = {}
            for col_letter, field in col_to_field.items():
                value = cells.get(col_letter, "")
                if field in NUMERIC_FIELDS:
                    try:
                        value = float(value or 0)
                    except (TypeError, ValueError):
                        value = 0.0
                elif field in DATE_FIELDS:
                    value = excel_date(value)
                else:
                    value = str(value or "").strip()
                record[field] = value

            # Month ARR columns
            monthly = {}
            for col_letter, month in arr_month_cols.items():
                try:
                    amount = float(cells.get(col_letter, 0) or 0)
                except (TypeError, ValueError):
                    amount = 0.0
                if amount:
                    monthly[month] = amount

            change_amounts = {}
            for col_letter, month in change_amount_cols.items():
                try:
                    amount = float(cells.get(col_letter, 0) or 0)
                except (TypeError, ValueError):
                    amount = 0.0
                if amount:
                    change_amounts[month] = amount

            monthly_changes = {}
            for col_letter, month in deal_type_cols.items():
                amount = change_amounts.get(month)
                deal_type = str(cells.get(col_letter, "") or "").strip()
                if not amount or not deal_type:
                    continue
                bucket = monthly_changes.setdefault(month, {})
                bucket[deal_type] = bucket.get(deal_type, 0) + amount

            record["monthly_arr"] = monthly
            record["monthly_changes"] = monthly_changes
            if not record.get("current_arr"):
                record["current_arr"] = (
                    monthly.get(max(monthly), 0) if monthly else record.get("arr_usd", 0)
                )
            records.append(record)

    if not records:
        raise BookingWorkbookError("No booking records were found in the file.")
    return _normalize_current_arr(records)


# ── CSV parser ────────────────────────────────────────────────────────────────

def parse_booking_csv(uploaded_file):
    """Parse a CSV file using header-name-based column detection."""
    try:
        raw = uploaded_file.read()
        content = raw.decode("utf-8-sig")          # strip BOM if present
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    reader = list(csv.reader(io.StringIO(content)))
    if not reader:
        raise BookingWorkbookError("The CSV file is empty.")

    # Find the header row (first row with at least one recognised field name)
    header_row = None
    header_idx = None
    for i, row in enumerate(reader):
        if any(ALL_HEADER_COLUMNS.get(cell.strip().lower()) for cell in row if cell.strip()):
            header_row = row
            header_idx = i
            break

    if header_row is None:
        raise BookingWorkbookError(
            "No recognised header row found. "
            "Ensure row 1 contains field names such as KEY_ID, ENTITY, CONTRACT_ID, etc."
        )

    # Build column-index → model field mapping
    col_to_field, arr_month_cols, change_amount_cols, deal_type_cols = (
        _booking_column_maps(enumerate(header_row))
    )

    key_idxs = {idx for idx, f in col_to_field.items() if f in ("key_id", "contract_id")}

    records = []
    for row in reader[header_idx + 1:]:
        if not any(row):
            continue
        if key_idxs and not any(
            row[i].strip() for i in key_idxs if i < len(row)
        ):
            continue

        record = {}
        for idx, field in col_to_field.items():
            value = row[idx].strip() if idx < len(row) else ""
            if field in NUMERIC_FIELDS:
                try:
                    value = float(value.replace(",", "") or 0)
                except (TypeError, ValueError):
                    value = 0.0
            elif field in DATE_FIELDS:
                value = _parse_date_string(value)
            else:
                value = str(value or "").strip()
            record[field] = value

        monthly = {}
        for idx, month in arr_month_cols.items():
            raw_value = row[idx].strip() if idx < len(row) else ""
            try:
                amount = float(raw_value.replace(",", "") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            if amount:
                monthly[month] = amount

        change_amounts = {}
        for idx, month in change_amount_cols.items():
            raw_value = row[idx].strip() if idx < len(row) else ""
            try:
                amount = float(raw_value.replace(",", "") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            if amount:
                change_amounts[month] = amount

        monthly_changes = {}
        for idx, month in deal_type_cols.items():
            amount = change_amounts.get(month)
            if not amount:
                continue
            deal_type = row[idx].strip() if idx < len(row) else ""
            if not deal_type:
                continue
            bucket = monthly_changes.setdefault(month, {})
            bucket[deal_type] = bucket.get(deal_type, 0) + amount

        record["monthly_arr"] = monthly
        record["monthly_changes"] = monthly_changes
        if not record.get("current_arr"):
            record["current_arr"] = monthly.get(max(monthly), 0) if monthly else record.get("arr_usd", 0)
        records.append(record)

    if not records:
        raise BookingWorkbookError("No booking records were found in the CSV file.")
    return _normalize_current_arr(records)
