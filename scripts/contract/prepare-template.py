"""
Builds the rental-agreement template used by the `contract-*` edge functions.

Source: files/Leiekontrakt_EN.pdf (blank English rental agreement).
Output: supabase/functions/_shared/contract/rental-agreement-en.template.pdf

The source PDF has pre-printed placeholder amounts on page 1 that conflict with the
values we stamp per booking ("NOK 0,000" for Agreed rent and Total, "NOK 2,000" for
Deposit). Covering them with a white box would leave the old text in the signed
document's text layer, so instead the three text-show operators are emptied in the
content stream.

The pre-printed "Included KM during the rental period: 150" is a fixed business term
(the rental is km-unlimited), so its value operator is replaced with "Free" rather than
stamped per booking. Nothing else in the document is touched.

Usage (requires `pip install pypdf`):
    python scripts/contract/prepare-template.py
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, NameObject, TextStringObject

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "files" / "Leiekontrakt_EN.pdf"
TARGET = ROOT / "supabase" / "functions" / "_shared" / "contract" / "rental-agreement-en.template.pdf"

# Exact placeholder strings to blank on page 1, with how many times each must occur.
PLACEHOLDERS = {"NOK 0,000": 2, "NOK 2,000": 1}

# Exact value operators to rewrite on page 1 (old -> new), with how many times each must occur.
REPLACEMENTS = {" 150": (" Free", 1)}


def main() -> int:
    reader = PdfReader(str(SOURCE))
    writer = PdfWriter(clone_from=reader)
    page = writer.pages[0]

    content = ContentStream(page.get_contents(), writer)
    removed: dict[str, int] = {key: 0 for key in PLACEHOLDERS}
    replaced: dict[str, int] = {key: 0 for key in REPLACEMENTS}
    for operands, operator in content.operations:
        if operator != b"Tj" or not operands:
            continue
        text = str(operands[0])
        if text in PLACEHOLDERS:
            operands[0] = TextStringObject("")
            removed[text] += 1
        elif text in REPLACEMENTS:
            operands[0] = TextStringObject(REPLACEMENTS[text][0])
            replaced[text] += 1

    if removed != PLACEHOLDERS:
        print(f"Unexpected template layout, placeholders removed: {removed}", file=sys.stderr)
        return 1
    if replaced != {key: count for key, (_new, count) in REPLACEMENTS.items()}:
        print(f"Unexpected template layout, replacements applied: {replaced}", file=sys.stderr)
        return 1

    page[NameObject("/Contents")] = writer._add_object(content)  # noqa: SLF001 - pypdf has no public setter
    writer.add_metadata({"/Title": "Rental Agreement - Prime Norge AS"})

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with TARGET.open("wb") as handle:
        writer.write(handle)

    digest = hashlib.sha256(TARGET.read_bytes()).hexdigest()
    print(f"Wrote {TARGET.relative_to(ROOT)} (sha256 {digest})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
