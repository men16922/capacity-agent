#!/usr/bin/env python3
"""Offline provenance, local-link, formula-reference and corpus coverage checks."""

from pathlib import Path
from decimal import Decimal, InvalidOperation
from urllib.parse import unquote, urlsplit
import argparse
import hashlib
import json
import re
import sys


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(root, require_sources=None):
    root = Path(root).resolve()
    if require_sources is None:
        require_sources = (root / "reference").exists()
    errors = []
    manifest = json.loads((root / "wiki/sources/manifest.json").read_text())
    sources = manifest["sources"]
    by_id = {r["id"]: r for r in sources}
    if len(by_id) != len(sources):
        errors.append("Duplicate source IDs")
    paths = []
    optional = {root / "reference", root / "wiki/sources/extracted"}
    for source in sources:
        optional.update(
            (root / rel).resolve()
            for rel in [source["path"], *source["aliases"], source["extraction"]]
        )
    for r in sources:
        for rel in [r["path"], *r["aliases"]]:
            paths.append(rel)
            p = root / rel
            if (require_sources and not p.is_file()) or (
                p.is_file() and digest(p) != r["sha256"]
            ):
                errors.append(f"Source missing or hash changed: {rel}")
        for field in ("card", "extraction"):
            if (field == "card" or require_sources) and not (root / r[field]).is_file():
                errors.append(f"Missing {field}: {r[field]}")
        extraction = root / r["extraction"]
        if extraction.is_file():
            if digest(extraction) != r["extraction_sha256"]:
                errors.append(f"Extraction hash changed: {r['id']}")
            data = json.loads(extraction.read_text())
            if data.get("source_id") != r["id"]:
                errors.append(f"Extraction source ID mismatch: {r['id']}")
    actual = {
        str(p.relative_to(root))
        for p in (root / "reference").rglob("*")
        if p.is_file() and not p.name.startswith(".")
    }
    if (
        (require_sources and set(paths) != actual)
        or actual - set(paths)
        or len(set(paths)) != len(paths)
    ):
        errors.append("Reference inventory coverage mismatch")
    if manifest["original_file_count"] != len(paths) or manifest[
        "unique_source_count"
    ] != len(sources):
        errors.append("Manifest counts disagree with records")

    wiki_docs = set((root / "wiki").rglob("*.md"))
    docs = wiki_docs | set((root / "docs").rglob("*.md"))
    docs |= {p for p in [root / "README.md", root / "AGENTS.md"] if p.exists()}
    graph = {p: set() for p in docs}
    link_count = 0
    for p in sorted(docs):
        content = re.sub(r"```.*?```", "", p.read_text(), flags=re.S)
        for target in re.findall(r"\[[^\]\n]*\]\(([^)\n]+)\)", content):
            target = target.strip().strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or target.startswith("#"):
                continue
            rel = unquote(parsed.path)
            dst = (p.parent / rel).resolve()
            link_count += 1
            if not dst.exists() and not (not require_sources and dst in optional):
                errors.append(f"Broken link in {p.relative_to(root)}: {target}")
            elif dst in graph:
                graph[p].add(dst)
    reached, todo = set(), [root / "wiki/index.md"]
    while todo:
        p = todo.pop()
        if p not in reached:
            reached.add(p)
            todo.extend(graph.get(p, ()))
    for p in wiki_docs - reached:
        errors.append(f"Unreachable Wiki document: {p.relative_to(root)}")

    catalog = json.loads((root / "wiki/formulas/catalog.json").read_text())
    rules = {r["id"]: r for r in catalog["rules"]}
    if len(rules) != len(catalog["rules"]):
        errors.append("Duplicate formula IDs")
    for r in catalog["rules"]:
        source = by_id.get(r["source_id"])
        if (
            not source
            or not r["source_pages"]
            or any(
                type(p) is not int or not 1 <= p <= source.get("page_count", 0)
                for p in r["source_pages"]
            )
        ):
            errors.append(f"Invalid formula source/pages: {r['id']}")
        if not r["inputs"] or not r["output_unit"] or not r["expression"]:
            errors.append(f"Incomplete formula metadata: {r['id']}")
    examples = json.loads((root / "wiki/formulas/examples.json").read_text())[
        "examples"
    ]
    for ex in examples:
        rule = rules.get(ex["formula_id"])
        if not rule or set(ex["inputs"]) != set(rule["inputs"]):
            errors.append(f"Example input mismatch: {ex['id']}")
        source = by_id.get(ex["source_id"])
        if (
            not source
            or not ex["source_pages"]
            or any(
                type(p) is not int or not 1 <= p <= source.get("page_count", 0)
                for p in ex["source_pages"]
            )
        ):
            errors.append(f"Invalid example source/pages: {ex['id']}")
        try:
            values = [*ex["inputs"].values(), ex["independent_decimal_result"]]
            if not all(Decimal(v).is_finite() for v in values):
                raise InvalidOperation
        except (InvalidOperation, TypeError, ValueError):
            errors.append(f"Invalid example decimal: {ex['id']}")

    config_path = root / ".claude/harness-config.json"
    if config_path.exists():
        config = json.loads(config_path.read_text())
        for name, rel in config["docs"].items():
            p = root / rel
            if not p.is_file():
                errors.append(f"Missing harness doc: {rel}")
            elif (
                name in config.get("budgets", {})
                and len(p.read_text().splitlines()) > config["budgets"][name]
            ):
                errors.append(f"Harness doc exceeds line budget: {rel}")
    return errors, {
        "sources": len(sources),
        "originals": len(paths),
        "wiki_docs": len(wiki_docs),
        "source_files_required": require_sources,
        "local_links": link_count,
        "formulas": len(rules),
        "examples": len(examples),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--require-sources",
        action="store_true",
        help="Require every original and extraction, including in public clones",
    )
    args = parser.parse_args()
    try:
        errors, counts = check(
            Path(__file__).resolve().parents[1], True if args.require_sources else None
        )
    except (KeyError, ValueError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
    if errors:
        print("\n".join("FAIL: " + e for e in errors), file=sys.stderr)
        sys.exit(1)
    print("Wiki checks passed: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
