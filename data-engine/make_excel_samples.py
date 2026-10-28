#!/usr/bin/env python3
"""Writes an Excel (.xlsx) copy of every demo CSV in public/demo-data. All data is SIMULATED.
Times become real Excel date-times (UTC); numbers stay numbers; empty cells stay empty."""
import csv, datetime as dt, glob, os
from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "demo-data")
TIME_COLS = {"t", "time", "planned_start"}

def cell(col, v):
    if v == "":
        return None
    if col in TIME_COLS:
        return dt.datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
    try:
        return int(v) if v.lstrip("-").isdigit() else float(v)
    except ValueError:
        return v

for path in sorted(glob.glob(os.path.join(OUT, "*.csv"))):
    with open(path, newline="") as f:
        rows = list(csv.reader(f))
    head = rows[0]
    wb = Workbook()
    ws = wb.active
    ws.title = "data"
    ws.append(head)
    for r in rows[1:]:
        ws.append([cell(c, v) for c, v in zip(head, r)])
    for i, c in enumerate(head, start=1):
        if c in TIME_COLS:
            for row in ws.iter_rows(min_row=2, min_col=i, max_col=i):
                row[0].number_format = "yyyy-mm-dd hh:mm:ss"
        ws.column_dimensions[ws.cell(1, i).column_letter].width = max(10, len(c) + 4)
    wb.save(path[:-4] + ".xlsx")
print("Excel samples written to", os.path.abspath(OUT))
