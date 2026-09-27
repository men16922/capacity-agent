"""Mutate a tiny corpus to prove the gate detects lost provenance and broken links."""

import json
from pathlib import Path
import tempfile
import unittest
from scripts.check_wiki import check, digest


class WikiGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        for d in ("reference", "wiki/sources/extracted", "wiki/formulas"):
            (self.root / d).mkdir(parents=True)
        (self.root / "reference/source.pdf").write_bytes(b"fixture source")
        (self.root / "wiki/index.md").write_text("# Wiki\n[Source](sources/s.md)\n")
        (self.root / "wiki/sources/s.md").write_text(
            "# Source\n[Original](../../reference/source.pdf)\n"
        )
        self.write_json("wiki/sources/extracted/s.json", {"source_id": "s"})
        self.manifest = {
            "original_file_count": 1,
            "unique_source_count": 1,
            "sources": [
                {
                    "id": "s",
                    "path": "reference/source.pdf",
                    "aliases": [],
                    "page_count": 2,
                    "sha256": digest(self.root / "reference/source.pdf"),
                    "card": "wiki/sources/s.md",
                    "extraction": "wiki/sources/extracted/s.json",
                    "extraction_sha256": digest(
                        self.root / "wiki/sources/extracted/s.json"
                    ),
                }
            ],
        }
        self.write_json("wiki/sources/manifest.json", self.manifest)
        self.catalog = {
            "rules": [
                {
                    "id": "R",
                    "source_id": "s",
                    "source_pages": [2],
                    "inputs": ["x"],
                    "output_unit": "MB",
                    "expression": "x",
                }
            ]
        }
        self.write_json("wiki/formulas/catalog.json", self.catalog)
        self.write_json("wiki/formulas/examples.json", {"examples": []})

    def write_json(self, rel, value):
        (self.root / rel).write_text(json.dumps(value))

    def assert_detected(self, marker):
        errors, _ = check(self.root)
        self.assertTrue(any(marker in e for e in errors), errors)

    def test_intact_corpus_passes(self):
        self.assertEqual(check(self.root)[0], [])

    def test_public_checkout_allows_only_registered_local_material(self):
        (self.root / "reference/source.pdf").unlink()
        (self.root / "reference").rmdir()
        (self.root / "wiki/sources/extracted/s.json").unlink()
        self.assertEqual(check(self.root)[0], [])
        self.assertTrue(check(self.root, require_sources=True)[0])
        (self.root / "wiki/sources/s.md").write_text(
            "[Missing](../../reference/unregistered.pdf)"
        )
        self.assert_detected("Broken link")

    def test_partial_local_corpus_requires_completeness(self):
        (self.root / "reference/source.pdf").unlink()
        self.assert_detected("Source missing")

    def test_source_drift_is_detected(self):
        (self.root / "reference/source.pdf").write_bytes(b"changed")
        self.assert_detected("hash changed")

    def test_unregistered_reference_is_detected(self):
        (self.root / "reference/new.pdf").write_bytes(b"new")
        self.assert_detected("coverage mismatch")

    def test_extraction_drift_is_detected(self):
        self.write_json(
            "wiki/sources/extracted/s.json", {"source_id": "s", "changed": True}
        )
        self.assert_detected("Extraction hash changed")

    def test_broken_link_is_detected(self):
        (self.root / "wiki/sources/s.md").write_text("[Missing](missing.md)")
        self.assert_detected("Broken link")

    def test_orphan_page_is_detected(self):
        (self.root / "wiki/orphan.md").write_text("# Orphan")
        self.assert_detected("Unreachable")

    def test_out_of_range_formula_page_is_detected(self):
        self.catalog["rules"][0]["source_pages"] = [3]
        self.write_json("wiki/formulas/catalog.json", self.catalog)
        self.assert_detected("Invalid formula source/pages")

    def test_example_input_contract_mismatch_is_detected(self):
        self.write_json(
            "wiki/formulas/examples.json",
            {
                "examples": [
                    {
                        "id": "E",
                        "formula_id": "R",
                        "source_id": "s",
                        "source_pages": [1],
                        "inputs": {"wrong": "1"},
                        "independent_decimal_result": "1",
                    }
                ]
            },
        )
        self.assert_detected("Example input mismatch")


if __name__ == "__main__":
    unittest.main()
