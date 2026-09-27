import Decimal from "decimal.js";

Decimal.set({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
export type Asset = {
  id: string;
  name: string;
  role: string;
  os: string;
  architecture: string;
  vcpu: string;
  memory_gib: string;
  disk_gib: string;
  peak_cpu_percent: string;
  peak_memory_gib: string;
  iops: string;
  throughput_mibps: string;
  network_gbps: string;
  source: string;
  observed_on: string;
  hardware?: string;
  asset_type?: string;
  environment?: string;
  application?: string;
  os_version?: string;
  software?: string;
  license?: string;
  dependencies?: string;
  availability?: string;
};
export type Plan = Record<string, string | boolean>;
export type MigrationRequest = {
  schema_version: number;
  asset: Asset;
  plan: Plan;
};
export type Val = {
  value: string;
  unit: string;
  display: string;
  exact: { numerator: string; denominator: string };
};
export type Candidate = {
  instance_type: string;
  family: string;
  category: string;
  architecture: string;
  processor: string;
  vcpu: string;
  memory_gib: string;
  network_baseline_gbps: string;
  network_burst_gbps: string;
  ebs_baseline_iops: string;
  ebs_baseline_MBps: string;
  spec_url: string;
  reasons: string[];
  headroom: { vcpu: string; memory_gib: string };
  cost: {
    total_monthly: string | null;
    compute_monthly: string | null;
    ebs_monthly: string | null;
    ebs_breakdown: Record<string, string | null>;
    currency: string;
    scope: string;
    excluded: string[];
    hourly_price: {
      usd: string;
      source_url: string;
      effective_date: string;
      sku: string;
      operation: string;
    } | null;
    hours: string;
    nodes: number;
  };
};
export type MigrationResult = {
  status: string;
  errors: { field: string; message: string }[];
  asset_id: string;
  asset_name: string;
  requirements?: {
    vcpu: Val;
    memory_gib: Val;
    network_gbps: Val;
    ebs_iops: Val;
    ebs_throughput_mibps: Val;
    target_nodes: number;
    surviving_nodes: number;
    divisor: number;
  };
  storage?: {
    size_gib: number;
    iops: number;
    throughput_mibps: number;
    logical_requirement: Val;
    source_url: string;
    scope: string;
  };
  candidates?: Candidate[];
  rejected?: { instance_type: string; reasons: string[] }[];
  warnings?: string[];
  trace?: (Val & { name: string; expression: string })[];
  provenance?: Record<string, string>;
  ranking?: string;
  input?: MigrationRequest;
};
export type Scenario = {
  id: string;
  name: string;
  savedAt: string;
  request: MigrationRequest;
  result: MigrationResult;
  selected: string;
};
export type MigrationDraft = {
  assetId: string;
  plan: Plan;
  request?: MigrationRequest;
  result?: MigrationResult;
  selected: string;
  calculatedAt?: string;
  failure?: string;
};
export type CalcRequest = {
  schema_version: number;
  profile_id: string;
  rule_version: string;
  scenario_id: string;
  as_of: string;
  assumptions: string[];
  source_refs: string[];
  calculations: Calculation[];
};
export type InputValue = {
  value?: string | null | string[];
  result_ref?: string;
  unit: string;
  origin?: string;
  evidence?: string;
  as_of?: string;
};
export type Calculation = {
  id: string;
  system_id: string;
  formula_id: string;
  inputs: Record<string, InputValue>;
  options: Record<string, string>;
};
export type CalcResult = {
  status: string;
  errors: { path?: string; message: string; code?: string }[];
  results: {
    id: string;
    system_id: string;
    formula_id: string;
    status: string;
    raw_value?: string;
    unit?: string;
    exact_value?: { numerator: string; denominator: string };
    display_value?: string;
    minimum_whole_value?: string;
    errors: { message: string; path?: string }[];
    missing_fields: string[];
    warnings: { message: string }[];
    trace?: {
      expression: string;
      inputs: Record<
        string,
        {
          original: InputValue;
          normalized_value: string;
          normalized_unit: string;
        }
      >;
    };
    source_refs?: { source_id: string; pages: number[] }[];
  }[];
  engine_version?: string;
};
export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  demo: boolean;
  assets: Asset[];
  scenarios: Scenario[];
  migrationDrafts?: MigrationDraft[];
  calculations: {
    id: string;
    name: string;
    request: CalcRequest;
    result: CalcResult;
  }[];
};
export type Bootstrap = {
  engine_version: string;
  source_count: number;
  catalog: {
    verified_on: string;
    region: string;
    region_name: string;
    catalog_version: string;
    price_publication_date: string;
    price_scope: string;
    limitations: string[];
  };
  documents: { id: string; title: string; category: string }[];
  sources: {
    id: string;
    path: string;
    card: string;
    format: string;
    page_count: number | null;
    sha256: string;
    available: boolean;
  }[];
  benchmarks: { id: string; title: string; url: string; checked_on: string }[];
  formulas: {
    id: string;
    profile_id: string;
    expression: string;
    source_id: string;
    source_pages: number[];
    inputs: string[];
    output_unit: string;
  }[];
  specs: Record<
    string,
    Record<
      string,
      {
        unit: string;
        minimum: string;
        maximum: string | null;
        integer: boolean;
      }
    >
  >;
  examples: Record<string, CalcRequest> & { migration: MigrationRequest };
};

export const TODAY = new Date().toLocaleDateString("sv-SE");
export const uid = () => crypto.randomUUID();
export const copy = <T>(x: T): T => structuredClone(x);
export function fmt(
  value: string | number | null | undefined,
  places = 2,
): string {
  if (value == null || value === "") return "—";
  try {
    const [whole, decimal] = new Decimal(value).toFixed(places).split(".");
    const fraction = decimal?.replace(/0+$/, "");
    return (
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      (fraction ? "." + fraction : "")
    );
  } catch {
    return "—";
  }
}
export const money = (value: string | null | undefined) =>
  value == null
    ? "미산정"
    : `$${new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export const sum = (values: (string | number)[]) =>
  values.reduce<Decimal>((a, b) => a.add(b || 0), new Decimal(0)).toString();
export const delta = (a: string, b: string) =>
  new Decimal(b).minus(a).toString();
export const percentChange = (a: string, b: string) =>
  new Decimal(a).eq(0)
    ? null
    : new Decimal(b).minus(a).div(a).times(100).toString();
export function download(
  name: string,
  content: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function api<T>(
  path: string,
  payload?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    signal,
    ...(payload === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "요청을 처리하지 못했습니다. 입력과 서버 연결을 확인하세요.",
    );
  return result;
}
export function blankAsset(): Asset {
  return {
    id: uid(),
    name: "",
    role: "WEB/WAS",
    os: "Linux",
    architecture: "x86_64",
    vcpu: "",
    memory_gib: "",
    disk_gib: "",
    peak_cpu_percent: "",
    peak_memory_gib: "",
    iops: "",
    throughput_mibps: "",
    network_gbps: "",
    source: "",
    observed_on: TODAY,
    hardware: "",
    asset_type: "",
    environment: "",
    application: "",
    os_version: "",
    software: "",
    license: "",
    dependencies: "",
    availability: "",
  };
}
export function assetErrors(asset: Asset): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ["id", "name", "role", "os", "architecture"] as const) {
    if (
      typeof asset[key] !== "string" ||
      !asset[key].trim() ||
      asset[key].length > 200
    )
      errors[key] = "필수 항목입니다. 200자 이내로 입력하세요.";
  }
  if (!["Linux", "Windows"].includes(asset.os))
    errors.os = "Linux 또는 Windows를 선택하세요.";
  if (!["x86_64", "arm64"].includes(asset.architecture))
    errors.architecture = "논리 CPU 아키텍처를 확인하세요.";
  for (const key of [
    "vcpu",
    "memory_gib",
    "disk_gib",
    "peak_cpu_percent",
    "peak_memory_gib",
    "iops",
    "throughput_mibps",
    "network_gbps",
  ] as const) {
    const value = asset[key];
    const required = ["vcpu", "memory_gib", "disk_gib"].includes(key);
    if (value === "" && !required) continue;
    if (
      typeof value !== "string" ||
      !/^(0|[1-9]\d*)(\.\d+)?$/.test(value) ||
      value.length > 30
    ) {
      errors[key] = "0 이상의 십진 숫자로 입력하세요.";
      continue;
    }
    const n = new Decimal(value);
    if (
      n.gt("1000000000000") ||
      (["vcpu", "memory_gib"].includes(key) && n.lte(0))
    )
      errors[key] = "허용 범위를 확인하세요.";
    if (key === "vcpu" && !n.isInteger())
      errors[key] = "논리 CPU 개수는 정수여야 합니다.";
    if (key === "peak_cpu_percent" && n.gt(100))
      errors[key] = "0~100% 범위입니다.";
  }
  if (
    !errors.peak_memory_gib &&
    !errors.memory_gib &&
    asset.peak_memory_gib &&
    new Decimal(asset.peak_memory_gib).gt(asset.memory_gib)
  )
    errors.peak_memory_gib = "할당 메모리보다 클 수 없습니다.";
  if (typeof asset.source !== "string" || asset.source.length > 2000)
    errors.source = "근거는 2,000자 이내입니다.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asset.observed_on) ||
    Number.isNaN(Date.parse(asset.observed_on)) ||
    new Date(asset.observed_on).toISOString().slice(0, 10) !== asset.observed_on
  )
    errors.observed_on = "YYYY-MM-DD 형식으로 입력하세요.";
  for (const key of [
    "hardware",
    "asset_type",
    "environment",
    "application",
    "os_version",
    "software",
    "license",
    "dependencies",
    "availability",
  ] as const) {
    if (
      asset[key] !== undefined &&
      (typeof asset[key] !== "string" || asset[key]!.length > 2000)
    )
      errors[key] = "2,000자 이내로 입력하세요.";
  }
  return errors;
}
export function planFor(asset: Asset): Plan {
  return {
    mode:
      asset.peak_cpu_percent && asset.peak_memory_gib ? "measured" : "direct",
    region: "ap-northeast-2",
    architecture: "x86_64",
    os: asset.os,
    family: "all",
    target_nodes: "1",
    tolerated_failures: "0",
    distribution_verified: false,
    arm_verified: false,
    basis: "초기 이전안 · 입력과 가정 검토 필요",
    hours_per_month: "730",
    growth_percent: "20",
    years: "1",
    cpu_target_percent: "70",
    memory_target_percent: "80",
    relative_performance: "1",
    relative_performance_basis: "상대성능 1 가정 · 이전 후 부하시험 필요",
    fixed_memory_gib: "0",
    direct_vcpu: asset.vcpu,
    direct_memory_gib: asset.memory_gib,
    storage_growth_percent: "20",
    storage_reserve_percent: "20",
    network_gbps: asset.network_gbps,
    ebs_iops: asset.iops,
    ebs_throughput_mibps: asset.throughput_mibps,
  };
}
export function newProject(demo = false): Project {
  const assets = demo
    ? [
        {
          ...blankAsset(),
          id: "demo-web",
          name: "고객 포털 WEB/WAS",
          role: "WEB/WAS",
          vcpu: "16",
          memory_gib: "64",
          disk_gib: "300",
          peak_cpu_percent: "35",
          peak_memory_gib: "32",
          iops: "6000",
          throughput_mibps: "200",
          network_gbps: "0.5",
          source: "워크북 산술 예제 · 실제 운영 측정값 아님",
          hardware: "가상 머신 · 예제",
        },
        {
          ...blankAsset(),
          id: "demo-db",
          name: "업무 DB",
          role: "DB",
          vcpu: "32",
          memory_gib: "128",
          disk_gib: "1200",
          peak_cpu_percent: "42",
          peak_memory_gib: "80",
          iops: "12000",
          throughput_mibps: "300",
          network_gbps: "1",
          source: "합성 DB 시나리오 · 실제 운영 측정값 아님",
          hardware: "가상 머신 · 예제",
        },
        {
          ...blankAsset(),
          id: "demo-batch",
          name: "야간 배치",
          role: "BATCH",
          vcpu: "8",
          memory_gib: "32",
          disk_gib: "180",
          peak_cpu_percent: "55",
          peak_memory_gib: "12",
          iops: "3000",
          throughput_mibps: "100",
          network_gbps: "0.25",
          source: "합성 배치 시나리오 · 실제 운영 측정값 아님",
          hardware: "가상 머신 · 예제",
        },
      ]
    : [];
  return {
    schemaVersion: 1,
    id: uid(),
    name: demo ? "업무 시스템 클라우드 전환" : "새 인프라 프로젝트",
    demo,
    assets,
    scenarios: [],
    calculations: [],
  };
}
export function parseProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("프로젝트 JSON 객체가 필요합니다.");
  const p = value as Project;
  if (
    p.schemaVersion !== 1 ||
    typeof p.name !== "string" ||
    p.name.length > 200 ||
    typeof p.id !== "string" ||
    typeof p.demo !== "boolean" ||
    !Array.isArray(p.assets) ||
    !Array.isArray(p.scenarios) ||
    !Array.isArray(p.calculations) ||
    p.assets.length > 200 ||
    p.scenarios.length > 200 ||
    p.calculations.length > 30
  )
    throw new Error("프로젝트 버전·형식·크기를 확인하세요.");
  if (
    p.assets.some(
      (a) => !a || typeof a !== "object" || Object.keys(assetErrors(a)).length,
    )
  )
    throw new Error("서버 자산에 잘못된 값이 있습니다.");
  if (new Set(p.assets.map((a) => a.id)).size !== p.assets.length)
    throw new Error("서버 자산 ID가 중복됩니다.");
  const validPlan = (plan: Plan) =>
    plan &&
    typeof plan === "object" &&
    !Array.isArray(plan) &&
    Object.keys(plan).length <= 50 &&
    Object.values(plan).every(
      (v) =>
        typeof v === "boolean" || (typeof v === "string" && v.length <= 2000),
    );
  if (p.migrationDrafts !== undefined) {
    if (
      !Array.isArray(p.migrationDrafts) ||
      p.migrationDrafts.length > 200 ||
      new Set(p.migrationDrafts.map((d) => d?.assetId)).size !==
        p.migrationDrafts.length ||
      p.migrationDrafts.some(
        (d) =>
          !d ||
          typeof d.assetId !== "string" ||
          typeof d.selected !== "string" ||
          !validPlan(d.plan) ||
          (d.failure !== undefined && typeof d.failure !== "string") ||
          (d.result !== undefined &&
            (!d.request ||
              !d.result ||
              !["complete", "invalid", "no_candidates"].includes(
                d.result.status,
              ) ||
              !Array.isArray(d.result.errors) ||
              (d.result.status === "complete" &&
                !Array.isArray(d.result.candidates)))) ||
          (d.request !== undefined &&
            (!d.request ||
              d.request.schema_version !== 1 ||
              !d.request.asset ||
              Object.keys(assetErrors(d.request.asset)).length ||
              d.request.asset.id !== d.assetId ||
              !validPlan(d.request.plan))),
      )
    )
      throw new Error("이전 설계 초안 형식이 올바르지 않습니다.");
  }
  for (const s of p.scenarios)
    if (
      !s ||
      typeof s.id !== "string" ||
      typeof s.name !== "string" ||
      typeof s.selected !== "string" ||
      !s.request ||
      s.request.schema_version !== 1 ||
      !s.result ||
      !Array.isArray(s.result.candidates)
    )
      throw new Error("저장된 이전안 형식이 올바르지 않습니다.");
  for (const c of p.calculations)
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      !c.request ||
      !Array.isArray(c.request.calculations) ||
      !c.result ||
      !Array.isArray(c.result.results)
    )
      throw new Error("저장된 산정 결과 형식이 올바르지 않습니다.");
  return p;
}
export const profileNames: Record<string, string> = {
  "tta-r3-2023": "TTA R3 · 서버/스토리지",
  "network-guide-2021": "2021 네트워크 가이드",
  "lecture-network": "강의 · 네트워크",
};
export const formulaNames: Record<string, string> = {
  "TTA-WEB-CPU": "WEB/WAS CPU",
  "TTA-OLTP-CPU": "DB CPU",
  "TTA-MEMORY": "메모리",
  "TTA-SYSTEM-DISK": "시스템 디스크",
  "TTA-DATA-DISK": "데이터 디스크",
  "TTA-OLTP-IOPS": "OLTP IOPS",
  "TTA-BATCH-IOPS": "배치 IOPS",
  "NET-BANDWIDTH": "전송 대역폭",
  "NET-DOWNLINK-PORTS": "다운링크 포트",
  "NET-UPLINK": "업링크",
  "NET-SWITCHING": "스위칭 용량",
  "GUIDE-ACCESS-PORTS": "접속 포트",
  "GUIDE-ACCESS-UPLINK": "접속 업링크",
  "GUIDE-UPLINK-PORTS": "업링크 포트 수",
  "GUIDE-ACCESS-SWITCHING": "접속 스위칭 용량",
  "GUIDE-ACCESS-PPS": "접속 패킷 처리량",
  "GUIDE-BACKBONE-SWITCHING": "백본 스위칭 용량",
  "GUIDE-BACKBONE-PPS": "백본 패킷 처리량",
  "GUIDE-TARGET-SESSIONS": "L4/L7 TCP 세션",
  "GUIDE-L47-THROUGHPUT": "L4/L7 처리량",
  "GUIDE-WDM-CAPACITY": "WDM 전송 용량",
};
export const fieldNames: Record<string, string> = {
  S1: "동시 사용자",
  S2: "사용자당 업무 처리",
  S3: "기본 OPS",
  S4: "업무 용도 보정",
  S5: "인터페이스 부하 보정",
  S6: "피크타임 부하 보정",
  S7: "연계 부하 보정",
  S8: "클러스터 보정",
  S9: "여유율",
  S10: "목표 CPU 활용률",
  S11: "벤치마크 단위 보정",
  O1: "분당 트랜잭션",
  O2: "기본 tpmC 보정",
  O3: "피크타임 부하 보정",
  O4: "DB 크기 보정",
  O5: "애플리케이션 구조 보정",
  O6: "애플리케이션 부하 보정",
  O7: "연계 부하 보정",
  O8: "클러스터 보정",
  O9: "여유율",
  O10: "목표 CPU 활용률",
  M1: "시스템 메모리",
  M2: "사용자당 메모리",
  M3: "동시 사용자",
  M4: "OS 버퍼·캐시 보정",
  M5: "애플리케이션 메모리",
  M6: "여유율",
  D1: "OS 영역",
  D2: "응용 프로그램 영역",
  D3: "SWAP 영역",
  D4: "파일시스템 보정",
  D5: "여유율",
  D6: "데이터 영역",
  D7: "백업 영역",
  D8: "RAID 보정",
  oltp_tpmC: "OLTP CPU 요구량",
  batch_tpmC: "배치 CPU 요구량",
  traffic_bytes: "전송 데이터",
  transfer_seconds: "전송 시간",
  required_ports: "필요 포트",
  expansion_factor: "확장 계수",
  stability_factor: "안정성 계수",
  downlink_gbps: "다운링크 속도",
  downlink_ports: "다운링크 포트 수",
  role_factor: "업링크 비율",
  all_port_gbps: "포트별 속도 목록",
  required_uplink_gbps: "필요 업링크",
  uplink_port_gbps: "선택 업링크 속도",
  redundancy_factor: "전체 용량 경로 수",
  growth_rate: "성장 증가분",
  peak_sessions: "피크 TCP 세션",
  target_sessions: "목표 TCP 세션",
  average_session_bytes: "평균 세션 데이터",
  average_session_seconds: "평균 세션 지속 시간",
  concurrent_users: "동시 사용자",
  sessions_per_user: "사용자당 세션",
  avg_session_seconds: "평균 세션 시간",
  session_bytes: "세션당 데이터",
  line_gbps: "Line 인터페이스 속도",
  line_ports: "Line 포트 수",
};
