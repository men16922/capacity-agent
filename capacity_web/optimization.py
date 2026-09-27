"""User-supplied utilization planning; not AWS Compute Optimizer recommendations."""

from copy import deepcopy
from datetime import date
from fractions import Fraction as F

from capacity_engine.numeric import number, decimal_text
from capacity_web.migration import (
    Inputs,
    usage,
    value_record,
    ceil,
    catalog,
    calculate_migration,
    cost_for,
)

VERSION = "utilization-planning-1.0.0"


def calculate_optimization(request, data=None):
    if not isinstance(request, dict):
        return {
            "status": "invalid",
            "errors": [{"field": "request", "message": "JSON 객체가 필요합니다."}],
        }
    v = Inputs(request)
    if (
        type(request.get("schema_version")) is not int
        or request.get("schema_version") != 1
    ):
        v.error("schema_version", "지원하는 요청 버전은 1입니다.")
    environment = request.get("environment")
    if environment not in ("onprem", "aws"):
        v.error("environment", "On-Prem 또는 AWS를 선택하세요.")
    v.text("asset", "id")
    v.text("asset", "name")
    v.text("asset", "source")
    observed = v.text("asset", "observed_on")
    try:
        if date.fromisoformat(observed).isoformat() != observed:
            raise ValueError()
    except ValueError:
        v.error("asset.observed_on", "측정일은 YYYY-MM-DD 형식입니다.")
    cpu = v.n("asset", "vcpu", maximum=F(100000), integer=True, positive=True)
    mem = v.n("asset", "memory_gib", maximum=F(10**8), positive=True)
    peak_cpu = v.n("asset", "peak_cpu_percent", maximum=F(100), positive=True) / 100
    peak_mem = usage(v, "memory", positive=True)
    disk = usage(v, "disk")
    growth_rate = v.n("plan", "growth_percent", maximum=F(1000)) / 100
    years = v.n("plan", "years", maximum=F(10), integer=True)
    target_cpu = v.n("plan", "cpu_target_percent", maximum=F(100), positive=True) / 100
    target_mem = (
        v.n("plan", "memory_target_percent", maximum=F(100), positive=True) / 100
    )
    fixed = v.n("plan", "fixed_memory_gib", maximum=F(10**8))
    disk_growth = v.n("plan", "storage_growth_percent", maximum=F(1000)) / 100
    reserve = v.n("plan", "storage_reserve_percent", maximum=F(99)) / 100
    v.text("plan", "basis")
    if fixed > peak_mem:
        v.error(
            "plan.fixed_memory_gib", "고정 메모리는 피크 실사용량에 포함되어야 합니다."
        )
    if v.errors:
        return {"status": "invalid", "errors": v.errors}
    growth = (1 + growth_rate) ** int(years)
    values = {
        "vcpu": cpu * peak_cpu * growth / target_cpu,
        "memory_gib": ((peak_mem - fixed) * growth + fixed) / target_mem,
        "disk_gib": disk * (1 + disk_growth) / (1 - reserve),
    }
    expressions = [
        "할당 논리 CPU × 피크 사용률 × (1+성장률)^기간 / 목표 사용률",
        "((피크 실사용−고정분) × (1+성장률)^기간 + 고정분) / 목표 사용률",
        "실사용 디스크 × (1+디스크 성장률) / (1−여유율)",
    ]
    result = {
        "status": "complete",
        "errors": [],
        "model_version": VERSION,
        "environment": environment,
        "input": deepcopy(request),
        "requirements": {
            k: {
                **value_record(n, "logical CPU" if k == "vcpu" else "GiB"),
                "minimum": ceil(n),
            }
            for k, n in values.items()
        },
        "measurements": {
            "memory_gib": value_record(peak_mem, "GiB"),
            "disk_gib": value_record(disk, "GiB"),
        },
        "trace": [
            {
                "name": k,
                "expression": expressions[i],
                **value_record(n, "logical CPU" if k == "vcpu" else "GiB"),
            }
            for i, (k, n) in enumerate(values.items())
        ],
        "warnings": [],
    }
    result["warnings"] = [
        "입력한 측정값의 계획 산정입니다. 동일 논리 CPU 성능을 가정하며 실제 부하시험·장애 대비·라이선스를 확인하세요."
    ]
    if environment == "aws":
        data = deepcopy(data) if data is not None else catalog()
        current = next(
            (
                x
                for x in data["instances"]
                if x["instance_type"] == v.asset.get("instance_type")
            ),
            None,
        )
        if current is None:
            v.error("asset.instance_type", "현재 EC2 사양이 서울 카탈로그에 없습니다.")
        elif (
            number(current["vcpu"]) != cpu
            or number(current["memory_gib"]) != mem
            or current["architecture"] != v.asset.get("architecture")
        ):
            v.error(
                "asset.instance_type",
                "현재 EC2 유형과 할당 CPU·메모리·아키텍처가 일치해야 합니다.",
            )
        if v.errors:
            return {"status": "invalid", "errors": v.errors}
        migration_request = {
            "schema_version": 1,
            "asset": deepcopy(v.asset),
            "plan": {
                **v.plan,
                "mode": "measured",
                "architecture": current["architecture"],
                "os": v.asset.get("os"),
                "target_nodes": "1",
                "tolerated_failures": "0",
                "distribution_verified": False,
                "arm_verified": current["architecture"] == "arm64",
                "relative_performance": "1",
                "relative_performance_basis": "동일 논리 CPU 성능 가정 · 실제 부하 검증 필요",
            },
        }
        migration = calculate_migration(migration_request, data)
        if migration["status"] == "invalid":
            return migration
        result["status"] = migration["status"]
        result["migration"] = migration
        result["baseline_cost"] = None
        result["monthly_difference"] = None
        # Compare like-for-like EC2 On-Demand + one provisioned gp3 volume.
        if all(
            v.asset.get(k) not in (None, "")
            for k in ("disk_allocated_gib", "current_iops", "current_throughput_mibps")
        ):
            size = v.n(
                "asset",
                "disk_allocated_gib",
                minimum=F(1),
                maximum=F(data["gp3"]["max_gib"]),
                integer=True,
            )
            iops = v.n(
                "asset",
                "current_iops",
                minimum=F(3000),
                maximum=F(data["gp3"]["max_iops"]),
                integer=True,
            )
            throughput = v.n(
                "asset",
                "current_throughput_mibps",
                minimum=F(125),
                maximum=F(data["gp3"]["max_MiBps"]),
                integer=True,
            )
            if iops > max(
                F(3000), size * number(data["gp3"]["iops_per_gib"])
            ) or throughput > iops * number(data["gp3"]["MiBps_per_iops"]):
                v.error(
                    "asset.current_iops",
                    "현재 gp3의 용량·IOPS·처리량 제약을 확인하세요.",
                )
            if v.errors:
                return {"status": "invalid", "errors": v.errors}
            baseline = cost_for(
                current,
                v.asset["os"],
                F(1),
                number(v.plan["hours_per_month"]),
                {
                    "size_gib": int(size),
                    "iops": int(iops),
                    "throughput_mibps": int(throughput),
                },
                data,
            )
            result["baseline_cost"] = baseline
            if (
                migration["candidates"]
                and baseline["total_monthly"] is not None
                and migration["candidates"][0]["cost"]["total_monthly"] is not None
            ):
                result["monthly_difference"] = decimal_text(
                    number(baseline["total_monthly"])
                    - number(migration["candidates"][0]["cost"]["total_monthly"])
                )
        else:
            result["warnings"].append(
                "현재 gp3 할당량·프로비저닝 IOPS·처리량이 없어 비용 차이를 계산하지 않았습니다."
            )
        result["warnings"].extend(
            [
                "AWS Compute Optimizer API 결과가 아닌 사용자 입력 기반 후보 제안입니다. 서울 카탈로그·EC2 On-Demand+gp3 범위이며 할인·네트워크 등은 제외합니다.",
                "작은 EBS 용량으로 직접 축소할 수 없습니다. 축소안은 새 볼륨으로 데이터 이동·검증이 필요합니다.",
            ]
        )
    return result
