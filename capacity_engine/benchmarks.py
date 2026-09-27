"""Compare only explicitly reviewed, compatible benchmark records.

This module validates recorded evidence. It does not fetch or certify a result.
"""

from urllib.parse import urlsplit
from .engine import iso_date, is_text, issue
from .numeric import decimal_text, exact, number
from .rules import VERSION

KINDS = {
    "TPC-C": {
        "unit": "tpmC",
        "categories": {"OLTP"},
        "scopes": {"single-system", "cluster"},
        "domains": {"tpc.org", "www.tpc.org"},
    },
    "SPC-1": {
        "unit": "SPC-1-IOPS",
        "categories": {"random-io"},
        "scopes": {"storage-system"},
        "domains": {"storageperformance.org", "www.storageperformance.org"},
    },
    "SPC-1C": {
        "unit": "SPC-1C-IOPS",
        "categories": {"random-io"},
        "scopes": {"component"},
        "domains": {"storageperformance.org", "www.storageperformance.org"},
    },
    "SPECjbb2015": {
        "unit": "max-jOPS",
        "categories": {"Composite", "MultiJVM"},
        "scopes": {"system"},
        "domains": {"spec.org", "www.spec.org"},
    },
}
COMMON = {"benchmark", "version", "category", "scope", "unit", "value"}
CANDIDATE = COMMON | {
    "result_id",
    "status",
    "measurement",
    "configuration",
    "source_url",
    "report_url",
    "verified_on",
    "expires_on",
}
STATUSES = {"accepted", "in-review", "historical", "withdrawn"}
CONFIG_FIELDS = {
    "TPC-C": {
        "system",
        "cpu",
        "processors",
        "cores",
        "memory",
        "database",
        "os",
        "storage",
    },
    "SPECjbb2015": {
        "system",
        "cpu",
        "processors",
        "cores",
        "memory",
        "os",
        "jvm",
        "storage",
    },
    "SPC-1": {
        "system",
        "controllers",
        "media",
        "raid",
        "connectivity",
        "cache",
        "capacity",
        "workload",
    },
    "SPC-1C": {
        "system",
        "controllers",
        "media",
        "raid",
        "connectivity",
        "cache",
        "capacity",
        "workload",
    },
}


