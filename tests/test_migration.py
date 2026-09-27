from copy import deepcopy
from decimal import localcontext
import json
from pathlib import Path
import unittest

from capacity_web.migration import calculate_migration, catalog

ROOT = Path(__file__).resolve().parents[1]


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.request = json.loads((ROOT / "examples/migration.json").read_text())

    def result(self):
        return calculate_migration(self.request)

    def test_independent_workbook_example_and_official_cost(self):
        r = self.result()
        self.assertEqual(r["requirements"]["vcpu"]["value"], "9.6")
        self.assertEqual(r["requirements"]["memory_gib"]["value"], "47")
        self.assertEqual(r["storage"]["size_gib"], 450)
        self.assertEqual(r["candidates"][0]["instance_type"], "m8i.4xlarge")
        c = r["candidates"][0]["cost"]
        self.assertEqual(c["compute_monthly"], "759.7256")
        self.assertEqual(c["ebs_monthly"], "61.56")
        self.assertEqual(c["total_monthly"], "821.2856")

    def test_surviving_nodes_and_fixed_memory_replication(self):
        self.request["plan"].update(
            target_nodes="3", tolerated_failures="1", distribution_verified=True
        )
        r = self.result()
        self.assertEqual(r["requirements"]["vcpu"]["value"], "4.8")
        self.assertEqual(r["requirements"]["memory_gib"]["value"], "26")
        self.request["plan"]["distribution_verified"] = False
        self.assertEqual(self.result()["requirements"]["memory_gib"]["value"], "47")

    def test_compound_growth_and_relative_performance(self):
        self.request["plan"]["years"] = "2"
        r = self.result()
        self.assertEqual(r["requirements"]["vcpu"]["value"], "11.52")
        self.assertEqual(r["requirements"]["memory_gib"]["value"], "55.4")
        self.request["plan"]["relative_performance"] = "2"
        self.assertEqual(self.result()["requirements"]["vcpu"]["value"], "5.76")

    def test_direct_mode_does_not_apply_growth_or_ha_twice(self):
        self.request["plan"].update(
            mode="direct",
            direct_vcpu="8",
            direct_memory_gib="32",
            growth_percent="99",
            target_nodes="3",
            tolerated_failures="1",
            distribution_verified=True,
        )
        self.request["asset"]["peak_cpu_percent"] = ""
        self.request["asset"]["peak_memory_gib"] = ""
        r = self.result()
        self.assertEqual(r["requirements"]["vcpu"]["value"], "8")
        self.assertEqual(r["requirements"]["memory_gib"]["value"], "32")

    def test_arm_requires_linux_and_explicit_compatibility(self):
        self.request["plan"]["architecture"] = "arm64"
        self.assertEqual(self.result()["status"], "invalid")
        self.request["plan"]["arm_verified"] = True
        self.assertTrue(
            all(c["architecture"] == "arm64" for c in self.result()["candidates"])
        )
        self.request["plan"]["os"] = "Windows"
        self.assertEqual(self.result()["status"], "invalid")

    def test_windows_uses_license_included_rate(self):
        self.request["plan"]["os"] = "Windows"
        c = self.result()["candidates"][0]
        self.assertEqual(c["cost"]["hourly_price"]["operation"], "RunInstances:0002")
        self.assertEqual(c["cost"]["hourly_price"]["usd"], "1.7767200000")

    def test_mibps_conversion_uses_sustained_ebs_limits(self):
        self.request["plan"].update(
            mode="direct",
            direct_vcpu="1",
            direct_memory_gib="1",
            family="M",
            ebs_iops="0",
            network_gbps="0",
            ebs_throughput_mibps="300",
        )
        r = self.result()
        self.assertEqual(r["candidates"][0]["instance_type"], "m8i.4xlarge")
        self.assertIn(
            "ebs_throughput",
            next(x for x in r["rejected"] if x["instance_type"] == "m8i.2xlarge")[
                "reasons"
            ],
        )

    def test_gp3_baseline_and_ratio_boundaries(self):
        self.request["asset"]["disk_gib"] = "0"
        self.request["plan"].update(ebs_iops="0", ebs_throughput_mibps="0")
        s = self.result()["storage"]
        self.assertEqual(
            (s["size_gib"], s["iops"], s["throughput_mibps"]), (1, 3000, 125)
        )
        self.request["plan"]["ebs_iops"] = "3001"
        self.assertEqual(self.result()["storage"]["size_gib"], 7)
        self.request["plan"].update(ebs_iops="80000", ebs_throughput_mibps="2000")
        self.assertEqual(self.result()["storage"]["size_gib"], 160)
        self.request["plan"]["ebs_iops"] = "80001"
        self.assertEqual(self.result()["status"], "no_candidates")

    def test_required_zero_missing_and_bad_types(self):
        for value in [None, "", True, 16, 1.5, [], {}, "NaN", "1e2", "-1"]:
            with self.subTest(value=value):
                q = deepcopy(self.request)
                q["asset"]["vcpu"] = value
                self.assertEqual(calculate_migration(q)["status"], "invalid")
        for key in [
            "target_nodes",
            "cpu_target_percent",
            "memory_target_percent",
            "relative_performance",
        ]:
            with self.subTest(key=key):
                q = deepcopy(self.request)
                q["plan"][key] = "0"
                self.assertEqual(calculate_migration(q)["status"], "invalid")

    def test_inconsistent_memory_failures_and_region(self):
        for changes in [
            {"fixed_memory_gib": "33"},
            {"tolerated_failures": "1"},
            {"region": "us-east-1"},
            {"years": "1.5"},
            {"distribution_verified": "false"},
        ]:
            q = deepcopy(self.request)
            q["plan"].update(changes)
            self.assertEqual(calculate_migration(q)["status"], "invalid")
        self.request["asset"]["peak_memory_gib"] = "65"
        self.assertEqual(self.result()["status"], "invalid")

    def test_unknown_prices_do_not_turn_into_zero(self):
        data = catalog()
        for item in data["instances"]:
            item["prices"] = {}
        r = calculate_migration(self.request, data)
        self.assertIsNone(r["candidates"][0]["cost"]["compute_monthly"])
        self.assertIsNone(r["candidates"][0]["cost"]["total_monthly"])
        self.assertEqual(r["candidates"][0]["cost"]["ebs_monthly"], "61.56")

    def test_catalog_provenance_and_no_mutation_or_decimal_context_leak(self):
        before = deepcopy(self.request)
        r = self.result()
        with localcontext() as c:
            c.prec = 3
            self.assertEqual(r, self.result())
        self.assertEqual(self.request, before)
        self.assertEqual(len(r["provenance"]["catalog_sha256"]), 64)
        self.assertEqual(len(catalog()["instances"]), 36)

    def test_bad_structure_does_not_raise(self):
        for q in [
            None,
            [],
            "",
            3,
            {},
            {"schema_version": 1, "asset": [], "plan": True},
        ]:
            self.assertEqual(calculate_migration(q)["status"], "invalid")


if __name__ == "__main__":
    unittest.main()
