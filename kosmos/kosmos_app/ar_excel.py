"""Reader for the three-sheet AR Dashboard Master workbook."""

import re
from datetime import date, datetime, timedelta
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from .excel import MAIN_NS, NS, PACKAGE_REL_NS, REL_NS, column_name, excel_date


EXPECTED_SHEETS = {
    "AR Aging": [
        "Customer", "End User", "Region", "Sales Rep", "Type", "Date",
        "Document Number", "Due Date", "Open Balance",
    ],
    "Payment History": [
        "InvoiceNo.", "Customer Name", "End User", "Sales Rep", "Region",
        "Payment Type", "Date", "Due Date", "Amount",
    ],
    "Renewal Pending": [
        "End User", "Renewal Status", "Status", "Amount", "Sales Rep",
        "Region", "Remarks",
    ],
}


class ARWorkbookError(ValueError):
    pass


def _shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(".//m:t", NS))
        for item in root.findall("m:si", NS)
    ]


def _cell_value(cell, shared):
    value_node = cell.find("m:v", NS)
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//m:t", NS))
    if value_node is None:
        return ""
    value = value_node.text or ""
    if cell_type == "s":
        try:
            return shared[int(value)]
        except (ValueError, IndexError):
            return ""
    return value


def _worksheets(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rels = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in rels_root.findall(f"{{{PACKAGE_REL_NS}}}Relationship")
    }
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        target = rels[sheet.attrib[f"{{{REL_NS}}}id"]].lstrip("/")
        yield sheet.attrib["name"], target if target.startswith("xl/") else f"xl/{target}"


def _rows(archive, path, shared):
    root = ET.fromstring(archive.read(path))
    result = []
    for row in root.findall("m:sheetData/m:row", NS):
        values = {
            column_name(cell.attrib.get("r")): _cell_value(cell, shared)
            for cell in row.findall("m:c", NS)
        }
        if any(value not in ("", None) for value in values.values()):
            result.append(values)
    return result


def _number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


def _text(value):
    return str(value or "").strip()


def _infer_as_of_date(file_name, dates):
    match = re.search(
        r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)",
        file_name,
        re.IGNORECASE,
    )
    years = [value.year for value in dates if value]
    year = max(years) if years else date.today().year
    if match:
        return datetime.strptime(
            f"{match.group(1)} {match.group(2)} {year}", "%d %B %Y"
        ).date()
    return max(dates) if dates else date.today()


def parse_ar_workbook(uploaded_file):
    try:
        archive = ZipFile(BytesIO(uploaded_file.read()))
    except (BadZipFile, OSError) as exc:
        raise ARWorkbookError("Please upload a valid AR Dashboard .xlsx file.") from exc

    with archive:
        shared = _shared_strings(archive)
        sheets = {
            name: _rows(archive, path, shared)
            for name, path in _worksheets(archive)
            if name in EXPECTED_SHEETS
        }

    missing = [name for name in EXPECTED_SHEETS if name not in sheets]
    if missing:
        raise ARWorkbookError(f"Missing required worksheet(s): {', '.join(missing)}.")

    for name, expected in EXPECTED_SHEETS.items():
        if not sheets[name]:
            raise ARWorkbookError(f"{name} is empty.")
        header = [sheets[name][0].get(chr(65 + index), "") for index in range(len(expected))]
        if header != expected:
            raise ARWorkbookError(f"{name} headers do not match the expected template.")

    aging = []
    for row in sheets["AR Aging"][1:]:
        if not row.get("G") and not row.get("B"):
            continue
        aging.append({
            "customer": _text(row.get("A")),
            "end_user": _text(row.get("B")),
            "region": _text(row.get("C")),
            "sales_rep": _text(row.get("D")),
            "document_type": _text(row.get("E")),
            "document_date": excel_date(row.get("F")),
            "document_number": _text(row.get("G")),
            "due_date": excel_date(row.get("H")),
            "open_balance": _number(row.get("I")),
        })

    payments = []
    for row in sheets["Payment History"][1:]:
        if not row.get("A") and not row.get("B"):
            continue
        payments.append({
            "invoice_number": _text(row.get("A")),
            "customer": _text(row.get("B")),
            "end_user": _text(row.get("C")),
            "sales_rep": _text(row.get("D")),
            "region": _text(row.get("E")),
            "payment_type": _text(row.get("F")),
            "event_date": excel_date(row.get("G")),
            "due_date": excel_date(row.get("H")),
            "amount": _number(row.get("I")),
        })

    renewals = []
    for row in sheets["Renewal Pending"][1:]:
        if not row.get("A"):
            continue
        renewals.append({
            "end_user": _text(row.get("A")),
            "renewal_status": _text(row.get("B")),
            "status": _text(row.get("C")),
            "amount": _number(row.get("D")),
            "sales_rep": _text(row.get("E")),
            "region": _text(row.get("F")),
            "remarks": _text(row.get("G")),
        })

    if not aging and not payments and not renewals:
        raise ARWorkbookError("No AR records were found.")
    all_dates = [
        item[field]
        for collection, fields in ((aging, ("document_date", "due_date")), (payments, ("event_date", "due_date")))
        for item in collection
        for field in fields
        if item[field]
    ]
    return {
        "aging": aging,
        "payments": payments,
        "renewals": renewals,
        "as_of_date": _infer_as_of_date(uploaded_file.name, all_dates),
    }


