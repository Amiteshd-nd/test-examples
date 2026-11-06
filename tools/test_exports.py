"""ezdxf checks of PlanCraft's DXF exports (P1.3): every file in data/exports/check/ must load
with ezdxf's strict reader, pass its audit, be in millimetres and use the standard layers.
Run with `npm run test:dxf` (writes the exports first)."""
import pathlib

import ezdxf
import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = sorted((ROOT / "data" / "exports" / "check").glob("*.dxf"))
LAYERS = {"A-WALL", "A-WALL-INT", "A-DOOR", "A-GLAZ", "A-FLOR-STRS", "A-AREA-IDEN",
          "A-ANNO-DIMS", "A-ANNO-TEXT", "A-SITE-BNDY", "A-SITE-SETB"}


def test_there_are_exports_to_check():
    assert FILES, "run `node tools/export-samples.ts` first"


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_export_is_clean(path):
    doc = ezdxf.readfile(path)  # raises on a structural error
    auditor = doc.audit()
    assert not auditor.errors, [e.message for e in auditor.errors]
    assert not auditor.fixes, [f.message for f in auditor.fixes]
    assert doc.dxfversion == "AC1015"
    assert doc.header["$INSUNITS"] == 4
    assert LAYERS <= {layer.dxf.name for layer in doc.layers}
    used = {e.dxf.layer for e in doc.modelspace()}
    assert "A-WALL" in used and "A-AREA-IDEN" in used
