import json
import unittest
from copy import deepcopy
from pathlib import Path
from capacity_web.optimization import calculate_optimization
from capacity_web.migration import calculate_migration


class OptimizationTests(unittest.TestCase):
    def setUp(self):
        self.request = json.loads(
            (
                Path(__file__).resolve().parents[1] / "examples/migration.json"
            ).read_text()
        )
        self.request["environment"] = "onprem"

    def test_independent_requirements_and_ceiling(self):
        r = calculate_optimization(self.request)
        self.assertEqual(r["status"], "complete")
        # 16 * .35 * 1.2 / .7 = 9.6; ((32-4)*1.2+4)/.8=47
        for key, raw, minimum in [
            ("vcpu", "9.6", 10),
            ("memory_gib", "47", 47),
            ("disk_gib", "450", 450),
        ]:
            self.assertEqual(r["requirements"][key]["value"], raw)
            self.assertEqual(r["requirements"][key]["minimum"], minimum)
        self.assertEqual(
            r["requirements"]["vcpu"]["exact"], {"numerator": "48", "denominator": "5"}
        )

    def test_amount_percent_equivalence_in_both_models_and_input_immutability(self):
        percent = deepcopy(self.request)
        percent["asset"].update(
            memory_usage_mode="percent",
            peak_memory_percent="50",
            peak_memory_gib="1",
            disk_usage_mode="percent",
            disk_allocated_gib="500",
            disk_used_percent="60",
            disk_gib="1",
        )
        before = deepcopy(percent)
        for calculate in [calculate_optimization, calculate_migration]:
            amount = calculate(self.request)
            measured = calculate(percent)
            self.assertEqual(measured["status"], "complete")
            self.assertEqual(measured["requirements"], amount["requirements"])
        self.assertEqual(percent, before)

    def test_invalid_measurements_and_assumptions(self):
        for group, key, value in [
            ("asset", "peak_cpu_percent", "0"),
            ("asset", "peak_cpu_percent", "101"),
            ("asset", "memory_usage_mode", "bogus"),
            ("asset", "disk_allocated_gib", "299"),
            ("asset", "source", ""),
            ("asset", "observed_on", "2026-02-30"),
            ("plan", "cpu_target_percent", "0"),
            ("plan", "memory_target_percent", "101"),
            ("plan", "storage_reserve_percent", "100"),
            ("plan", "years", "1.5"),
            ("plan", "fixed_memory_gib", "33"),
        ]:
            with self.subTest(key=key, value=value):
                bad = deepcopy(self.request)
                bad[group][key] = value
                self.assertEqual(calculate_optimization(bad)["status"], "invalid")
        for value in ["", "101", "-1", 50, None]:
            with self.subTest(percent=value):
                bad = deepcopy(self.request)
                bad["asset"].update(
                    memory_usage_mode="percent", peak_memory_percent=value
                )
                self.assertEqual(calculate_optimization(bad)["status"], "invalid")
        for value in [None, [], 3, {"schema_version": True}]:
            self.assertEqual(calculate_optimization(value)["status"], "invalid")

    def test_aws_cost_like_for_like_and_no_invented_saving(self):
        self.request["environment"] = "aws"
        self.request["asset"].update(
            instance_type="m8i.4xlarge",
            disk_allocated_gib="500",
            current_iops="6000",
            current_throughput_mibps="200",
        )
        r = calculate_optimization(self.request)
        self.assertEqual(r["status"], "complete")
        # Existing 500 GiB vs proposed 450 GiB at .0912 USD/GiB-month.
        self.assertEqual(r["baseline_cost"]["total_monthly"], "825.8456")
        self.assertEqual(r["monthly_difference"], "4.56")
        self.request["asset"].pop("current_iops")
        r = calculate_optimization(self.request)
        self.assertIsNone(r["baseline_cost"])
        self.assertIsNone(r["monthly_difference"])

    def test_aws_invalid_baseline_and_no_candidate(self):
        self.request["environment"] = "aws"
        self.request["asset"]["instance_type"] = "m8i.large"
        self.assertEqual(calculate_optimization(self.request)["status"], "invalid")
        self.request["asset"]["instance_type"] = "m8i.4xlarge"
        self.request["plan"]["network_gbps"] = "10000"
        r = calculate_optimization(self.request)
        self.assertEqual(r["status"], "no_candidates")
        self.assertIsNone(r["monthly_difference"])
        self.request["asset"].update(
            disk_allocated_gib="500",
            current_iops="3000",
            current_throughput_mibps="2000",
        )
        self.assertEqual(calculate_optimization(self.request)["status"], "invalid")
