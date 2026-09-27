"""Offline sizing API. Requests and responses contain JSON values only."""

from copy import deepcopy
from datetime import date
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re

from .numeric import CAPACITY, SOURCE_MB, convert, decimal_text, exact, number, rounded
from .rules import (
    ARCHITECTURES,
    GUIDANCE,
    NETWORK,
    GUIDE,
    REFERENCE_TARGETS,
    PROFILE,
    SPECS,
    UNIT_FACTORS,
    VERSION,
    evaluate,
)

ROOT = Path(__file__).resolve().parents[1]
IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\Z")
CPU = {"TTA-WEB-CPU", "TTA-OLTP-CPU"}
DISK = {"TTA-SYSTEM-DISK", "TTA-DATA-DISK"}
CAPACITY_RULES = DISK | {"TTA-MEMORY"}


def issue(path, code, message):
    return {"path": path, "code": code, "message": message}


def is_text(value):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= 2000


def iso_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Use YYYY-MM-DD.")
    return date.fromisoformat(value)


def metadata():
    catalog_path = ROOT / "wiki/formulas/catalog.json"
    catalog_bytes = catalog_path.read_bytes()
    catalog = json.loads(catalog_bytes)
    manifest = json.loads((ROOT / "wiki/sources/manifest.json").read_text())
    sources = {s["id"]: s for s in manifest["sources"]}
    rules = {r["id"]: r for r in catalog["rules"]}
    code = b"".join(
        p.name.encode() + p.read_bytes()
        for p in sorted(Path(__file__).parent.glob("*.py"))
    )
    return (
        rules,
        sources,
        {
            "engine_version": VERSION,
            "engine_sha256": hashlib.sha256(code).hexdigest(),
            "catalog_sha256": hashlib.sha256(catalog_bytes).hexdigest(),
        },
    )


