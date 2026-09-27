"""Source examples, exact independent arithmetic, invariants and hostile inputs."""

from copy import deepcopy
from decimal import Decimal, localcontext
from fractions import Fraction
import json
from pathlib import Path
import subprocess
import sys
import unittest

from capacity_engine import calculate, compare_benchmark, requirement_from_result
from capacity_engine.benchmarks import CONFIG_FIELDS
from capacity_engine.numeric import SOURCE_MB, convert, number, rounded
from capacity_engine.rules import ARCHITECTURES, SPECS

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / "examples/tta-appendix.json").read_text())
NETWORK = json.loads((ROOT / "examples/network.json").read_text())
GUIDE = json.loads((ROOT / "examples/network-guide.json").read_text())
BENCH = json.loads((ROOT / "tests/fixtures/benchmark-compatible.json").read_text())


def single(index=0):
    req = deepcopy(BASE)
    req["calculations"] = [req["calculations"][index]]
    return req


def value(req, key, text, index=0):
    req["calculations"][index]["inputs"][key]["value"] = text


def rational(record):
    return Fraction(
        int(record["exact_value"]["numerator"]),
        int(record["exact_value"]["denominator"]),
    )


class EngineTests(unittest.TestCase):
    def result(self, req):
        response = calculate(req)
        self.assertEqual(response["status"], "calculated", response)
        return response["results"][0]

    def test_four_source_examples_match_independent_decimal(self):
        examples = json.loads((ROOT / "wiki/formulas/examples.json").read_text())[
            "examples"
        ]
        for idx, ex in zip((0, 1, 2, 4), examples):
            with self.subTest(ex=ex["id"]):
                result = self.result(single(idx))
                self.assertEqual(
                    Decimal(result["base_value"]),
                    Decimal(ex["independent_decimal_result"]),
                )
                self.assertEqual(result["source_refs"][0]["source_id"], "tta-r3")

    def test_oltp_data_and_iops_match_independent_fraction(self):
        results = {r["id"]: r for r in calculate(BASE)["results"]}
        expected = Fraction(
            7472 * 5 * 13 * 17 * 12 * 17 * 11 * 1 * 13, 10**6
        ) / Fraction(7, 10)
        self.assertEqual(rational(results["db-cpu"]), expected)
        self.assertEqual(rational(results["db-oltp-iops"]), expected * Fraction(3, 100))
        self.assertEqual(
            rational(results["db-batch-iops"]), expected * Fraction(1, 100)
        )
        self.assertEqual(rational(results["db-data-disk"]), Fraction(11460735, 100))

    def test_all_architecture_roles_apply_one_weight(self):
        for architecture, roles in ARCHITECTURES.items():
            for role, (fid, factor) in roles.items():
                with self.subTest(architecture=architecture, role=role):
                    req = single(0 if fid == "TTA-WEB-CPU" else 3)
                    job = req["calculations"][0]
                    job["options"].update(architecture=architecture, role=role)
                    if role == "WEB":
                        value(req, "S4", "0.7")
                        value(req, "S7", "1")
                    result = self.result(req)
                    base = Fraction(
                        int(result["trace"]["base_exact"]["numerator"]),
                        int(result["trace"]["base_exact"]["denominator"]),
                    )
                    self.assertEqual(rational(result), base * Fraction(factor))
                    self.assertIn(19, result["source_refs"][0]["pages"])

    def test_architecture_formula_and_duplicate_weight_rejected(self):
        for mutate in (
            lambda j: j["options"].update(
                architecture="single-tier", role="WEB_WAS_DB"
            ),
            lambda j: j["options"].update(architecture_weight="1.6"),
            lambda j: j["inputs"].update(extra_weight=deepcopy(j["inputs"]["S9"])),
            lambda j: j["inputs"]["S4"].update(value="1.6"),
        ):
            req = single()
            mutate(req["calculations"][0])
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_spec_category_server_factor_and_purpose(self):
        for category, server, factor in [
            ("Composite", "x86", "29"),
            ("Composite", "unix", "31"),
            ("MultiJVM", "general", "25"),
            ("MultiJVM", "x86", "24"),
            ("MultiJVM", "unix", "26"),
        ]:
            req = single()
            req["calculations"][0]["options"].update(
                benchmark_category=category, server_class=server
            )
            value(req, "S11", factor)
            self.result(req)
            value(req, "S11", "30")
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_source_fixed_coefficients_cannot_be_overridden(self):
        for idx, key in ((0, "S3"), (3, "O2")):
            req = single(idx)
            value(req, key, "4")
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_missing_zero_and_partial_results(self):
        req = single()
        value(req, "S1", "0")
        self.assertEqual(self.result(req)["raw_value"], "0")
        value(req, "S1", None)
        response = calculate(req)
        self.assertEqual(response["status"], "incomplete")
        self.assertNotIn("raw_value", response["results"][0])
        del req["calculations"][0]["inputs"]["S1"]
        self.assertEqual(calculate(req)["status"], "incomplete")
        req = deepcopy(BASE)
        value(req, "S1", None)
        results = calculate(req)["results"]
        self.assertEqual(results[0]["status"], "incomplete")
        self.assertEqual(results[3]["status"], "calculated")

    def test_invalid_decimal_values_and_integer_counts(self):
        for invalid in (
            True,
            1,
            1.2,
            {},
            [],
            "NaN",
            "Infinity",
            "1e3",
            " 1",
            "1 ",
            "+1",
            "1,000",
            "35%",
            "01",
            "-1",
            "1.1",
            "9" * 31,
        ):
            with self.subTest(value=invalid):
                req = single()
                value(req, "S1", invalid)
                self.assertEqual(calculate(req)["status"], "invalid")

    def test_utilization_bounds_and_percent_normalization(self):
        for invalid in ("0", "-0.1", "1.0001"):
            req = single()
            value(req, "S10", invalid)
            self.assertEqual(calculate(req)["status"], "invalid")
        expected = self.result(single())["raw_value"]
        req = single()
        req["calculations"][0]["inputs"]["S10"].update(value="70", unit="percent")
        self.assertEqual(self.result(req)["raw_value"], expected)
        req["calculations"][0]["inputs"]["S9"].update(value="30", unit="percent")
        self.assertEqual(calculate(req)["status"], "invalid")

    def test_dimension_and_ambiguous_unit_guard(self):
        req = single(1)
        req["calculations"][0]["inputs"]["M1"]["unit"] = "tpmC"
        self.assertEqual(calculate(req)["status"], "invalid")
        req = single(1)
        req["calculations"][0]["options"]["capacity_unit"] = "GiB"
        self.assertEqual(calculate(req)["status"], "invalid")
        self.assertEqual(self.result(single(1))["unit"], SOURCE_MB)

    def test_mixed_explicit_capacity_units_normalize_exactly(self):
        req = single(1)
        j = req["calculations"][0]
        j["options"]["capacity_unit"] = "GiB"
        j["inputs"]["M1"].update(value="1", unit="GiB")
        j["inputs"]["M2"].update(value="1", unit="MiB/user")
        j["inputs"]["M3"].update(value="1024")
        j["inputs"]["M5"].update(value="1073741824", unit="B")
        j["inputs"]["M4"].update(value="1")
        j["inputs"]["M6"].update(value="1")
        self.assertEqual(self.result(req)["raw_value"], "3")
        self.assertEqual(convert(Fraction(1), "MB", "MiB"), Fraction(15625, 16384))

    def test_memory_concurrency_must_match_cpu_for_same_system(self):
        req = deepcopy(BASE)
        value(req, "M3", "1100", 1)
        self.assertEqual(calculate(req)["results"][1]["status"], "invalid")

    def test_raid_matches_coefficient_and_no_hidden_formatting(self):
        req = single(2)
        for raid, factor in [
            ("none", "1"),
            ("RAID1", "2"),
            ("RAID10", "2"),
            ("RAID01", "2"),
            ("RAID5", "1.3"),
            ("RAID6", "1.4"),
        ]:
            req["calculations"][0]["options"]["raid"] = raid
            value(req, "D8", factor)
            self.assertEqual(
                rational(self.result(req)),
                Fraction(30720) * Fraction("1.1") * Fraction("1.3") * Fraction(factor),
            )
        value(req, "D8", "2")
        self.assertEqual(calculate(req)["status"], "invalid")

    def test_iops_references_forward_order_and_final_weight(self):
        req = deepcopy(BASE)
        db = req["calculations"][3]
        iops = req["calculations"][6]
        db["options"].update(architecture="single-tier", role="WEB_WAS_DB")
        req["calculations"] = [iops, db]
        response = calculate(req)
        self.assertEqual(response["status"], "calculated")
        self.assertEqual(
            rational(response["results"][0]),
            rational(response["results"][1]) * Fraction(3, 100),
        )

    def test_iops_references_invalid_missing_cross_system_and_unavailable(self):
        for ref in ("missing", "web-cpu", "db-oltp-iops"):
            req = deepcopy(BASE)
            req["calculations"][6]["inputs"]["oltp_tpmC"]["result_ref"] = ref
            self.assertEqual(calculate(req)["results"][6]["status"], "invalid")
        req = deepcopy(BASE)
        value(req, "O1", None, 3)
        self.assertEqual(calculate(req)["results"][6]["status"], "incomplete")
        value(req, "O10", "0", 3)
        self.assertEqual(calculate(req)["results"][6]["status"], "invalid")
        req = deepcopy(BASE)
        req["calculations"][6]["system_id"] = "other"
        self.assertEqual(calculate(req)["results"][6]["status"], "invalid")

    def test_wrong_profile_version_unknown_fields_duplicate_jobs(self):
        for key, val in [
            ("profile_id", "legacy-xls"),
            ("rule_version", "draft-1"),
            ("schema_version", True),
            ("extra", "x"),
        ]:
            req = single()
            req[key] = val
            self.assertEqual(calculate(req)["status"], "invalid")
        req = single()
        req["calculations"] *= 2
        self.assertEqual(calculate(req)["status"], "invalid")
        req = single()
        dup = deepcopy(req["calculations"][0])
        dup["id"] = "other"
        req["calculations"].append(dup)
        self.assertEqual(calculate(req)["status"], "invalid")
        req = single()
        req["profile_id"] = "lecture-network"
        self.assertEqual(calculate(req)["status"], "invalid")

    def test_provenance_and_dates_are_required(self):
        for change in (
            {"evidence": ""},
            {"origin": "LLM-guessed"},
            {"as_of": "2026-02-30"},
            {"as_of": "2026-09-28"},
        ):
            req = single()
            req["calculations"][0]["inputs"]["S1"].update(change)
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_rounding_is_display_only_and_allocation_never_undersizes(self):
        req = single(1)
        req["calculations"][0]["options"].update(
            display_places=0, allocation_increment="4096"
        )
        result = self.result(req)
        self.assertEqual(result["raw_value"], "5585.32")
        self.assertEqual(result["display_value"], "5585")
        self.assertEqual(result["minimum_whole_value"], "5586")
        self.assertEqual(result["allocated_value"], "8192")
        for quantum in ("1", "0.01", "1000", "4096"):
            req["calculations"][0]["options"]["allocation_increment"] = quantum
            result = self.result(req)
            allocation = Fraction(result["allocated_value"])
            self.assertGreaterEqual(allocation, rational(result))
            self.assertLess(allocation - rational(result), Fraction(quantum))
        self.assertEqual(rounded(Fraction("1.005"), 2), "1.01")
        self.assertEqual(
            rounded(Fraction("1.0000000000000000000000001"), 0, "ceiling"), "2"
        )

    def test_decimal_context_input_mutation_and_result_determinism(self):
        snapshot = deepcopy(BASE)
        first = calculate(BASE)
        with localcontext() as context:
            context.prec = 3
            second = calculate(BASE)
        self.assertEqual(first, second)
        self.assertEqual(BASE, snapshot)
        first["results"][0]["raw_value"] = "corrupted"
        self.assertEqual(calculate(BASE), second)

    def test_monotonic_load_memory_disk_and_utilization(self):
        for idx, key in [(0, "S1"), (3, "O1"), (1, "M1"), (2, "D1"), (5, "D6")]:
            req = single(idx)
            before = rational(self.result(req))
            old = number(req["calculations"][0]["inputs"][key]["value"])
            value(req, key, str(int(old) + 100))
            self.assertGreater(rational(self.result(req)), before)
        for idx, key in [(0, "S10"), (3, "O10")]:
            req = single(idx)
            before = rational(self.result(req))
            value(req, key, "0.5")
            self.assertGreater(rational(self.result(req)), before)

    def test_zero_memory_and_disk_remain_zero(self):
        for idx, keys in [
            (1, ["M1", "M2", "M5"]),
            (2, ["D1", "D2", "D3"]),
            (5, ["D6", "D7"]),
        ]:
            req = single(idx)
            for key in keys:
                value(req, key, "0")
            self.assertEqual(self.result(req)["raw_value"], "0")

    def test_all_network_rules_and_round_up(self):
        response = calculate(NETWORK)
        self.assertEqual(response["status"], "calculated", response)
        results = response["results"]
        self.assertEqual(
            [x["raw_value"] for x in results], ["1000000000", "27.72", "12", "88"]
        )
        self.assertEqual(results[1]["minimum_whole_value"], "28")
        self.assertEqual(results[1]["allocated_value"], "48")
        req = deepcopy(NETWORK)
        value(req, "transfer_seconds", "0")
        self.assertEqual(calculate(req)["status"], "invalid")
        req = deepcopy(NETWORK)
        value(req, "all_port_gbps", [], 3)
        self.assertEqual(calculate(req)["status"], "invalid")

    def test_malformed_structure_returns_validation_not_exceptions(self):
        for req in (None, [], 42, {"x": float("nan")}, {1: 1}):
            self.assertEqual(calculate(req)["status"], "invalid")
        for section in ("options", "inputs", "formula_id", "system_id", "id"):
            req = single()
            req["calculations"][0][section] = []
            self.assertEqual(calculate(req)["status"], "invalid")
        for option in ("architecture", "role", "benchmark_category", "server_class"):
            req = single()
            req["calculations"][0]["options"][option] = []
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_cli_success_failure_stdin_and_duplicate_keys(self):
        cmd = [sys.executable, "-m", "capacity_engine", "calculate"]
        passed = subprocess.run(
            cmd + ["examples/tta-appendix.json"],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        self.assertEqual(passed.returncode, 0, passed.stderr)
        self.assertEqual(json.loads(passed.stdout)["status"], "calculated")
        for content in ('{"x":1,"x":2}', '{"x":NaN}', "{", json.dumps({"bad": True})):
            failed = subprocess.run(
                cmd + ["-"], input=content, cwd=ROOT, text=True, capture_output=True
            )
            self.assertEqual(failed.returncode, 2, failed.stderr)
            self.assertEqual(json.loads(failed.stdout)["status"], "invalid")

    def test_distinct_cpu_models_cannot_share_one_system(self):
        req = deepcopy(BASE)
        req["calculations"][3]["system_id"] = "web"
        self.assertEqual(calculate(req)["status"], "invalid")

    def test_malformed_json_value_probe(self):
        replacements = [None, True, False, 0, 0.5, "", [], {}, ["x"], {"x": 1}]
        paths = [
            ("profile_id",),
            ("as_of",),
            ("calculations", 0, "options", "allocation_increment"),
            ("calculations", 0, "inputs", "S1", "origin"),
            ("calculations", 0, "inputs", "S1", "unit"),
            ("calculations", 0, "inputs", "S1", "as_of"),
            ("calculations", 0, "inputs", "S1", "value"),
        ]
        for path in paths:
            for replacement in replacements:
                req = deepcopy(BASE)
                target = req
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = replacement
                response = calculate(req)
                self.assertIn(
                    response["status"], ("invalid", "incomplete", "calculated")
                )
        for field in BENCH["candidate"]:
            for replacement in replacements:
                req = deepcopy(BENCH)
                req["candidate"][field] = replacement
                response = compare_benchmark(req)
                self.assertIn(
                    response["status"], ("invalid", "incomparable", "compared")
                )

    def test_request_limits_and_invalid_rounding(self):
        for jobs in ([], BASE["calculations"] * 13):
            req = deepcopy(BASE)
            req["calculations"] = jobs
            self.assertEqual(calculate(req)["status"], "invalid")
        req = single()
        req["assumptions"] = ["한" * 700000]
        self.assertEqual(calculate(req)["errors"][0]["code"], "json")
        for bad in ("0", "-1", 1, True, "NaN"):
            req = single()
            req["calculations"][0]["options"]["allocation_increment"] = bad
            self.assertEqual(calculate(req)["status"], "invalid")
        for bad in (-1, 13, "2", True):
            req = single()
            req["calculations"][0]["options"]["display_places"] = bad
            self.assertEqual(calculate(req)["status"], "invalid")

    def test_trace_hashes_and_original_input_are_auditable(self):
        import hashlib

        response = calculate(BASE)
        manifest = json.loads((ROOT / "wiki/sources/manifest.json").read_text())
        source = next(s for s in manifest["sources"] if s["id"] == "tta-r3")
        self.assertEqual(
            response["catalog_sha256"],
            hashlib.sha256(
                (ROOT / "wiki/formulas/catalog.json").read_bytes()
            ).hexdigest(),
        )
        self.assertEqual(
            response["results"][0]["source_refs"][0]["sha256"], source["sha256"]
        )
        self.assertEqual(response["request_snapshot"], BASE)
        self.assertEqual(
            response["results"][0]["trace"]["inputs"]["S1"]["original"],
            BASE["calculations"][0]["inputs"]["S1"],
        )
        self.assertEqual(len(response["engine_sha256"]), 64)

    def test_catalog_and_runtime_cover_same_rules_and_inputs(self):
        catalog = json.loads((ROOT / "wiki/formulas/catalog.json").read_text())
        self.assertEqual({x["id"] for x in catalog["rules"]}, set(SPECS))
        for r in catalog["rules"]:
            self.assertEqual(set(r["inputs"]), set(SPECS[r["id"]]))
        exercised = {
            x["formula_id"]
            for x in BASE["calculations"]
            + NETWORK["calculations"]
            + GUIDE["calculations"]
        }
        self.assertEqual(exercised, set(SPECS))


class NetworkGuideTests(unittest.TestCase):
    def test_ten_guide_formulas_with_independent_expected_results(self):
        response = calculate(GUIDE)
        self.assertEqual(response["status"], "calculated", response)
        expected = [
            "30.24",
            "3.1",
            "2",
            "102",
            "75892845",
            "460.8",
            "342857088",
            "1201.2",
            "1153920000",
            "288",
        ]
        self.assertEqual([r["raw_value"] for r in response["results"]], expected)
        for r in response["results"]:
            self.assertEqual(r["source_refs"][0]["source_id"], "pdf-b07aabe8f7d6")
        # pps is not multiplied by the full-duplex factor again.
        self.assertEqual(rational(response["results"][4]), 51 * 1488095)
        self.assertEqual(
            rational(response["results"][6]), 160 * Fraction("1.2") ** 2 * 1488095
        )

    def test_port_and_session_references_ceil_before_downstream_use(self):
        response = calculate(GUIDE)["results"]
        self.assertEqual(
            response[1]["trace"]["inputs"]["downlink_ports"]["normalized_value"], "31"
        )
        self.assertEqual(
            response[8]["trace"]["inputs"]["target_sessions"]["normalized_value"],
            "1202",
        )
        req = deepcopy(GUIDE)
        req["calculations"].reverse()
        reversed_response = calculate(req)
        self.assertEqual(reversed_response["status"], "calculated")
        self.assertEqual(
            {r["id"]: r["raw_value"] for r in reversed_response["results"]},
            {r["id"]: r["raw_value"] for r in response},
        )

    def test_zero_divisors_growth_units_and_source_bounds(self):
        for index, key, invalid in [
            (2, "uplink_port_gbps", "0"),
            (8, "average_session_seconds", "0"),
            (0, "expansion_factor", "2.1"),
            (0, "stability_factor", "1.8"),
            (1, "role_factor", "1.1"),
            (2, "redundancy_factor", "1.5"),
            (7, "growth_rate", "-0.1"),
        ]:
            req = deepcopy(GUIDE)
            value(req, key, invalid, index)
            self.assertEqual(calculate(req)["results"][index]["status"], "invalid")
        req = deepcopy(GUIDE)
        req["calculations"][7]["inputs"]["growth_rate"].update(
            value="20", unit="percent"
        )
        self.assertEqual(calculate(req)["results"][7]["raw_value"], "1201.2")
        req["calculations"][8]["inputs"]["average_session_bytes"]["unit"] = "MB/session"
        self.assertEqual(calculate(req)["results"][8]["status"], "invalid")

    def test_missing_session_lifetime_and_bad_dependency_preserve_other_results(self):
        req = deepcopy(GUIDE)
        del req["calculations"][8]["inputs"]["average_session_seconds"]
        response = calculate(req)
        self.assertEqual(response["results"][8]["status"], "incomplete")
        self.assertEqual(response["results"][9]["status"], "calculated")
        req = deepcopy(GUIDE)
        req["calculations"][1]["inputs"]["downlink_ports"]["result_ref"] = (
            "target-sessions"
        )
        self.assertEqual(calculate(req)["results"][1]["status"], "invalid")

    def test_interface_selection_ceil_and_redundancy_do_not_assume_catalog(self):
        req = deepcopy(GUIDE)
        req["calculations"] = [req["calculations"][2]]
        req["calculations"][0]["inputs"]["required_uplink_gbps"] = {
            "value": "10.01",
            "unit": "Gbps",
            "origin": "estimated",
            "evidence": "test case",
            "as_of": "2026-09-27",
        }
        self.assertEqual(calculate(req)["results"][0]["raw_value"], "4")
        value(req, "redundancy_factor", "1")
        self.assertEqual(calculate(req)["results"][0]["raw_value"], "2")
        value(req, "required_uplink_gbps", "0")
        self.assertEqual(calculate(req)["results"][0]["raw_value"], "0")

    def test_guide_profile_cannot_silently_use_lecture_rules(self):
        req = deepcopy(GUIDE)
        req["profile_id"] = "lecture-network"
        self.assertEqual(calculate(req)["status"], "invalid")
        req = deepcopy(GUIDE)
        value(req, "role_factor", "0", 1)
        self.assertEqual(calculate(req)["results"][1]["raw_value"], "0")


class BenchmarkTests(unittest.TestCase):
    def test_compatible_and_insufficient_score(self):
        response = compare_benchmark(BENCH)
        self.assertEqual(response["status"], "compared")
        self.assertEqual(response["candidate_to_requirement_ratio"], "2")
        self.assertTrue(response["meets_requirement"])
        req = deepcopy(BENCH)
        req["candidate"]["value"] = "99999"
        self.assertFalse(compare_benchmark(req)["meets_requirement"])

    def test_versions_status_scope_dates_and_configuration_refuse_ratio(self):
        for changes in (
            {"version": "5.10"},
            {"scope": "cluster"},
            {"status": "in-review"},
            {"status": "historical"},
            {"status": "withdrawn"},
            {"expires_on": "2026-09-27"},
            {"verified_on": "2026-09-28"},
        ):
            req = deepcopy(BENCH)
            req["candidate"].update(changes)
            result = compare_benchmark(req)
            self.assertEqual(result["status"], "incomparable", result)
            self.assertNotIn("candidate_to_requirement_ratio", result)
        req = deepcopy(BENCH)
        req["configuration_match"] = False
        self.assertEqual(compare_benchmark(req)["status"], "incomparable")

    def test_spc_types_cannot_be_mixed(self):
        req = deepcopy(BENCH)
        req["requirement"].update(
            benchmark="SPC-1",
            version="3.10",
            category="random-io",
            scope="storage-system",
            unit="SPC-1-IOPS",
        )
        req["candidate"].update(
            benchmark="SPC-1C",
            version="1.5",
            category="random-io",
            scope="component",
            unit="SPC-1C-IOPS",
            source_url="https://storageperformance.org/benchmarks",
            report_url="https://storageperformance.org/benchmarks",
        )
        req["candidate"]["configuration"] = {
            k: "Synthetic fixture only" for k in CONFIG_FIELDS["SPC-1C"]
        }
        self.assertEqual(compare_benchmark(req)["status"], "incomparable")
        req["candidate"]["unit"] = "SPC-1-IOPS"
        self.assertEqual(compare_benchmark(req)["status"], "invalid")

    def test_spec_categories_cannot_be_mixed(self):
        req = deepcopy(BENCH)
        for key in ("requirement", "candidate"):
            req[key].update(
                benchmark="SPECjbb2015",
                version="1.04",
                category="Composite",
                scope="system",
                unit="max-jOPS",
            )
        req["candidate"]["configuration"] = {
            k: "Synthetic fixture only" for k in CONFIG_FIELDS["SPECjbb2015"]
        }
        req["candidate"].update(
            category="MultiJVM",
            source_url="https://www.spec.org/jbb2015/",
            report_url="https://www.spec.org/jbb2015/",
        )
        self.assertEqual(compare_benchmark(req)["status"], "incomparable")

    def test_malformed_benchmark_data_rejected(self):
        for changes in (
            {"value": "0"},
            {"value": "NaN"},
            {"measurement": "estimated"},
            {"configuration": {}},
            {"unit": "OPS"},
            {"source_url": "https://www.tpc.org.evil.example/results"},
            {"source_url": "http://www.tpc.org/tpcc/"},
            {"source_url": "https://x@y.tpc.org/tpcc/"},
            {"report_url": "https://www.tpc.org:bad/tpcc/"},
            {"status": []},
            {"benchmark": []},
        ):
            req = deepcopy(BENCH)
            req["candidate"].update(changes)
            self.assertEqual(compare_benchmark(req)["status"], "invalid")

    def test_adapter_keeps_benchmark_boundaries_and_rounds_conservatively(self):
        results = calculate(BASE)["results"]
        for index, version, scope, kind in [
            (0, "1.04", "system", "SPECjbb2015"),
            (3, "5.11.0", "single-system", "TPC-C"),
            (6, "3.10", "storage-system", "SPC-1"),
        ]:
            req = requirement_from_result(results[index], version=version, scope=scope)
            self.assertEqual(req["benchmark"], kind)
            self.assertGreaterEqual(Fraction(req["value"]), rational(results[index]))
        with self.assertRaises(ValueError):
            requirement_from_result(results[6], version="1.5", scope="component")
        with self.assertRaises(ValueError):
            requirement_from_result(results[1], version="1", scope="system")

    def test_json_schemas_match_runtime_contract_export(self):
        from capacity_engine.schema import calculation_schema, benchmark_schema

        self.assertEqual(
            calculation_schema(),
            json.loads((ROOT / "schemas/calculate.schema.json").read_text()),
        )
        self.assertEqual(
            benchmark_schema(),
            json.loads((ROOT / "schemas/benchmark.schema.json").read_text()),
        )

    def test_real_reading_example_remains_unmatched(self):
        req = json.loads((ROOT / "examples/benchmark-review.json").read_text())
        self.assertEqual(compare_benchmark(req)["status"], "incomparable")


if __name__ == "__main__":
    unittest.main()