def compare_benchmark(request):
    """Return compared, incomparable or invalid; never manufacture a conversion."""
    result = {
        "schema_version": 1,
        "engine_version": VERSION,
        "status": "invalid",
        "errors": [],
        "reasons": [],
        "warnings": [
            "Comparison is an evidence-record check, not a capacity guarantee or live benchmark verification."
        ],
    }
    errors = result["errors"]
    reasons = result["reasons"]
    fields = {
        "as_of",
        "requirement",
        "candidate",
        "configuration_match",
        "review_evidence",
    }
    if not isinstance(request, dict) or set(request) != fields:
        errors.append(
            issue(
                "$",
                "fields",
                "Expected as_of, requirement, candidate, configuration_match, review_evidence.",
            )
        )
        return result
    try:
        as_of = iso_date(request["as_of"])
    except ValueError:
        errors.append(issue("as_of", "date", "Invalid comparison date."))
    if type(request["configuration_match"]) is not bool or not is_text(
        request["review_evidence"]
    ):
        errors.append(
            issue(
                "review_evidence",
                "review",
                "Supply an explicit configuration-match decision and evidence.",
            )
        )
    parsed = {}
    for name, keys in (("requirement", COMMON), ("candidate", CANDIDATE)):
        record = request[name]
        if not isinstance(record, dict) or set(record) != keys:
            errors.append(issue(name, "fields", "Unexpected or missing record fields."))
            continue
        kind = (
            KINDS.get(record["benchmark"])
            if isinstance(record["benchmark"], str)
            else None
        )
        if kind is None:
            errors.append(
                issue(name + ".benchmark", "benchmark", "Unsupported benchmark.")
            )
            continue
        if not is_text(record["version"]):
            errors.append(
                issue(name + ".version", "version", "Exact benchmark version required.")
            )
        if (
            not isinstance(record["category"], str)
            or record["category"] not in kind["categories"]
        ):
            errors.append(
                issue(name + ".category", "category", "Invalid benchmark category.")
            )
        if (
            not isinstance(record["scope"], str)
            or record["scope"] not in kind["scopes"]
        ):
            errors.append(issue(name + ".scope", "scope", "Invalid benchmark scope."))
        if record["unit"] != kind["unit"]:
            errors.append(
                issue(name + ".unit", "unit", "Metric must match benchmark kind.")
            )
        try:
            value = number(record["value"])
            if value <= 0:
                raise ValueError("Benchmark values must be positive.")
            parsed[name] = value
        except ValueError as exc:
            errors.append(issue(name + ".value", "number", str(exc)))
        if name == "candidate":
            if not is_text(record["result_id"]):
                errors.append(issue(name + ".result_id", "id", "Result ID required."))
            if (
                not isinstance(record["status"], str)
                or record["status"] not in STATUSES
            ):
                errors.append(
                    issue(name + ".status", "status", "Unsupported publication status.")
                )
            if record["measurement"] != "official-reported":
                errors.append(
                    issue(
                        name + ".measurement",
                        "measurement",
                        "Estimated or extrapolated scores are not official measured records.",
                    )
                )
            config = record["configuration"]
            if (
                not isinstance(config, dict)
                or not CONFIG_FIELDS[record["benchmark"]] <= config.keys()
                or not all(is_text(k) and is_text(v) for k, v in config.items())
            ):
                errors.append(
                    issue(
                        name + ".configuration",
                        "configuration",
                        "Record all required tested-configuration fields.",
                    )
                )
            for field in ("source_url", "report_url"):
                url = record[field]
                try:
                    parts = urlsplit(url) if isinstance(url, str) else None
                    if (
                        not parts
                        or parts.scheme != "https"
                        or parts.hostname not in kind["domains"]
                        or parts.username
                        or parts.password
                        or parts.port not in (None, 443)
                        or not parts.path
                    ):
                        raise ValueError("Use an official HTTPS result/report URL.")
                except ValueError as exc:
                    errors.append(issue(name + "." + field, "url", str(exc)))
            try:
                verified = iso_date(record["verified_on"])
                expiry = (
                    None
                    if record["expires_on"] is None
                    else iso_date(record["expires_on"])
                )
                if not errors:
                    if verified > as_of:
                        reasons.append("verification-date-in-future")
                    if expiry is not None and expiry <= as_of:
                        reasons.append("expired")
            except ValueError:
                errors.append(
                    issue(
                        name + ".verified_on",
                        "date",
                        "Invalid verification or expiration date.",
                    )
                )
    if errors:
        return result
    requirement = request["requirement"]
    candidate = request["candidate"]
    for key in ("benchmark", "version", "category", "scope", "unit"):
        if requirement[key] != candidate[key]:
            reasons.append(key + "-mismatch")
    if candidate["status"] != "accepted":
        reasons.append("publication-not-accepted")
    if not request["configuration_match"]:
        reasons.append("configuration-not-matched")
    result.update(
        result_id=candidate["result_id"],
        as_of=request["as_of"],
        source_url=candidate["source_url"],
        report_url=candidate["report_url"],
        review_evidence=request["review_evidence"],
    )
    if reasons:
        result["status"] = "incomparable"
        return result
    ratio = parsed["candidate"] / parsed["requirement"]
    result.update(
        status="compared",
        candidate_to_requirement_ratio=decimal_text(ratio),
        exact_ratio=exact(ratio),
        meets_requirement=ratio >= 1,
        requirement_value=requirement["value"],
        candidate_value=candidate["value"],
        unit=requirement["unit"],
    )
    return result


def requirement_from_result(result, *, version, scope):
    """Use the conservative whole-unit requirement; no tpmC/core conversion.

    This adapter preserves metric/category boundaries. Publication version and
    deployment scope remain explicit decisions by the caller.
    """
    if not isinstance(result, dict) or result.get("status") != "calculated":
        raise ValueError("A calculated engine result is required.")
    if not is_text(version):
        raise ValueError("Exact benchmark version required.")
    unit = result.get("unit")
    if unit == "tpmC":
        benchmark, category, metric = "TPC-C", "OLTP", "tpmC"
    elif unit == "max-jOPS":
        benchmark, category, metric = (
            "SPECjbb2015",
            result["trace"]["benchmark_category"],
            "max-jOPS",
        )
    elif unit == "estimated-IOPS":
        benchmark, category, metric = "SPC-1", "random-io", "SPC-1-IOPS"
    else:
        raise ValueError("No benchmark mapping for this sizing metric.")
    if not isinstance(scope, str) or scope not in KINDS[benchmark]["scopes"]:
        raise ValueError("Benchmark scope mismatch.")
    if number(result["minimum_whole_value"]) <= 0:
        raise ValueError("A positive requirement is needed for comparison.")
    return {
        "benchmark": benchmark,
        "version": version,
        "category": category,
        "scope": scope,
        "unit": metric,
        "value": result["minimum_whole_value"],
    }