_TABLE_SHEET = {
    "aging":    "AR Aging",
    "payments": "Payment History",
    "renewals": "Renewal Pending",
}


def parse_ar_single_sheet(uploaded_file, table):
    """Parse only one sheet from an AR workbook for insert-mode uploads.

    ``table`` must be one of 'aging', 'payments', or 'renewals'.
    The uploaded file only needs to contain the requested sheet (the other
    two sheets may be absent).
    Returns a list of dicts ready to be passed to the matching bulk_create.
    """
    sheet_name = _TABLE_SHEET.get(table)
    if not sheet_name:
        raise ARWorkbookError(f"Unknown table '{table}'. Must be aging, payments, or renewals.")

    try:
        archive = ZipFile(BytesIO(uploaded_file.read()))
    except (BadZipFile, OSError) as exc:
        raise ARWorkbookError("Please upload a valid AR Dashboard .xlsx file.") from exc

    with archive:
        shared = _shared_strings(archive)
        found = {
            name: _rows(archive, path, shared)
            for name, path in _worksheets(archive)
            if name == sheet_name
        }

    if sheet_name not in found:
        raise ARWorkbookError(
            f"Sheet '{sheet_name}' not found in the uploaded file. "
            f"Make sure you are uploading the correct Excel sheet for '{table}'."
        )

    rows_data = found[sheet_name]
    if not rows_data:
        raise ARWorkbookError(f"Sheet '{sheet_name}' is empty.")

    expected = EXPECTED_SHEETS[sheet_name]
    header = [rows_data[0].get(chr(65 + i), "") for i in range(len(expected))]
    if header != expected:
        raise ARWorkbookError(
            f"'{sheet_name}' headers do not match the expected template. "
            f"Expected: {expected}. Got: {header}"
        )

    if table == "aging":
        result = []
        for row in rows_data[1:]:
            if not row.get("G") and not row.get("B"):
                continue
            result.append({
                "customer":        _text(row.get("A")),
                "end_user":        _text(row.get("B")),
                "region":          _text(row.get("C")),
                "sales_rep":       _text(row.get("D")),
                "document_type":   _text(row.get("E")),
                "document_date":   excel_date(row.get("F")),
                "document_number": _text(row.get("G")),
                "due_date":        excel_date(row.get("H")),
                "open_balance":    _number(row.get("I")),
            })
        return result

    if table == "payments":
        result = []
        for row in rows_data[1:]:
            if not row.get("A") and not row.get("B"):
                continue
            result.append({
                "invoice_number":   _text(row.get("A")),
                "customer":         _text(row.get("B")),
                "end_user":         _text(row.get("C")),
                "sales_rep":        _text(row.get("D")),
                "region":           _text(row.get("E")),
                "payment_type":     _text(row.get("F")),
                "event_date":       excel_date(row.get("G")),
                "due_date":         excel_date(row.get("H")),
                "amount":           _number(row.get("I")),
            })
        return result

    # renewals
    result = []
    for row in rows_data[1:]:
        if not row.get("A"):
            continue
        result.append({
            "end_user":        _text(row.get("A")),
            "renewal_status":  _text(row.get("B")),
            "status":          _text(row.get("C")),
            "amount":          _number(row.get("D")),
            "sales_rep":       _text(row.get("E")),
            "region":          _text(row.get("F")),
            "remarks":         _text(row.get("G")),
        })
    return result
