import { useEffect, useRef, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import TextFilter from "@cloudscape-design/components/text-filter";
import {
  api,
  copy,
  fmt,
  money,
  memoryUsed,
  diskUsed,
  planFor,
  uid,
  type Plan,
  type Asset,
  type Project,
  type OptimizationRequest,
  type OptimizationResult,
  type OptimizationScenario,
} from "./domain";
import { AssetEditor } from "./AssetEditor";
import { assessmentFields } from "./references";
import { signature } from "./migrationState";
import { Choice, Empty, Field, Metric, PageHeading } from "./ui";
const REFERENCE =
  "https://docs.aws.amazon.com/compute-optimizer/latest/ug/rightsizing-preferences.html";
const EBS_REFERENCE =
  "https://docs.aws.amazon.com/ebs/latest/userguide/ebs-modify-volume.html";
export function AssetDetail({
  asset,
  environment,
  project,
  update,
  navigate,
  save,
  optimizationOnly = false,
}: {
  asset?: Asset;
  environment: "onprem" | "aws";
  project: Project;
  update: (p: Project) => void;
  navigate: (p: string, id?: string) => void;
  save: (s: OptimizationScenario) => void;
  optimizationOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const aws = environment === "aws";
  if (!asset)
    return (
      <Empty
        title="자산을 찾을 수 없습니다"
        action={
          <Button onClick={() => navigate(aws ? "aws-assets" : "assets")}>
            자산 목록으로
          </Button>
        }
      >
        삭제되었거나 다른 프로젝트의 주소입니다.
      </Empty>
    );
  const related = (project.optimizations ?? []).filter(
    (s) =>
      s.request.environment === environment && s.request.asset.id === asset.id,
  );
  const overview = (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">현재 할당 사양과 사용량</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          <Metric
            label={aws ? "할당 vCPU" : "할당 논리 CPU"}
            value={asset.vcpu}
            note={`피크 사용률 ${fmt(asset.peak_cpu_percent)}%`}
          />
          <Metric
            label="할당 메모리"
            value={asset.memory_gib}
            unit="GiB"
            note={`피크 ${fmt(memoryUsed(asset))} GiB${asset.memory_usage_mode === "percent" ? ` · ${asset.peak_memory_percent}%` : ""}`}
          />
          <Metric
            label="할당 디스크"
            value={fmt(asset.disk_allocated_gib)}
            unit="GiB"
            note={`사용 ${fmt(diskUsed(asset))} GiB${asset.disk_usage_mode === "percent" ? ` · ${asset.disk_used_percent}%` : ""}`}
          />
        </ColumnLayout>
      </Container>
      <Container header={<Header variant="h2">측정과 자산 정보</Header>}>
        <div className="report-facts">
          {[
            ["서버 이름", asset.name],
            ["역할", asset.role],
            ["운영체제", `${asset.os} · ${asset.os_version || "버전 미입력"}`],
            ["아키텍처", asset.architecture],
            ["측정 기준일", asset.observed_on],
            ["측정·사양 근거", asset.source || "미입력"],
            ["현재 EC2", asset.instance_type || "해당 없음"],
            [
              "지속 IOPS / 처리량",
              `${fmt(asset.iops)} / ${fmt(asset.throughput_mibps)} MiB/s`,
            ],
            ...Object.entries(assessmentFields).map(([k, label]) => [
              label,
              asset[k as keyof Asset] || "미입력",
            ]),
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Container>
      <Container
        header={
          <Header variant="h2" counter={`(${related.length})`}>
            이 자산의 저장 최적화안
          </Header>
        }
      >
        <Table
          variant="embedded"
          items={related}
          columnDefinitions={[
            { id: "name", header: "시나리오", cell: (s) => s.name },
            {
              id: "cpu",
              header: "필요 CPU",
              cell: (s) => s.result.requirements?.vcpu.minimum,
            },
            {
              id: "mem",
              header: "필요 메모리",
              cell: (s) => `${s.result.requirements?.memory_gib.minimum} GiB`,
            },
            {
              id: "date",
              header: "저장 시각",
              cell: (s) => new Date(s.savedAt).toLocaleString("ko-KR"),
            },
          ]}
          empty={
            <Empty title="저장된 최적화안이 없습니다">
              사용량과 가정을 입력해 첫 시나리오를 만드세요.
            </Empty>
          }
        />
        <Button
          onClick={() =>
            navigate(aws ? "aws-optimization-scenarios" : "onprem-scenarios")
          }
        >
          시나리오 목록·비교
        </Button>
      </Container>
    </SpaceBetween>
  );
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow={`${aws ? "AWS" : "ON-PREM"} · ${optimizationOnly ? "OPTIMIZATION" : "ASSET DETAIL"}`}
        title={asset.name}
        description={
          optimizationOnly
            ? "현재 운영 사양과 실제 사용률을 바탕으로 EC2·gp3 변경 후보를 검토합니다."
            : "프로젝트에 등록한 원본 사양입니다. 저장된 산정안은 당시 입력을 독립적으로 보존합니다."
        }
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              onClick={() =>
                navigate(
                  optimizationOnly
                    ? "aws-optimize"
                    : aws
                      ? "aws-assets"
                      : "assets",
                )
              }
            >
              목록으로
            </Button>
            <Button onClick={() => setEditing(true)}>자산 수정</Button>
            {!aws && (
              <Button onClick={() => navigate("migration-detail", asset.id)}>
                AWS 마이그레이션
              </Button>
            )}
            {aws && !optimizationOnly && (
              <Button
                variant="primary"
                onClick={() => navigate("aws-optimize-detail", asset.id)}
              >
                사용률 기반 최적화
              </Button>
            )}
          </SpaceBetween>
        }
      />
      {optimizationOnly ? (
        <OptimizationPanel
          asset={asset}
          environment={environment}
          save={save}
        />
      ) : (
        <Tabs
          tabs={[
            { id: "overview", label: "자산 개요", content: overview },
            ...(!aws
              ? [
                  {
                    id: "optimize",
                    label: "실사용 최적화",
                    content: (
                      <OptimizationPanel
                        asset={asset}
                        environment={environment}
                        save={save}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {editing && (
        <AssetEditor
          asset={asset}
          isExisting
          aws={aws}
          onDismiss={() => setEditing(false)}
          onSave={(a) => {
            update({
              ...project,
              [aws ? "awsAssets" : "assets"]: (aws
                ? (project.awsAssets ?? [])
                : project.assets
              ).map((x) => (x.id === a.id ? a : x)),
            });
            setEditing(false);
          }}
        />
      )}
    </SpaceBetween>
  );
}
const fields = [
  ["growth_percent", "연간 성장률", "%"],
  ["years", "산정 기간", "년"],
  ["cpu_target_percent", "CPU 목표 사용률", "%"],
  ["memory_target_percent", "메모리 목표 사용률", "%"],
  ["fixed_memory_gib", "고정 메모리", "GiB"],
  ["storage_growth_percent", "디스크 성장률", "%"],
  ["storage_reserve_percent", "디스크 여유율", "%"],
] as const;
export function OptimizationPanel({
  asset,
  environment,
  save,
}: {
  asset: Asset;
  environment: "onprem" | "aws";
  save: (s: OptimizationScenario) => void;
}) {
  const [plan, setPlan] = useState<Plan>(() => ({
    ...planFor(asset),
    basis: "사용률 기반 최적화 가정 · 검토 필요",
  }));
  const [name, setName] = useState(`${asset.name} · 사용률 최적화`);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [calculated, setCalculated] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const request: OptimizationRequest = {
    schema_version: 1,
    asset: copy(asset),
    environment,
    plan,
  };
  const stamp = signature(request);
  const current = calculated === stamp;
  async function calculate() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setReviewed(false);
    try {
      const r = await api<OptimizationResult>(
        "/api/optimize",
        request,
        c.signal,
      );
      if (!c.signal.aborted) {
        setResult(r);
        setCalculated(stamp);
      }
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const aws = environment === "aws";
  return (
    <SpaceBetween size="l">
      <Alert type="info">
        {aws
          ? "EC2 1대 + gp3 1개 기준입니다. 현재 자산의 사용량과 측정 구간을 확인한 뒤 조건을 입력하세요."
          : "현재 서버와 같은 CPU 성능을 전제로 필요한 논리 CPU·메모리·디스크를 계산합니다. TTA 업무 요구량 산정과 별도 모델입니다."}{" "}
        목표 사용률·성장률은 사용자가 검토하는 가정입니다.
      </Alert>
      <Container header={<Header variant="h2">최적화 조건</Header>}>
        <SpaceBetween size="m">
          <div className="form-grid">
            {fields.map(([k, label, unit]) => (
              <Field
                key={k}
                label={label}
                unit={unit}
                value={String(plan[k])}
                onChange={(v) => {
                  setPlan({ ...plan, [k]: v });
                  setReviewed(false);
                }}
              />
            ))}
            {aws && (
              <>
                <Field
                  label="월 사용시간"
                  unit="시간"
                  value={String(plan.hours_per_month)}
                  onChange={(v) => setPlan({ ...plan, hours_per_month: v })}
                />
                <Choice
                  label="후보 패밀리"
                  value={String(plan.family)}
                  options={[
                    { value: "all", label: "전체" },
                    { value: "C", label: "C · 컴퓨팅" },
                    { value: "M", label: "M · 범용" },
                    { value: "R", label: "R · 메모리" },
                  ]}
                  onChange={(v) => setPlan({ ...plan, family: v })}
                />
              </>
            )}
          </div>
          <Field
            label="설계 가정과 검토 근거"
            value={String(plan.basis)}
            onChange={(v) => setPlan({ ...plan, basis: v })}
          />
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void calculate()}
          >
            최적화 제안 계산
          </Button>
        </SpaceBetween>
      </Container>
      {error && <Alert type="error">{error}</Alert>}
      {result && !current && (
        <Alert type="warning">
          입력 또는 자산이 변경되었습니다. 다시 계산한 뒤 저장하세요.
        </Alert>
      )}
      {result && current && result.errors.length > 0 && (
        <Alert type="error" header="입력을 확인하세요">
          {result.errors.map((e, i) => (
            <div key={i}>
              {e.field}: {e.message}
            </div>
          ))}
        </Alert>
      )}
      {result && current && result.requirements && (
        <>
          <OptimizationResultView request={request} result={result} />
          <Container header={<Header variant="h2">시나리오 저장</Header>}>
            <SpaceBetween size="m">
              <Field
                label="최적화 시나리오 이름"
                value={name}
                onChange={setName}
              />
              <Checkbox
                checked={reviewed}
                onChange={(e) => setReviewed(e.detail.checked)}
              >
                측정값·가정·후보와 적용 전 검증 항목을 검토했습니다.
              </Checkbox>
              <Button
                variant="primary"
                disabled={
                  result.status !== "complete" ||
                  !reviewed ||
                  !name.trim() ||
                  name.length > 200
                }
                onClick={() =>
                  save({
                    id: uid(),
                    name: name.trim(),
                    savedAt: new Date().toISOString(),
                    request: copy(request),
                    result: copy(result),
                  })
                }
              >
                최적화 시나리오 저장
              </Button>
            </SpaceBetween>
          </Container>
        </>
      )}
      <Link external href={REFERENCE}>
        AWS 공식 사용률·측정 기간·여유 용량 검토 지침
      </Link>
    </SpaceBetween>
  );
}
export function OptimizationResultView({
  request,
  result,
}: {
  request: OptimizationRequest;
  result: OptimizationResult;
}) {
  const req = result.requirements!;
  const candidate = result.migration?.candidates?.[0];
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">필요 용량과 현재 할당량</Header>}>
        <Table
          variant="embedded"
          items={[
            {
              name: request.environment === "aws" ? "vCPU" : "논리 CPU",
              current: request.asset.vcpu,
              value: req.vcpu,
              unit: "개",
            },
            {
              name: "메모리",
              current: request.asset.memory_gib,
              value: req.memory_gib,
              unit: "GiB",
            },
            {
              name: "디스크",
              current: request.asset.disk_allocated_gib ?? "",
              value: req.disk_gib,
              unit: "GiB",
            },
          ]}
          columnDefinitions={[
            { id: "name", header: "자원", cell: (r) => r.name },
            {
              id: "current",
              header: "현재 할당",
              cell: (r) => `${fmt(r.current)} ${r.unit}`,
            },
            {
              id: "required",
              header: "계산 요구량",
              cell: (r) => `${fmt(r.value.value)} ${r.unit}`,
            },
            {
              id: "rounded",
              header: "올림한 최소량",
              cell: (r) => `${r.value.minimum} ${r.unit}`,
            },
            {
              id: "direction",
              header: "용량 검토",
              cell: (r) =>
                !r.current
                  ? "할당량 확인 필요"
                  : r.value.minimum < Number(r.current)
                    ? "축소 검토"
                    : r.value.minimum > Number(r.current)
                      ? "증설 검토"
                      : "유지",
            },
          ]}
        />
      </Container>
      {request.environment === "aws" && (
        <Container header={<Header variant="h2">AWS 최적화 제안</Header>}>
          <SpaceBetween size="m">
            {candidate ? (
              <>
                <ColumnLayout columns={3} variant="text-grid">
                  <Metric
                    label="현재 EC2"
                    value={request.asset.instance_type || "미입력"}
                    note={money(result.baseline_cost?.total_monthly)}
                  />
                  <Metric
                    label="조건을 충족하는 후보"
                    value={candidate.instance_type}
                    note={`${candidate.vcpu} vCPU · ${candidate.memory_gib} GiB · gp3 ${result.migration?.storage?.size_gib} GiB`}
                  />
                  <Metric
                    label="월 예상 비용 차이"
                    value={
                      result.monthly_difference == null
                        ? "계산 불가"
                        : money(result.monthly_difference)
                    }
                    note="현재 − 제안 · 양수는 감소, 음수는 증가"
                  />
                </ColumnLayout>
                <p>
                  제안 월 비용 {money(candidate.cost.total_monthly)} · EC2
                  On-Demand + gp3만 포함. 현재와 동일한 월 사용시간으로
                  비교합니다.
                </p>
                <Link external href={candidate.spec_url}>
                  후보 공식 사양
                </Link>
              </>
            ) : (
              <Alert type="warning">
                현재 카탈로그에서 조건을 충족하는 후보가 없습니다.
                I/O·네트워크·메모리 요구량을 확인하세요.
              </Alert>
            )}
            <Link external href={EBS_REFERENCE}>
              EBS 볼륨 변경 제약 · 축소 시 새 볼륨으로 이동 필요
            </Link>
          </SpaceBetween>
        </Container>
      )}
      <Container header={<Header variant="h2">계산 근거</Header>}>
        <Table
          variant="embedded"
          items={result.trace ?? []}
          columnDefinitions={[
            { id: "name", header: "항목", cell: (r) => r.name },
            { id: "formula", header: "수식", cell: (r) => r.expression },
            {
              id: "value",
              header: "결과",
              cell: (r) => `${r.value} ${r.unit}`,
            },
          ]}
        />
      </Container>
      <Alert type="info" header="적용 전 검토">
        {result.warnings?.map((w) => (
          <p key={w}>{w}</p>
        ))}
      </Alert>
    </SpaceBetween>
  );
}
export function OptimizationList({
  project,
  navigate,
}: {
  project: Project;
  navigate: (p: string, id?: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const assets = project.awsAssets ?? [];
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="AWS · OPTIMIZATION"
        title="사용률 기반 최적화"
        description="AWS 자산별 사용량을 검토하고 적정 EC2·gp3 용량과 예상 비용 차이를 계산하세요."
        actions={
          <Button onClick={() => navigate("aws-assets")}>AWS 자산 관리</Button>
        }
      />
      <Table
        trackBy="id"
        items={assets.filter((a) =>
          `${a.name} ${a.instance_type}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        )}
        header={
          <Header variant="h2" counter={`(${assets.length})`}>
            최적화 대상
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            onChange={(e) => setFilter(e.detail.filteringText)}
            filteringAriaLabel="AWS 최적화 자산 검색"
            filteringPlaceholder="이름·EC2 유형 검색"
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: "AWS 자산",
            cell: (a) => (
              <Button
                variant="inline-link"
                onClick={() => navigate("aws-optimize-detail", a.id)}
              >
                {a.name}
              </Button>
            ),
          },
          { id: "instance", header: "현재 EC2", cell: (a) => a.instance_type },
          {
            id: "cpu",
            header: "CPU 피크",
            cell: (a) => `${fmt(a.peak_cpu_percent)}%`,
          },
          {
            id: "mem",
            header: "메모리 피크",
            cell: (a) => `${fmt(memoryUsed(a))} GiB`,
          },
          {
            id: "disk",
            header: "디스크 사용 / 할당",
            cell: (a) =>
              `${fmt(diskUsed(a))} / ${fmt(a.disk_allocated_gib)} GiB`,
          },
          {
            id: "ready",
            header: "측정 상태",
            cell: (a) =>
              a.source && a.peak_cpu_percent && memoryUsed(a)
                ? "검토 가능"
                : "측정 입력 필요",
          },
        ]}
        empty={
          <Empty
            title="AWS 자산을 먼저 등록하세요"
            action={
              <Button onClick={() => navigate("aws-assets")}>
                AWS 자산 등록
              </Button>
            }
          >
            현재 운영하는 EC2를 등록합니다. 마이그레이션 후보는 실제 운영 자산과
            구분합니다.
          </Empty>
        }
      />
      <Link external href={REFERENCE}>
        AWS 공식 Rightsizing 검토 기준
      </Link>
    </SpaceBetween>
  );
}
