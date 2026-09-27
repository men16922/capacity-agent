"""Versioned AWS migration sizing. No float arithmetic or external API calls."""

from copy import deepcopy
from datetime import date
from fractions import Fraction as F
import hashlib
import json
from pathlib import Path

from capacity_engine.numeric import number, decimal_text, exact, rounded

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.1.0"
CATALOG_PATH = ROOT / "data/aws/catalog.json"


def catalog():
    return json.loads(CATALOG_PATH.read_text())


def ceil(value):
    return int(rounded(value, 0, "ceiling"))


class Inputs:
    def __init__(self, request):
        self.errors = []
        self.asset = request.get("asset", {})
        self.plan = request.get("plan", {})
        for key in ("asset", "plan"):
            if not isinstance(getattr(self, key), dict):
                self.errors.append({"field": key, "message": "객체 형식이 필요합니다."})
                setattr(self, key, {})

    def error(self, field, message):
        self.errors.append({"field": field, "message": message})

    def n(
        self, group, key, minimum=F(0), maximum=F(10**12), integer=False, positive=False
    ):
        value = getattr(self, group).get(key)
        try:
            result = number(value)
            if (
                result < minimum
                or result > maximum
                or (positive and result == 0)
                or (integer and result.denominator != 1)
            ):
                raise ValueError()
            return result
        except (ValueError, TypeError):
            self.error(
                f"{group}.{key}",
                "값·단위·허용 범위를 확인하세요. 숫자는 십진 문자열이어야 합니다.",
            )
            return F(0)

    def text(self, group, key, choices=None, optional=False):
        value = getattr(self, group).get(key)
        if optional and value in (None, ""):
            return ""
        if (
            not isinstance(value, str)
            or not value.strip()
            or len(value) > 2000
            or (choices is not None and value not in choices)
        ):
            self.error(f"{group}.{key}", "필수 항목 또는 선택값을 확인하세요.")
            return ""
        return value

    def boolean(self, key):
        value = self.plan.get(key)
        if type(value) is not bool:
            self.error(f"plan.{key}", "확인 여부를 선택하세요.")
            return False
        return value


def value_record(value, unit):
    return {
        "value": decimal_text(value),
        "unit": unit,
        "exact": exact(value),
        "display": rounded(value, 2),
    }


def usage(v, resource, positive=False):
    """Resolve an explicit amount/percent measurement without float rounding."""
    memory = resource == "memory"
    mode_key = "memory_usage_mode" if memory else "disk_usage_mode"
    amount_key = "peak_memory_gib" if memory else "disk_gib"
    allocation_key = "memory_gib" if memory else "disk_allocated_gib"
    percent_key = "peak_memory_percent" if memory else "disk_used_percent"
    mode = v.asset.get(mode_key, "amount") or "amount"
    if mode not in {"amount", "percent"}:
        v.error(f"asset.{mode_key}", "사용량 또는 사용률 입력 방식을 선택하세요.")
        return F(0)
    allocation = None
    if mode == "percent" or v.asset.get(allocation_key) not in (None, ""):
        allocation = v.n("asset", allocation_key, maximum=F(10**8), positive=True)
    if mode == "percent":
        percent = v.n("asset", percent_key, maximum=F(100), positive=positive)
        result = allocation * percent / 100
    else:
        result = v.n("asset", amount_key, maximum=F(10**8), positive=positive)
    if allocation is not None and result > allocation:
        v.error(
            f"asset.{amount_key}",
            "실사용량이 할당량보다 큽니다. 측정 범위를 확인하세요.",
        )
    return result


def cost_for(item, os, nodes, hours, storage, data):
    ec2_price = item.get("prices", {}).get(os)
    prices = data["gp3"].get("prices", {})
    compute = number(ec2_price["usd"]) * hours * nodes if ec2_price else None
    parts = {}
    quantities = {
        "storage": F(storage["size_gib"]),
        "iops": F(max(0, storage["iops"] - 3000)),
        "throughput": F(max(0, storage["throughput_mibps"] - 125), 1024),
    }
    units = {"storage": "GB-Mo", "iops": "IOPS-Mo", "throughput": "GiBps-mo"}
    for key, quantity in quantities.items():
        price = prices.get(key)
        parts[key] = (
            number(price["usd"]) * quantity * nodes
            if price and price["unit"] == units[key]
            else None
        )
    ebs = (
        sum(parts.values(), F(0))
        if all(v is not None for v in parts.values())
        else None
    )
    total = compute + ebs if compute is not None and ebs is not None else None
    return {
        "currency": "USD",
        "compute_monthly": decimal_text(compute) if compute is not None else None,
        "ebs_monthly": decimal_text(ebs) if ebs is not None else None,
        "total_monthly": decimal_text(total) if total is not None else None,
        "ebs_breakdown": {
            k: decimal_text(v) if v is not None else None for k, v in parts.items()
        },
        "hourly_price": ec2_price,
        "hours": decimal_text(hours),
        "nodes": int(nodes),
        "scope": "EC2 컴퓨트 + gp3 1개/노드, EBS는 1개월 보관",
        "excluded": [
            "데이터 전송",
            "NAT·로드밸런서·공인 IPv4",
            "스냅샷·백업",
            "지원·세금",
            "별도 소프트웨어 라이선스",
            "이관 작업 비용",
        ],
    }