def calculate(request):
    """Calculate a scenario; return invalid/incomplete/calculated per resource.

    The API never opens a network connection or modifies its input or sources.
    Exact fractions survive architecture weights and inter-result references.
    """
    rules, sources, provenance = metadata()
    response = {
        "schema_version": 1,
        **provenance,
        "status": "invalid",
        "errors": [],
        "results": [],
    }
    try:
        serialized = json.dumps(request, ensure_ascii=False, allow_nan=False)
        if len(serialized.encode("utf-8")) > 2_000_000:
            raise ValueError("Request exceeds 2 MB.")
        snapshot = json.loads(serialized)
    except (TypeError, ValueError, RecursionError) as exc:
        response["errors"] = [issue("$", "json", str(exc))]
        return response
    if not isinstance(snapshot, dict):
        response["errors"] = [issue("$", "type", "Request must be an object.")]
        return response
    response["request_snapshot"] = snapshot
    required = {
        "schema_version",
        "profile_id",
        "rule_version",
        "scenario_id",
        "as_of",
        "assumptions",
        "source_refs",
        "calculations",
    }
    errors = response["errors"]
    for k in sorted(required - snapshot.keys()):
        errors.append(issue(k, "missing", "Required field."))
    for k in sorted(snapshot.keys() - required):
        errors.append(issue(k, "unknown", "Unknown field."))
    if (
        type(snapshot.get("schema_version")) is not int
        or snapshot.get("schema_version") != 1
    ):
        errors.append(issue("schema_version", "version", "Expected schema version 1."))
    if snapshot.get("rule_version") != VERSION:
        errors.append(issue("rule_version", "version", f"Expected {VERSION}."))
    if snapshot.get("profile_id") not in (PROFILE, NETWORK, GUIDE):
        errors.append(issue("profile_id", "profile", "Unsupported profile."))
    if not isinstance(snapshot.get("scenario_id"), str) or not IDENTIFIER.fullmatch(
        snapshot["scenario_id"]
    ):
        errors.append(
            issue("scenario_id", "identifier", "Use a nonempty stable identifier.")
        )
    try:
        as_of = iso_date(snapshot.get("as_of"))
    except ValueError:
        errors.append(issue("as_of", "date", "Use a valid YYYY-MM-DD date."))
    for k in ("assumptions", "source_refs"):
        if not isinstance(snapshot.get(k), list) or not all(
            is_text(x) for x in snapshot[k]
        ):
            errors.append(issue(k, "type", "Expected a list of nonempty strings."))
    jobs = snapshot.get("calculations")
    if not isinstance(jobs, list) or not 1 <= len(jobs) <= 100:
        errors.append(issue("calculations", "size", "Supply 1 to 100 calculations."))
        return response
    seen = set()
    identities = set()
    cpu_systems = set()
    for i, job in enumerate(jobs):
        path = f"calculations[{i}]"
        if not isinstance(job, dict):
            errors.append(issue(path, "type", "Calculation must be an object."))
            continue
        fields = {"id", "system_id", "formula_id", "inputs", "options"}
        if set(job) != fields:
            errors.append(
                issue(path, "fields", "Required keys: " + ", ".join(sorted(fields)))
            )
        for key in ("id", "system_id"):
            if not isinstance(job.get(key), str) or not IDENTIFIER.fullmatch(job[key]):
                errors.append(
                    issue(path + "." + key, "identifier", "Invalid identifier.")
                )
        jid = job.get("id")
        system = job.get("system_id")
        fid = job.get("formula_id")
        if isinstance(jid, str):
            if jid in seen:
                errors.append(
                    issue(path + ".id", "duplicate", "Duplicate calculation ID.")
                )
            seen.add(jid)
        if isinstance(system, str) and isinstance(fid, str):
            identity = (system, fid)
            if identity in identities:
                errors.append(
                    issue(
                        path,
                        "duplicate",
                        "One formula per system; use a separate scenario for alternatives.",
                    )
                )
            identities.add(identity)
            if fid in CPU:
                if system in cpu_systems:
                    errors.append(
                        issue(
                            path,
                            "duplicate_cpu",
                            "Choose one CPU model per system; use architecture weighting for combined roles.",
                        )
                    )
                cpu_systems.add(system)
        if not isinstance(fid, str) or fid not in SPECS:
            errors.append(
                issue(path + ".formula_id", "formula", "Unsupported formula.")
            )
        elif rules[fid]["profile_id"] != snapshot.get("profile_id"):
            errors.append(
                issue(path + ".formula_id", "profile", "Formula/profile mismatch.")
            )
        if not isinstance(job.get("inputs"), dict) or not isinstance(
            job.get("options"), dict
        ):
            errors.append(issue(path, "type", "inputs and options must be objects."))
    if errors:
        return response
    response.update(
        profile_id=snapshot["profile_id"],
        rule_version=VERSION,
        scenario_id=snapshot["scenario_id"],
    )
    by_id = {j["id"]: j for j in jobs}
    cache = {}
    values = {}
    visiting = set()

    def run(jid):
        if jid in cache:
            return cache[jid]
        job = by_id[jid]
        fid = job["formula_id"]
        opts = job["options"]
        data = job["inputs"]
        result = {
            "id": jid,
            "system_id": job["system_id"],
            "formula_id": fid,
            "status": "invalid",
            "errors": [],
            "warnings": [],
            "missing_fields": [],
        }
        errs = result["errors"]
        warnings = result["warnings"]
        missing = result["missing_fields"]
        if jid in visiting:
            errs.append(issue(jid, "cycle", "Cyclic result reference."))
            return result
        visiting.add(jid)

        def bad(path, code, message):
            errs.append(issue(path, code, message))

        def warn(code, message):
            warnings.append({"code": code, "message": message})

        expected = SPECS[fid]
        for key in sorted(data.keys() - expected.keys()):
            bad(key, "unknown", "Unknown input; coefficients cannot be applied twice.")
        allowed = {"display_places", "allocation_increment"}
        if fid in CPU:
            allowed |= {"architecture", "role"}
        if fid == "TTA-WEB-CPU":
            allowed |= {"benchmark_category", "server_class"}
        if fid in CAPACITY_RULES:
            allowed |= {"capacity_unit"}
        if fid in DISK:
            allowed |= {"raid"}
        for key in sorted(opts.keys() - allowed):
            bad("options." + key, "unknown", "Unsupported option.")
        places = opts.get("display_places", 0)
        if type(places) is not int or not 0 <= places <= 12:
            bad("options.display_places", "range", "Use an integer from 0 to 12.")
        target = opts.get("capacity_unit")
        if fid in CAPACITY_RULES and (
            not isinstance(target, str) or target not in {*CAPACITY, SOURCE_MB}
        ):
            bad(
                "options.capacity_unit",
                "unit",
                "Specify an explicit capacity unit or the original source MB label.",
            )
        arch_weight = Fraction(1)
        if fid in CPU:
            arch = opts.get("architecture")
            role = opts.get("role")
            mapping = ARCHITECTURES.get(arch, {}) if isinstance(arch, str) else {}
            pair = mapping.get(role) if isinstance(role, str) else None
            if not pair or pair[0] != fid:
                bad(
                    "options.architecture",
                    "architecture",
                    "Architecture, role and CPU formula must match table 6-7.",
                )
            else:
                arch_weight = number(pair[1])
        parsed = {}
        trace_inputs = {}
        for key, spec in expected.items():
            item = data.get(key)
            if item is None:
                missing.append(key)
                continue
            if not isinstance(item, dict):
                bad(key, "type", "Input must contain value, unit and provenance.")
                continue
            is_ref = "result_ref" in item
            fields = (
                {"result_ref", "unit"}
                if is_ref
                else {"value", "unit", "origin", "evidence", "as_of"}
            )
            if set(item) != fields:
                bad(key, "fields", "Expected keys: " + ", ".join(sorted(fields)))
                continue
            if not isinstance(item["unit"], str):
                bad(key, "unit", "Unit must be a string.")
                continue
            unit = item["unit"]
            if is_ref:
                reference_contract = REFERENCE_TARGETS.get((fid, key))
                if reference_contract is None:
                    bad(key, "reference", "This input cannot reference another result.")
                    continue
                reference_formula, round_count = reference_contract
                ref = item["result_ref"]
                if not isinstance(ref, str) or ref not in by_id:
                    bad(key, "reference", "Unknown calculation reference.")
                    continue
                if (
                    by_id[ref]["formula_id"] != reference_formula
                    or by_id[ref]["system_id"] != job["system_id"]
                ):
                    bad(
                        key,
                        "reference",
                        "Reference the compatible calculation for the same system.",
                    )
                    continue
                dependency = run(ref)
                if dependency["status"] != "calculated":
                    if dependency["status"] == "incomplete":
                        missing.append(key)
                    else:
                        bad(key, "dependency", "Referenced calculation is invalid.")
                    continue
                value = values[ref]
                if round_count:
                    value = Fraction(int(rounded(value, 0, "ceiling")))
            else:
                if item["origin"] not in (
                    "measured",
                    "estimated",
                    "source-default",
                ) or not is_text(item["evidence"]):
                    bad(
                        key,
                        "provenance",
                        "Provide measured/estimated/source-default and a nonempty evidence reference.",
                    )
                    continue
                try:
                    if iso_date(item["as_of"]) > as_of:
                        raise ValueError("Input evidence date is after scenario date.")
                except ValueError as exc:
                    bad(key, "date", str(exc))
                    continue
                if item["value"] is None:
                    missing.append(key)
                    continue
                try:
                    if spec["unit"] == "Gbps-list":
                        if (
                            not isinstance(item["value"], list)
                            or not 1 <= len(item["value"]) <= 1000
                        ):
                            raise ValueError(
                                "Supply 1 to 1000 per-port decimal values."
                            )
                        value = [number(v) for v in item["value"]]
                    else:
                        value = number(item["value"])
                except ValueError as exc:
                    bad(key, "number", str(exc))
                    continue
            try:
                desired = spec["unit"]
                if desired in ("capacity", "capacity/user"):
                    base_unit = unit
                    if desired == "capacity/user":
                        if not unit.endswith("/user"):
                            raise ValueError("Use a capacity/user unit.")
                        base_unit = unit[:-5]
                    value = convert(value, base_unit, target)
                    normalized_unit = target + (
                        "/user" if desired == "capacity/user" else ""
                    )
                elif desired == "ratio" and unit == "percent":
                    value /= 100
                    normalized_unit = "ratio"
                elif desired == "Gbps-list" and unit == "Gbps":
                    normalized_unit = unit
                elif unit == desired:
                    normalized_unit = unit
                else:
                    raise ValueError("Expected " + desired + "; received " + unit + ".")
                vals = value if isinstance(value, list) else [value]
                for v in vals:
                    if v < number(spec["minimum"]) or (
                        spec["maximum"] is not None and v > number(spec["maximum"])
                    ):
                        raise ValueError("Value outside allowed range.")
                    if spec["integer"] and v.denominator != 1:
                        raise ValueError("Integer count required.")
                    if (
                        key
                        in (
                            "S10",
                            "O10",
                            "transfer_seconds",
                            "uplink_port_gbps",
                            "average_session_seconds",
                        )
                        and v == 0
                    ):
                        raise ValueError("Value must be greater than zero.")
                parsed[key] = value
                trace_inputs[key] = {
                    "original": deepcopy(item),
                    "normalized_unit": normalized_unit,
                    "normalized_value": [decimal_text(v) for v in value]
                    if isinstance(value, list)
                    else decimal_text(value),
                    "exact": [exact(v) for v in value]
                    if isinstance(value, list)
                    else exact(value),
                }
            except (ValueError, TypeError) as exc:
                bad(key, "unit_or_range", str(exc))
        # Incomplete requests still reject errors in fields that were supplied.
        if fid == "TTA-WEB-CPU":
            category = opts.get("benchmark_category")
            server = opts.get("server_class")
            factor = UNIT_FACTORS.get(category, {}) if isinstance(category, str) else {}
            chosen = factor.get(server) if isinstance(server, str) else None
            if chosen is None:
                bad(
                    "options",
                    "benchmark",
                    "Composite/MultiJVM and x86/general/unix are required.",
                )
            elif "S11" in parsed and parsed["S11"] != number(chosen):
                bad(
                    "S11",
                    "coefficient",
                    "Unit factor does not match benchmark category/server class.",
                )
            if "S3" in parsed and parsed["S3"] != 3:
                bad("S3", "coefficient", "R3 fixes the basic OPS correction at 3.")
            role = opts.get("role")
            expected_purpose = number("0.7") if role == "WEB" else Fraction(2)
            if "S4" in parsed and parsed["S4"] != expected_purpose:
                bad(
                    "S4",
                    "coefficient",
                    "Purpose correction does not match WEB/WAS role.",
                )
            if role == "WEB" and "S7" in parsed and parsed["S7"] != 1:
                bad("S7", "coefficient", "WEB integration correction is 1 in R3.")
        if fid == "TTA-OLTP-CPU" and "O2" in parsed and parsed["O2"] != 5:
            bad("O2", "coefficient", "R3 fixes the basic tpmC correction at 5.")
        if fid in DISK:
            raid = opts.get("raid")
            raid_factors = {
                "none": "1",
                "RAID1": "2",
                "RAID10": "2",
                "RAID01": "2",
                "RAID5": "1.3",
                "RAID6": "1.4",
            }
            if not isinstance(raid, str) or raid not in raid_factors:
                bad(
                    "options.raid",
                    "raid",
                    "Specify none, RAID1, RAID10, RAID01, RAID5 or RAID6.",
                )
            elif "D8" in parsed and parsed["D8"] != number(raid_factors[raid]):
                bad("D8", "coefficient", "RAID selection and coefficient disagree.")
            warn(
                "raid-model",
                "RAID is a source-model allowance, not an exact physical disk topology or a backup replacement.",
            )
            warn(
                "format-overhead",
                "No additional 15% formatting allowance is automatically added to filesystem overhead.",
            )
        if target == SOURCE_MB:
            warn(
                "ambiguous-source-unit",
                "Original MB label retained; physical byte conversion is unavailable.",
            )
        if fid.startswith("GUIDE-"):
            warn(
                "guide-model",
                "2021 guide model, not a live device benchmark or a current compliance determination.",
            )
        if fid.endswith("PPS"):
            warn(
                "theoretical-packet-rate",
                "Uses the guide's 1,488,095 pps per Gbps constant; actual frame mix and enabled features require measurement.",
            )
        if fid == "GUIDE-UPLINK-PORTS":
            warn(
                "interface-policy",
                "Explicit link rate; ceil(demand/rate) per path times 1 or 2 paths. Device/catalog and failure behavior are not selected automatically.",
            )
        if fid == "GUIDE-L47-THROUGHPUT":
            warn(
                "session-time-required",
                "Byte volume per session is divided by its average lifetime and multiplied by 8 to obtain bps.",
            )
        if fid.endswith("IOPS"):
            warn(
                "estimated-iops",
                "This is the R3 empirical tpmC ratio, not measured storage IOPS.",
            )
        if fid in CPU:
            warn(
                "system-benchmark",
                "This is a system performance requirement, not a core count or guaranteed application throughput.",
            )
        for key, (low, high) in GUIDANCE.get(fid, {}).items():
            if key in parsed and not number(low) <= parsed[key] <= number(high):
                warn(
                    "outside-source-guidance",
                    f"{key} is outside the source general value/range {low}..{high}; evidence must justify it.",
                )
        # A same-system WEB/WAS CPU and memory request must use the same concurrency.
        if fid == "TTA-MEMORY" and "M3" in parsed:
            for other in jobs:
                if (
                    other["system_id"] == job["system_id"]
                    and other["formula_id"] == "TTA-WEB-CPU"
                ):
                    raw = other["inputs"].get("S1")
                    if isinstance(raw, dict) and isinstance(raw.get("value"), str):
                        try:
                            if parsed["M3"] != number(raw["value"]):
                                bad(
                                    "M3",
                                    "concurrency",
                                    "Memory and CPU concurrency differ for this system.",
                                )
                        except ValueError:
                            pass  # CPU validator reports malformed inputs.
        increment = None
        if "allocation_increment" in opts:
            try:
                increment = number(opts["allocation_increment"])
                if increment <= 0:
                    raise ValueError("Allocation increment must be positive.")
            except ValueError as exc:
                bad("options.allocation_increment", "number", str(exc))
        if errs or missing:
            result["status"] = "invalid" if errs else "incomplete"
        else:
            base = evaluate(fid, parsed)
            final = base * arch_weight
            unit = target if fid in CAPACITY_RULES else rules[fid]["output_unit"]
            if fid == "NET-DOWNLINK-PORTS":
                unit = "ports"
            values[jid] = final
            ref = rules[fid]
            source = sources[ref["source_id"]]
            pages = sorted(set(ref["source_pages"] + ([19] if fid in CPU else [])))
            result.update(
                status="calculated",
                base_value=decimal_text(base),
                raw_value=decimal_text(final),
                exact_value=exact(final),
                unit=unit,
                display_value=rounded(final, places),
                minimum_whole_value=rounded(final, 0, "ceiling"),
                source_refs=[
                    {
                        "source_id": ref["source_id"],
                        "sha256": source["sha256"],
                        "pages": pages,
                    }
                ],
                trace={
                    "expression": ref["expression"],
                    "inputs": trace_inputs,
                    "base_exact": exact(base),
                    "architecture_factor": decimal_text(arch_weight),
                    "architecture": opts.get("architecture"),
                    "role": opts.get("role"),
                    "benchmark_category": opts.get("benchmark_category"),
                    "raw_serialization": "exact terminating decimal or 50 significant digits HALF_EVEN; exact_value is authoritative",
                    "display_rounding": {"places": places, "mode": "HALF_UP"},
                    "rule_version": VERSION,
                },
            )
            if increment is not None:
                count = int(rounded(final / increment, 0, "ceiling"))
                result["allocated_value"] = decimal_text(count * increment)
                result["trace"]["allocation"] = {
                    "increment": decimal_text(increment),
                    "unit": unit,
                    "mode": "CEILING",
                }
        visiting.remove(jid)
        cache[jid] = result
        return result

    response["results"] = [run(j["id"]) for j in jobs]
    states = {r["status"] for r in response["results"]}
    response["status"] = (
        "invalid"
        if "invalid" in states
        else ("incomplete" if "incomplete" in states else "calculated")
    )
    return response
