"""Convert UiPath IXP extraction JSON into the shape the React UI consumes.

UI shape (per data/mock-results.js in the prototype):
{
  docType, documentMeta:{filename, pages, sizeKb, processedMs},
  fields:[{id, label, value, confidence, page, bbox, snippet}],
  lineItems:[{id, sku, description, subDesc, qty, unit, unitPrice, total, page, confidence}],
  lineItemTotals:{qty, total, currency},
  tables:[{name, page, rows}]   # for the Analyse popup graphs/table toggle
}
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional


# Heuristic mappings: UiPath table column names → UI line-item keys
SKU_KEYS = {"sku", "item", "itemcode", "itemnumber", "productcode", "code", "partnumber", "lineitem"}
DESC_KEYS = {"description", "lineitem", "item", "details", "particulars", "narration", "memo", "name"}
QTY_KEYS = {"quantity", "qty", "units"}
UNIT_KEYS = {"unit", "uom", "measure"}
PRICE_KEYS = {"unitprice", "rate", "price", "amount", "credit", "debit"}
TOTAL_KEYS = {"total", "amount", "lineamount", "linetotal", "subtotal", "extendedprice"}


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def _first_value(field: dict) -> Optional[dict]:
    vals = field.get("Values") or []
    return vals[0] if vals else None


def _value_text(v: Optional[dict]) -> str:
    if not v:
        return ""
    return str(v.get("Value", "")).strip()


def _confidence(v: Optional[dict]) -> float:
    if not v:
        return 0.0
    c = v.get("Confidence")
    try:
        c = float(c) if c is not None else 0.0
    except (TypeError, ValueError):
        c = 0.0
    # Some IXP responses already return 0..1; clamp defensively.
    if c > 1.0:
        c = c / 100.0
    return round(max(0.0, min(1.0, c)), 4)


def _to_number(s: str) -> Optional[float]:
    if s is None:
        return None
    txt = str(s).strip()
    if not txt:
        return None
    # Strip currency symbols and commas; keep sign and dot.
    cleaned = "".join(ch for ch in txt if ch.isdigit() or ch in "-.")
    if cleaned in ("", "-", ".", "-."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _page_of(v: Optional[dict]) -> int:
    if not v:
        return 1
    ref = v.get("Reference") or {}
    # Try a few known locations for the page index
    for path in [
        ("TextRanges", 0, "Page"),
        ("Geometry", "Pages", 0),
        ("Pages", 0),
    ]:
        cur: Any = ref
        ok = True
        for p in path:
            if isinstance(p, int):
                if not isinstance(cur, list) or p >= len(cur):
                    ok = False
                    break
                cur = cur[p]
            else:
                if not isinstance(cur, dict) or p not in cur:
                    ok = False
                    break
                cur = cur[p]
        if ok and isinstance(cur, (int, float)):
            n = int(cur)
            # UiPath pages are 0-indexed in some endpoints; normalize to 1-indexed.
            return max(1, n + 1 if n == 0 or (n < 1000 and "Page" not in str(path[-1])) else n) if n < 1 else n
    return 1


def _bbox_of(v: Optional[dict]) -> str:
    if not v:
        return ""
    ref = v.get("Reference") or {}
    geom = ref.get("Geometry") or {}
    boxes = geom.get("Boxes") or []
    if boxes and isinstance(boxes[0], dict):
        b = boxes[0]
        x = b.get("X") or b.get("Left") or 0
        y = b.get("Y") or b.get("Top") or 0
        w = b.get("Width") or 0
        h = b.get("Height") or 0
        return f"x={_round(x)} y={_round(y)} w={_round(w)} h={_round(h)}"
    return ""


def _round(n: Any) -> str:
    try:
        return str(round(float(n), 3))
    except (TypeError, ValueError):
        return str(n)


def _snippet_for(field: dict, v: Optional[dict]) -> str:
    """Build a short source-context string the UI can render with [highlighted]
    brackets around the value.
    """
    label = field.get("FieldName") or ""
    value = _value_text(v)
    if not value:
        return label
    return f"{label}: [{value}]"


def _classify_table(table_field: dict) -> str:
    """Decide whether this table is the main line-items table.

    For invoices/POs the largest table is usually line items; bank statements
    have a transactions table that maps the same way. Returns "lineitems" or
    "table".
    """
    name = (table_field.get("FieldName") or "").lower()
    if any(k in name for k in ("line", "transaction", "item", "service", "charge")):
        return "lineitems"
    # Default: the first table encountered becomes line items; the rest are
    # generic tables surfaced in the Analyse popup.
    return "table"


def _flatten_table_rows(table_field: dict) -> List[Dict[str, Any]]:
    """Walk Values[].Components[FieldName=='Body'].Values[].Components[]."""
    rows: List[Dict[str, Any]] = []
    for outer in table_field.get("Values", []) or []:
        for body in outer.get("Components", []) or []:
            if (body.get("FieldName") or "").lower() != "body":
                continue
            for row_val in body.get("Values", []) or []:
                row_cells: Dict[str, Dict[str, Any]] = {}
                for cell in row_val.get("Components", []) or []:
                    cell_name = cell.get("FieldName") or ""
                    cv = _first_value(cell)
                    row_cells[cell_name] = {
                        "value": _value_text(cv),
                        "confidence": _confidence(cv),
                        "missing": bool(cell.get("IsMissing")),
                        "page": _page_of(cv),
                    }
                rows.append(row_cells)
    return rows


def _map_row_to_lineitem(idx: int, row: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Best-effort map a raw row to the UI's line-item shape."""
    sku = ""
    description = ""
    sub_desc = ""
    qty: Optional[float] = None
    unit = ""
    unit_price: Optional[float] = None
    total: Optional[float] = None
    page = 1
    confs: List[float] = []

    leftover: List[str] = []  # columns we didn't recognise — fold into subDesc

    for raw_col, cell in row.items():
        if cell["missing"]:
            continue
        n = _norm(raw_col)
        val = cell["value"]
        page = max(page, cell["page"] or 1)
        if cell["confidence"]:
            confs.append(cell["confidence"])

        if not sku and n in SKU_KEYS:
            sku = val
        elif not description and n in DESC_KEYS:
            description = val
        elif qty is None and n in QTY_KEYS:
            qty = _to_number(val)
        elif not unit and n in UNIT_KEYS:
            unit = val
        elif unit_price is None and n in PRICE_KEYS:
            unit_price = _to_number(val)
        elif total is None and n in TOTAL_KEYS:
            total = _to_number(val)
        else:
            leftover.append(f"{raw_col}: {val}")

    if leftover:
        sub_desc = " · ".join(leftover[:3])

    # If a row had no description but had something, use the first non-empty value
    if not description and row:
        for raw_col, cell in row.items():
            if cell["value"] and not cell["missing"]:
                description = cell["value"]
                break

    avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0
    return {
        "id": f"li{idx + 1}",
        "sku": sku,
        "description": description or "(row)",
        "subDesc": sub_desc,
        "qty": qty if qty is not None else 0,
        "unit": unit,
        "unitPrice": unit_price if unit_price is not None else 0.0,
        "total": total if total is not None else (unit_price * qty if (unit_price is not None and qty is not None) else 0.0),
        "page": page,
        "confidence": avg_conf,
    }