def calculate_migration(request, data=None):
    if not isinstance(request, dict):
        return {
            "status": "invalid",
            "errors": [{"field": "request", "message": "JSON 객체가 필요합니다."}],
        }
    v = Inputs(request)
    if (
        request.get("schema_version") != 1
        or type(request.get("schema_version")) is not int
    ):
        v.error("schema_version", "지원하는 요청 버전은 1입니다.")
    asset_id = v.text("asset", "id")
    name = v.text("asset", "name")
    mode = v.text("plan", "mode", {"measured", "direct"})
    region = v.text("plan", "region")
    architecture = v.text("plan", "architecture", {"x86_64", "arm64"})
    os = v.text("plan", "os", {"Linux", "Windows"})
    family = v.text("plan", "family", {"all", "C", "M", "R"})
    nodes = v.n("plan", "target_nodes", F(1), F(1000), integer=True)
    failures = v.n("plan", "tolerated_failures", maximum=F(999), integer=True)
    distributed = v.boolean("distribution_verified")
    arm = v.boolean("arm_verified")
    v.text("plan", "basis")
    hours = v.n("plan", "hours_per_month", maximum=F(744), positive=True)
    storage_used = usage(v, "disk")
    storage_growth = v.n("plan", "storage_growth_percent", maximum=F(1000)) / 100
    reserve = v.n("plan", "storage_reserve_percent", maximum=F(99)) / 100
    network = v.n("plan", "network_gbps", maximum=F(10**5))
    iops = v.n("plan", "ebs_iops", maximum=F(10**9))
    throughput = v.n("plan", "ebs_throughput_mibps", maximum=F(10**8))
    if failures >= nodes:
        v.error("plan.tolerated_failures", "장애 후 최소 1개 노드가 남아야 합니다.")
    if architecture == "arm64" and (os != "Linux" or not arm):
        v.error(
            "plan.arm_verified",
            "ARM 후보는 Linux와 애플리케이션 호환성 확인이 필요합니다.",
        )
    if mode == "measured":
        allocated_cpu = v.n(
            "asset", "vcpu", maximum=F(100000), positive=True, integer=True
        )
        allocated_mem = v.n("asset", "memory_gib", maximum=F(10**8), positive=True)
        peak_cpu = v.n("asset", "peak_cpu_percent", maximum=F(100), positive=True) / 100
        peak_mem = usage(v, "memory", positive=True)
        fixed = v.n("plan", "fixed_memory_gib", maximum=F(10**8))
        growth_rate = v.n("plan", "growth_percent", maximum=F(1000)) / 100
        years = v.n("plan", "years", maximum=F(10), integer=True)
        cpu_target = (
            v.n("plan", "cpu_target_percent", maximum=F(100), positive=True) / 100
        )
        mem_target = (
            v.n("plan", "memory_target_percent", maximum=F(100), positive=True) / 100
        )
        relative = v.n("plan", "relative_performance", maximum=F(100), positive=True)
        v.text("plan", "relative_performance_basis")
        v.text("asset", "source")
        observed_on = v.text("asset", "observed_on")
        try:
            if date.fromisoformat(observed_on).isoformat() != observed_on:
                raise ValueError()
        except ValueError:
            v.error("asset.observed_on", "측정 기준일은 YYYY-MM-DD 형식이어야 합니다.")
        if fixed > peak_mem:
            v.error(
                "plan.fixed_memory_gib",
                "고정 메모리는 피크 실사용량에 포함된 값이어야 합니다.",
            )
        if peak_mem > allocated_mem:
            v.error(
                "asset.peak_memory_gib",
                "피크 메모리가 할당량보다 큽니다. 측정 범위를 확인하세요.",
            )
    else:
        cpu = v.n("plan", "direct_vcpu", maximum=F(100000), positive=True)
        memory = v.n("plan", "direct_memory_gib", maximum=F(10**8), positive=True)
    if v.errors:
        return {"status": "invalid", "errors": v.errors}
    data = deepcopy(data) if data is not None else catalog()
    if region != data["region"]:
        return {
            "status": "invalid",
            "errors": [
                {
                    "field": "plan.region",
                    "message": "현재 공식 카탈로그는 서울(ap-northeast-2) 리전입니다.",
                }
            ],
        }
    divisor = nodes - failures if distributed else F(1)
    trace = []
    if mode == "measured":
        growth = (1 + growth_rate) ** int(years)
        cpu = allocated_cpu * peak_cpu * growth / relative / cpu_target / divisor
        memory = ((peak_mem - fixed) * growth / divisor + fixed) / mem_target
        trace = [
            {
                "name": "성장 배수",
                "expression": "(1 + 연간 성장률) ^ 목표 연도",
                **value_record(growth, "factor"),
            },
            {
                "name": "장애 후 분산 계수",
                "expression": "분산 검증 시 배포수−장애수, 미검증 시 1",
                **value_record(divisor, "nodes"),
            },
            {
                "name": "CPU 필요량/노드",
                "expression": "할당 논리 CPU × 피크 사용률 × 성장 / 상대성능 / 목표 사용률 / 분산 계수",
                **value_record(cpu, "vCPU"),
            },
            {
                "name": "메모리 필요량/노드",
                "expression": "((피크 실사용−고정분) × 성장 / 분산 계수 + 고정분) / 목표 사용률",
                **value_record(memory, "GiB"),
            },
        ]
    else:
        trace = [
            {
                "name": "확정 CPU 요구량/노드",
                "expression": "사용자가 확인한 최종 요구량, 추가 보정 없음",
                **value_record(cpu, "vCPU"),
            },
            {
                "name": "확정 메모리 요구량/노드",
                "expression": "사용자가 확인한 최종 요구량, 추가 보정 없음",
                **value_record(memory, "GiB"),
            },
        ]
    gp3 = data["gp3"]
    provisioned_throughput = max(int(gp3["included_MiBps"]), ceil(throughput))
    provisioned_iops = max(
        int(gp3["included_iops"]),
        ceil(iops),
        ceil(F(provisioned_throughput) / number(gp3["MiBps_per_iops"])),
    )
    logical = storage_used * (1 + storage_growth) / (1 - reserve)
    min_size_iops = (
        ceil(F(provisioned_iops) / number(gp3["iops_per_gib"]))
        if provisioned_iops > int(gp3["included_iops"])
        else 1
    )
    size = max(1, ceil(logical), min_size_iops)
    storage = {
        "size_gib": size,
        "iops": provisioned_iops,
        "throughput_mibps": provisioned_throughput,
        "logical_requirement": value_record(logical, "GiB"),
        "volumes_per_node": 1,
        "source_url": gp3["source_url"],
        "scope": "노드당 논리 볼륨 1개. OS·데이터·로그를 포함한 사용량, 백업 제외",
    }
    storage_valid = (
        size <= int(gp3["max_gib"])
        and provisioned_iops <= int(gp3["max_iops"])
        and provisioned_throughput <= int(gp3["max_MiBps"])
    )
    trace.append(
        {
            "name": "gp3 논리 필요량",
            "expression": "사용량 × (1 + 스토리지 성장률) / (1 − 여유율)",
            **value_record(logical, "GiB"),
        }
    )
    trace.extend(
        [
            {
                "name": "해석된 디스크 실사용량",
                "expression": "사용량 입력 또는 할당량 × 사용률 / 100",
                **value_record(storage_used, "GiB"),
            },
            *(
                [
                    {
                        "name": "해석된 메모리 실사용량",
                        "expression": "사용량 입력 또는 할당량 × 사용률 / 100",
                        **value_record(peak_mem, "GiB"),
                    }
                ]
                if mode == "measured"
                else []
            ),
        ]
    )
    trace.append(
        {
            "name": "gp3 설정 용량",
            "expression": "논리 필요량·IOPS/용량 제약 중 큰 값을 GiB 단위 올림",
            **value_record(F(size), "GiB"),
        }
    )
    requirements = {
        "vcpu": value_record(cpu, "vCPU"),
        "memory_gib": value_record(memory, "GiB"),
        "network_gbps": value_record(network, "Gbps"),
        "ebs_iops": value_record(iops, "IOPS"),
        "ebs_throughput_mibps": value_record(throughput, "MiB/s"),
        "target_nodes": int(nodes),
        "surviving_nodes": int(nodes - failures),
        "divisor": int(divisor),
    }
    candidates, rejected = [], []
    for item in data["instances"]:
        reasons = []
        if item["architecture"] != architecture:
            reasons.append("architecture")
        if family != "all" and item["category"] != family:
            reasons.append("family")
        for key, requirement, limit in [
            ("vcpu", cpu, number(item["vcpu"])),
            ("memory", memory, number(item["memory_gib"])),
            ("network", network, number(item["network_baseline_gbps"])),
            ("ebs_iops", iops, number(item["ebs_baseline_iops"])),
            (
                "ebs_throughput",
                throughput * F(1048576, 1000000),
                number(item["ebs_baseline_MBps"]),
            ),
        ]:
            if requirement > limit:
                reasons.append(key)
        if not storage_valid:
            reasons.append("gp3_limit")
        if reasons:
            rejected.append(
                {"instance_type": item["instance_type"], "reasons": reasons}
            )
            continue
        candidate = {
            k: deepcopy(value) for k, value in item.items() if k != "spec_rows"
        }
        candidate["cost"] = cost_for(item, os, nodes, hours, storage, data)
        candidate["headroom"] = {
            "vcpu": decimal_text(number(item["vcpu"]) - cpu),
            "memory_gib": decimal_text(number(item["memory_gib"]) - memory),
        }
        candidate["reasons"] = [
            "CPU·메모리 요구량 충족",
            "공식 기준 네트워크·EBS 한도 내",
            "선택한 OS·아키텍처 조건",
        ]
        candidates.append(candidate)
    candidates.sort(
        key=lambda x: (
            number(x["vcpu"]),
            number(x["memory_gib"]),
            number(x["cost"]["total_monthly"])
            if x["cost"]["total_monthly"] is not None
            else F(10**30),
            x["instance_type"],
        )
    )
    warnings = [
        "실제 애플리케이션 처리 성능·AZ 수용량·계정 quota·장애전환은 별도 검증이 필요합니다.",
        "네트워크·EBS 요구량은 성장·장애 조건을 반영한 노드당 최종 값입니다.",
        "gp3는 노드마다 논리 볼륨 1개를 보관하는 초안이며 백업·복제 방식은 별도 설계입니다.",
    ]
    if mode == "measured":
        warnings.append(
            "상대성능은 입력한 근거의 가정입니다. CPU 세대·SMT·ARM 변경 효과를 실측한 결과가 아닙니다."
        )
    if not distributed and nodes > 1:
        warnings.append(
            "분산 처리가 확인되지 않아 각 노드가 전체 부하를 감당하도록 계산했습니다."
        )
    if not storage_valid:
        warnings.append(
            "단일 gp3 볼륨 한도를 초과했습니다. 볼륨·스토리지 설계를 다시 검토하세요."
        )
    source_sha = "d6bfd84a3ce8ede1bbe0eb23881efe43d2cd70fe3d88355af9a0670ba73fa4ad"
    return {
        "status": "complete" if candidates else "no_candidates",
        "errors": [],
        "engine_version": VERSION,
        "asset_id": asset_id,
        "asset_name": name,
        "mode": mode,
        "requirements": requirements,
        "storage": storage,
        "candidates": candidates,
        "rejected": rejected,
        "warnings": warnings,
        "trace": trace,
        "ranking": "최소 vCPU → 최소 메모리 → 동일 사양의 월 예상 비용",
        "input": deepcopy(request),
        "provenance": {
            "source_id": "xlsx-d6bfd84a3ce8",
            "source_sha256": source_sha,
            "source_cells": "AWS EC2!B39:B42,B55:B70",
            "model": "migration-workbook-1.0.0",
            "catalog_version": data["catalog_version"],
            "catalog_verified_on": data["verified_on"],
            "catalog_sha256": hashlib.sha256(
                json.dumps(data, sort_keys=True, ensure_ascii=False).encode()
            ).hexdigest(),
            "price_version": data["price_version"],
            "price_publication_date": data["price_publication_date"],
            "region": region,
            "gp3_source": gp3["source_url"],
        },
    }
