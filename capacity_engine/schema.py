"""Machine-readable wire schemas. Semantic cross-field checks live in the API."""

from .rules import (
    ARCHITECTURES,
    NETWORK,
    PROFILE,
    SPECS,
    VERSION,
    GUIDE,
    REFERENCE_TARGETS,
)
from .numeric import CAPACITY, SOURCE_MB
from .benchmarks import CONFIG_FIELDS, KINDS, STATUSES

DECIMAL = {
    "type": "string",
    "pattern": r"^-?(0|[1-9][0-9]*)(\.[0-9]+)?$",
    "maxLength": 64,
}
TEXT = {"type": "string", "minLength": 1, "maxLength": 2000}
DATE = {"type": "string", "format": "date", "pattern": r"^\d{4}-\d{2}-\d{2}$"}
ID = {"type": "string", "pattern": r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$"}


def obj(properties, required=None):
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties) if required is None else required,
        "additionalProperties": False,
    }


def calculation_schema():
    variants = []
    for fid, specs in SPECS.items():
        inputs = {}
        for key, spec in specs.items():
            unit = spec["unit"]
            units = [unit]
            if unit == "capacity":
                units = [*CAPACITY, SOURCE_MB]
            elif unit == "capacity/user":
                units = [u + "/user" for u in [*CAPACITY, SOURCE_MB]]
            elif unit == "ratio":
                units = ["ratio", "percent"]
            elif unit == "Gbps-list":
                units = ["Gbps"]
            v = (
                DECIMAL
                if unit != "Gbps-list"
                else {
                    "type": "array",
                    "items": DECIMAL,
                    "minItems": 1,
                    "maxItems": 1000,
                }
            )
            literal = obj(
                {
                    "value": {"anyOf": [v, {"type": "null"}]},
                    "unit": {"enum": units},
                    "origin": {"enum": ["measured", "estimated", "source-default"]},
                    "evidence": TEXT,
                    "as_of": DATE,
                }
            )
            forms = [literal, {"type": "null"}]
            if (fid, key) in REFERENCE_TARGETS:
                forms.append(obj({"result_ref": ID, "unit": {"const": unit}}))
            inputs[key] = {"oneOf": forms}
        options = {
            "display_places": {"type": "integer", "minimum": 0, "maximum": 12},
            "allocation_increment": DECIMAL,
        }
        required = []
        if fid in ("TTA-WEB-CPU", "TTA-OLTP-CPU"):
            options.update(
                architecture={"enum": list(ARCHITECTURES)},
                role={"enum": ["WEB", "WAS", "DB", "WEB_WAS", "WAS_DB", "WEB_WAS_DB"]},
            )
            required += ["architecture", "role"]
        if fid == "TTA-WEB-CPU":
            options.update(
                benchmark_category={"enum": ["Composite", "MultiJVM"]},
                server_class={"enum": ["x86", "general", "unix"]},
            )
            required += ["benchmark_category", "server_class"]
        if fid in ("TTA-MEMORY", "TTA-SYSTEM-DISK", "TTA-DATA-DISK"):
            options["capacity_unit"] = {"enum": [*CAPACITY, SOURCE_MB]}
            required += ["capacity_unit"]
        if fid in ("TTA-SYSTEM-DISK", "TTA-DATA-DISK"):
            options["raid"] = {
                "enum": ["none", "RAID1", "RAID10", "RAID01", "RAID5", "RAID6"]
            }
            required += ["raid"]
        variants.append(
            obj(
                {
                    "id": ID,
                    "system_id": ID,
                    "formula_id": {"const": fid},
                    "inputs": obj(inputs, []),
                    "options": obj(options, required),
                }
            )
        )
    schema = obj(
        {
            "schema_version": {"const": 1},
            "profile_id": {"enum": [PROFILE, NETWORK, GUIDE]},
            "rule_version": {"const": VERSION},
            "scenario_id": ID,
            "as_of": DATE,
            "assumptions": {"type": "array", "items": TEXT},
            "source_refs": {"type": "array", "items": TEXT},
            "calculations": {
                "type": "array",
                "minItems": 1,
                "maxItems": 100,
                "items": {"oneOf": variants},
            },
        }
    )
    schema.update(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Capacity calculation request v1",
            "description": "Wire validation. Runtime additionally checks dates, decimal precision, ranges, units, profile/role combinations, provenance and dependencies. Missing resource inputs yield incomplete.",
        }
    )
    return schema


def benchmark_schema():
    variants = {name: [] for name in ("requirement", "candidate")}
    for kind, info in KINDS.items():
        common = {
            "benchmark": {"const": kind},
            "version": TEXT,
            "category": {"enum": sorted(info["categories"])},
            "scope": {"enum": sorted(info["scopes"])},
            "unit": {"const": info["unit"]},
            "value": DECIMAL,
        }
        variants["requirement"].append(obj(common))
        configuration = {
            "type": "object",
            "required": sorted(CONFIG_FIELDS[kind]),
            "additionalProperties": TEXT,
        }
        candidate = {
            **common,
            "result_id": TEXT,
            "status": {"enum": sorted(STATUSES)},
            "measurement": {"const": "official-reported"},
            "configuration": configuration,
            "source_url": {"type": "string", "format": "uri"},
            "report_url": {"type": "string", "format": "uri"},
            "verified_on": DATE,
            "expires_on": {"anyOf": [DATE, {"type": "null"}]},
        }
        variants["candidate"].append(obj(candidate))
    schema = obj(
        {
            "as_of": DATE,
            "requirement": {"oneOf": variants["requirement"]},
            "candidate": {"oneOf": variants["candidate"]},
            "configuration_match": {"type": "boolean"},
            "review_evidence": TEXT,
        }
    )
    schema.update(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Benchmark comparison request v1",
            "description": "Runtime additionally validates official HTTPS domains, dates, statuses, positive values and cross-record compatibility.",
        }
    )
    return schema