def _detect_doc_type(project_name: str, fields: List[dict]) -> str:
    p = (project_name or "").lower()
    field_labels = " ".join((f.get("FieldName") or "").lower() for f in fields)
    if "invoice" in p or "invoice" in field_labels:
        return "Invoice"
    if "statement" in p or "statement" in field_labels or "transaction" in field_labels:
        return "Bank Statement"
    if "insurance" in p or "policy" in p or "policy" in field_labels or "premium" in field_labels:
        return "Insurance Policy"
    return "Document"


def uipath_to_ui(
    extraction_result: Dict[str, Any],
    *,
    filename: str,
    size_bytes: int,
    processed_ms: int,
    project_name: str = "",
) -> Dict[str, Any]:
    results_doc = (extraction_result or {}).get("extractionResult", {}).get("ResultsDocument", {}) or {}
    raw_fields = results_doc.get("Fields", []) or []
    page_count = int((results_doc.get("Bounds") or {}).get("PageCount") or 0) or 1

    fields_out: List[Dict[str, Any]] = []
    line_items_raw_rows: List[Dict[str, Dict[str, Any]]] = []
    tables_summary: List[Dict[str, Any]] = []
    lineitem_table_chosen = False

    for idx, field in enumerate(raw_fields):
        if field.get("IsMissing"):
            continue
        ftype = (field.get("FieldType") or "").lower()
        v = _first_value(field)

        if ftype == "table":
            rows = _flatten_table_rows(field)
            classification = _classify_table(field)
            # First table → line items (unless an explicit "line-items"-like name
            # appears later; for simplicity, first table wins).
            if classification == "lineitems" and not lineitem_table_chosen:
                line_items_raw_rows = rows
                lineitem_table_chosen = True
            elif not lineitem_table_chosen and rows:
                line_items_raw_rows = rows
                lineitem_table_chosen = True
            else:
                # Use the first row's page as the table page (or 1)
                tbl_page = 1
                if rows and rows[0]:
                    for cell in rows[0].values():
                        if cell.get("page"):
                            tbl_page = cell["page"]
                            break
                tables_summary.append({
                    "name": field.get("FieldName") or f"Table {len(tables_summary) + 1}",
                    "page": tbl_page,
                    "rows": len(rows),
                })
            continue

        value = _value_text(v)
        if not value:
            continue
        fields_out.append({
            "id": f"f{idx + 1}",
            "label": field.get("FieldName") or f"field{idx + 1}",
            "value": value,
            "confidence": _confidence(v),
            "page": _page_of(v),
            "bbox": _bbox_of(v),
            "snippet": _snippet_for(field, v),
        })

    # Also surface the chosen line-items table in the tables summary
    if lineitem_table_chosen and line_items_raw_rows:
        # Find the matching field name
        first_table_name = next((f.get("FieldName") for f in raw_fields if (f.get("FieldType") or "").lower() == "table"), "Line items")
        first_row_page = 1
        if line_items_raw_rows and line_items_raw_rows[0]:
            for cell in line_items_raw_rows[0].values():
                if cell.get("page"):
                    first_row_page = cell["page"]
                    break
        tables_summary.insert(0, {
            "name": first_table_name or "Line items",
            "page": first_row_page,
            "rows": len(line_items_raw_rows),
        })

    line_items_out = [_map_row_to_lineitem(i, r) for i, r in enumerate(line_items_raw_rows)]

    total_qty = sum((float(li.get("qty") or 0) for li in line_items_out))
    total_amount = sum((float(li.get("total") or 0) for li in line_items_out))

    return {
        "docType": _detect_doc_type(project_name, raw_fields),
        "documentMeta": {
            "filename": filename,
            "pages": page_count,
            "sizeKb": max(1, round((size_bytes or 0) / 1024)),
            "processedMs": int(processed_ms or 0),
        },
        "fields": fields_out,
        "lineItems": line_items_out,
        "lineItemTotals": {
            "qty": int(total_qty) if total_qty.is_integer() else round(total_qty, 2),
            "total": round(total_amount, 2),
            "currency": "",
        },
        "tables": tables_summary,
    }
