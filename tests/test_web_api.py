import json
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile

from fastapi.testclient import TestClient
from capacity_engine import calculate
from capacity_web.app import app

ROOT = Path(__file__).resolve().parents[1]


class WebApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_calculation_uses_same_core_for_all_profiles(self):
        for name in ("tta-appendix", "network", "network-guide"):
            with self.subTest(name=name):
                request = json.loads((ROOT / f"examples/{name}.json").read_text())
                response = self.client.post("/api/calculate", json=request)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), calculate(request))

    def test_migration_http_and_metadata(self):
        request = json.loads((ROOT / "examples/migration.json").read_text())
        r = self.client.post("/api/migrate", json=request).json()
        self.assertEqual(r["requirements"]["vcpu"]["value"], "9.6")
        bootstrap = self.client.get("/api/bootstrap").json()
        self.assertEqual(len(bootstrap["formulas"]), 21)
        self.assertEqual(bootstrap["source_count"], 36)
        self.assertEqual(bootstrap["catalog"]["region"], "ap-northeast-2")

    def test_optimization_http_uses_exact_measurements(self):
        request = json.loads((ROOT / "examples/migration.json").read_text())
        request["environment"] = "onprem"
        request["asset"].update(memory_usage_mode="percent", peak_memory_percent="50")
        r = self.client.post("/api/optimize", json=request)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["requirements"]["memory_gib"]["value"], "47")
        self.assertEqual(
            self.client.post("/api/optimize", content='{"x":1,"x":2}').status_code, 400
        )

    def test_invalid_json_limits_and_duplicate_keys(self):
        for value in ['{"x":1,"x":2}', '{"x":NaN}', "not json", b"\xff"]:
            self.assertEqual(
                self.client.post("/api/migrate", content=value).status_code, 400
            )
        self.assertEqual(
            self.client.post(
                "/api/migrate", content="x" * (2 * 1024 * 1024 + 1)
            ).status_code,
            413,
        )
        self.assertEqual(self.client.post("/api/migrate", json=None).status_code, 400)
        self.assertEqual(
            self.client.post("/api/migrate", content="null").json()["status"], "invalid"
        )

    def test_documents_search_and_source_allowlist(self):
        response = self.client.get("/api/documents/concepts/cloud-security.md")
        self.assertEqual(response.status_code, 200)
        self.assertIn("39", response.json()["markdown"])
        self.assertTrue(
            self.client.get("/api/search", params={"q": "gp3"}).json()["results"]
        )
        for path in (
            "/api/documents/%2e%2e%2fAGENTS.md",
            "/api/sources/not-registered/original",
            "/api/unknown",
            "/%2e%2e%2fAGENTS.md",
        ):
            self.assertEqual(self.client.get(path).status_code, 404)
        # Synthetic original keeps the public clone test independent of private PDFs.
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "source.pdf"
            fixture.write_bytes(b"%PDF-1.4 synthetic")
            manifest = {
                "sources": [{"id": "test", "path": str(fixture), "format": "pdf"}]
            }
            with patch("capacity_web.app.read_json", return_value=manifest):
                source = self.client.get("/api/sources/test/original")
                self.assertEqual(source.headers["content-type"], "application/pdf")
                self.assertTrue(source.content.startswith(b"%PDF"))
                fixture.unlink()
                self.assertEqual(
                    self.client.get("/api/sources/test/original").status_code, 404
                )

    def test_untrusted_host_rejected(self):
        self.assertEqual(
            self.client.get(
                "/api/health", headers={"host": "evil.example"}
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
