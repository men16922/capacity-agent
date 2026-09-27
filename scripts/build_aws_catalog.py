#!/usr/bin/env python3
"""Build a bounded, auditable catalog from downloaded official AWS documents.

Inputs are explicit local downloads; this script never uses AWS credentials.
python3 scripts/build_aws_catalog.py --source-dir /tmp --price-csv /tmp/capacity-aws-seoul.csv
"""

import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = {"gp": ["m8i", "m8g"], "co": ["c8i", "c8g"], "mo": ["r8i", "r8g"]}
SIZES = ["large", "xlarge", "2xlarge", "4xlarge", "8xlarge", "16xlarge"]
PRICE_URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-northeast-2/index.csv"


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def baseline(text):
    value = text.split("/")[0].strip().replace(",", "")
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(?: Gigabit)?", value)
    if not match:
        raise ValueError(f"Unknown baseline format: {text}")
    return match.group(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--price-csv", type=Path, required=True)
    parser.add_argument(
        "--verified-on", required=True, help="Explicit verification date YYYY-MM-DD"
    )
    args = parser.parse_args()
    instances, receipts = {}, []
    for kind, families in FAMILIES.items():
        path = args.source_dir / f"capacity-aws-{kind}.md"
        url = f"https://docs.aws.amazon.com/ec2/latest/instancetypes/{kind}.html"
        receipts.append(
            {"url": url, "sha256": sha(path), "download_format": "markdown"}
        )
        soup = BeautifulSoup(path.read_text(), "html.parser")
        for family in families:
            for size in SIZES:
                name = f"{family}.{size}"
                instances[name] = {
                    "instance_type": name,
                    "family": family,
                    "category": family[0].upper(),
                    "architecture": "arm64" if family.endswith("g") else "x86_64",
                    "spec_url": url,
                    "spec_rows": {},
                    "prices": {},
                }
        for table in soup.find_all("table"):
            headers = [x.get_text(" ", strip=True) for x in table.find_all("th")]
            for tr in table.find_all("tr"):
                row = [x.get_text(" ", strip=True) for x in tr.find_all("td")]
                if not row:
                    continue
                name = row[0].split()[0]
                if name not in instances:
                    continue
                item = instances[name]
                if "Memory (GiB)" in headers:
                    item.update(
                        memory_gib=row[1],
                        processor=row[2],
                        vcpu=row[3],
                        cpu_cores=row[4],
                        threads_per_core=row[5],
                    )
                    item["spec_rows"]["compute"] = dict(zip(headers, row))
                elif any("Burst bandwidth" in h for h in headers):
                    item["network_baseline_gbps"] = baseline(row[1])
                    item["network_burst_gbps"] = row[1].split("/")[-1].strip()
                    item["spec_rows"]["network"] = dict(zip(headers, row))
                elif any("Maximum IOPS" in h for h in headers):
                    item["ebs_baseline_mbps"] = baseline(row[1])
                    item["ebs_baseline_MBps"] = baseline(row[2])
                    item["ebs_baseline_iops"] = baseline(row[3])
                    item["spec_rows"]["ebs"] = dict(zip(headers, row))
    ebs = {}
    with args.price_csv.open(newline="") as f:
        metadata = dict(next(csv.reader(f)) for _ in range(5))
        for row in csv.DictReader(f):
            if (
                row["TermType"] != "OnDemand"
                or row["Currency"] != "USD"
                or row["Region Code"] != "ap-northeast-2"
            ):
                continue
            name, os = row["Instance Type"], row["Operating System"]
            price = {
                "sku": row["SKU"],
                "rate_code": row["RateCode"],
                "unit": row["Unit"],
                "usd": row["PricePerUnit"],
                "effective_date": row["EffectiveDate"],
                "operation": row["operation"],
                "description": row["PriceDescription"],
                "license_model": row["License Model"],
                "source_url": PRICE_URL,
            }
            if name in instances and os in ("Linux", "Windows"):
                if (
                    row["Tenancy"] != "Shared"
                    or row["Pre Installed S/W"] != "NA"
                    or row["CapacityStatus"] != "Used"
                    or row["MarketOption"] != "OnDemand"
                    or row["operation"]
                    != {"Linux": "RunInstances", "Windows": "RunInstances:0002"}[os]
                ):
                    continue
                if os in instances[name]["prices"]:
                    raise ValueError(f"Ambiguous price {name}/{os}")
                if row["Unit"] != "Hrs" or row["StartingRange"] != "0":
                    raise ValueError("Unknown price dimension")
                instances[name]["prices"][os] = price
            if row["Volume API Name"] == "gp3":
                key = {
                    "APN2-EBS:VolumeUsage.gp3": "storage",
                    "APN2-EBS:VolumeP-IOPS.gp3": "iops",
                    "APN2-EBS:VolumeP-Throughput.gp3": "throughput",
                }.get(row["usageType"])
                if key:
                    if key in ebs:
                        raise ValueError(f"Ambiguous EBS price {key}")
                    ebs[key] = price
    for item in instances.values():
        for key in (
            "memory_gib",
            "vcpu",
            "network_baseline_gbps",
            "ebs_baseline_MBps",
            "ebs_baseline_iops",
        ):
            if key not in item:
                raise ValueError(f"Missing {item['instance_type']}/{key}")
        if "Linux" not in item["prices"]:
            raise ValueError(f"No regional Linux price: {item['instance_type']}")
    if set(ebs) != {"storage", "iops", "throughput"}:
        raise ValueError("EBS prices incomplete")
    receipts.append(
        {"url": PRICE_URL, "sha256": sha(args.price_csv), "metadata": metadata}
    )
    result = {
        "schema_version": 1,
        "catalog_version": f"aws-seoul-{args.verified_on}",
        "verified_on": args.verified_on,
        "region": "ap-northeast-2",
        "region_name": "아시아 태평양 (서울)",
        "currency": "USD",
        "price_scope": "On-Demand / Shared / Linux or Windows / no pre-installed software",
        "price_publication_date": metadata["Publication Date"],
        "price_version": metadata["Version"],
        "sources": receipts,
        "instances": sorted(
            instances.values(), key=lambda x: (x["family"], int(x["vcpu"]))
        ),
        "gp3": {
            "source_url": "https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html",
            "min_gib": "1",
            "max_gib": "65536",
            "included_iops": "3000",
            "max_iops": "80000",
            "included_MiBps": "125",
            "max_MiBps": "2000",
            "iops_per_gib": "500",
            "MiBps_per_iops": "0.25",
            "prices": ebs,
        },
        "limitations": [
            "한정된 36개 인스턴스의 공식 사양·가격 스냅샷",
            "AZ 수용량·계정 quota·실제 애플리케이션 성능은 미검증",
            "네트워크는 다중 흐름 기준, 실제 경로·단일 흐름은 별도 검토",
            "EC2 EBS 기준은 공식 표의 I/O 크기에 따른 한도",
        ],
    }
    out = ROOT / "data/aws/catalog.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Wrote {len(instances)} instances, {sum(len(x['prices']) for x in instances.values())} EC2 prices, 3 gp3 prices; {out}"
    )


if __name__ == "__main__":
    main()
