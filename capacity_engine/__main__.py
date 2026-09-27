"""python3 -m capacity_engine calculate|compare INPUT.json (or - for stdin)."""

import argparse
import json
import sys
from pathlib import Path
from .engine import calculate
from .benchmarks import compare_benchmark


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("Non-finite JSON constant: " + value)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Offline deterministic capacity calculation; JSON on stdout."
    )
    parser.add_argument("command", choices=("calculate", "compare"))
    parser.add_argument("input", help="JSON file, or - for stdin")
    args = parser.parse_args(argv)
    try:
        if args.input == "-":
            content = sys.stdin.read(2_000_001)
        else:
            with Path(args.input).open(encoding="utf-8") as handle:
                content = handle.read(2_000_001)
        if len(content.encode("utf-8")) > 2_000_000:
            raise ValueError("Request exceeds 2 MB.")
        request = json.loads(
            content, object_pairs_hook=unique_object, parse_constant=reject_constant
        )
        response = (calculate if args.command == "calculate" else compare_benchmark)(
            request
        )
    except (OSError, ValueError, UnicodeError, RecursionError) as exc:
        response = {
            "status": "invalid",
            "errors": [{"path": "$", "code": "input", "message": str(exc)}],
        }
    print(json.dumps(response, ensure_ascii=False, indent=2, allow_nan=False))
    return 0 if response["status"] in ("calculated", "compared") else 2


if __name__ == "__main__":
    sys.exit(main())
