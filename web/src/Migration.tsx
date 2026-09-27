import { useEffect, useRef, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Wizard from "@cloudscape-design/components/wizard";
import {
  api,
  copy,
  fmt,
  money,
  planFor,
  uid,
  type Asset,
  type Bootstrap,
  type Candidate,
  type MigrationRequest,
  type MigrationResult,
  type Plan,
  type Scenario,
} from "./domain";
import {
  Choice,
  Empty,
  Field,
  Mapping,
  Metric,
  PageHeading,
  SourceLink,
} from "./ui";

export const planLabels: Record<string, string> = {
  mode: "산정 경로",
  region: "리전",
  architecture: "대상 아키텍처",
  os: "운영체제",
  family: "패밀리",
  target_nodes: "배포 노드 수",
  tolerated_failures: "동시 장애 허용 수",
  distribution_verified: "분할 처리 검증",
  arm_verified: "ARM 호환성 검증",
  basis: "이전안 근거",
  hours_per_month: "EC2 월 가동 시간",
  growth_percent: "연간 성장률 (%)",
  years: "목표 기간 (년)",
  cpu_target_percent: "목표 CPU 활용률 (%)",
  memory_target_percent: "목표 메모리 활용률 (%)",
  relative_performance: "목표/원본 vCPU 상대성능",
  relative_performance_basis: "상대성능 근거",
  fixed_memory_gib: "노드별 고정 메모리 (GiB)",
  direct_vcpu: "최종 vCPU/노드",
  direct_memory_gib: "최종 GiB/노드",
  storage_growth_percent: "스토리지 성장 증가분 (%)",
  storage_reserve_percent: "스토리지 여유 공간 (%)",
  network_gbps: "네트워크 지속 요구 (Gbps/노드)",
  ebs_iops: "EBS 지속 요구 (IOPS/노드)",
  ebs_throughput_mibps: "EBS 지속 요구 (MiB/s/노드)",
};
const planValue = (value: string | boolean) =>
  typeof value === "boolean"
    ? value
      ? "확인함"
      : "미확인"
    : ({ measured: "실측 사용량", direct: "확정 사양", all: "전체" }[value] ??
      value);

export function Migration({
  assets,
  assetId,
  selectAsset,
  bootstrap,
  initial,
  save,
  inspect,
  cancel,
}: {
  assets: Asset[];
  assetId: string;
  selectAsset: (id: string) => void;
  bootstrap: Bootstrap;
  initial?: Scenario;
  save: (s: Scenario) => void;
  inspect: (c: Candidate, r: MigrationResult) => void;
  cancel: () => void;
}) {
  const asset =
    initial?.request.asset ?? assets.find((a) => a.id === assetId) ?? assets[0];
  const [plan, setPlan] = useState<Plan>(() =>
    initial ? copy(initial.request.plan) : asset ? planFor(asset) : {},
  );
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState(
    initial ? `${initial.name} · 복제` : `${asset?.name ?? ""} 이전안`,
  );
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => abort.current?.abort(), []);
  if (!asset)
    return (
      <Container>
        <Empty
          title="먼저 On-Prem 서버를 등록하세요"
          action={<Button onClick={cancel}>서버 자산으로 이동</Button>}
        >
          현재 사양과 사용량을 기준으로 이전안을 계산합니다.
        </Empty>
      </Container>
    );
  const request: MigrationRequest = {
    schema_version: 1,
    asset: copy(asset),
    plan,
  };
  const candidate = result?.candidates?.find(
    (c) => c.instance_type === selected,
  );
  function change(key: string, value: string | boolean) {
    generation.current += 1;
    abort.current?.abort();
    setBusy(false);
    setPlan((p) => ({ ...p, [key]: value }));
    setResult(null);
    setSelected("");
    setConfirmed(false);
    setFailure("");
  }
  function field(key: string, description?: string) {
    return (
      <Field
        key={key}
        id={`plan-${key}`}
        label={planLabels[key]}
        value={String(plan[key] ?? "")}
        onChange={(v) => change(key, v)}
        description={description}
        error={result?.errors.find((e) => e.field === `plan.${key}`)?.message}
      />
    );
  }
  async function calculate() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++generation.current;
    setBusy(true);
    setFailure("");
    setResult(null);
    setSelected("");
    setConfirmed(false);
    try {
      const r = await api<MigrationResult>(
        "/api/migrate",
        request,
        controller.signal,
      );
      if (id !== generation.current) return;
      setResult(r);
      setSelected(r.candidates?.[0]?.instance_type ?? "");
    } catch (e) {
      if (!controller.signal.aborted) setFailure((e as Error).message);
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  function submit() {
    if (
      !result ||
      !candidate ||
      !confirmed ||
      !name.trim() ||
      name.length > 200 ||
      JSON.stringify(result.input) !== JSON.stringify(request)
    ) {
      setFailure("이름·확인 상태를 확인하고 최신 조건으로 후보를 계산하세요.");
      return;
    }
    save({
      id: uid(),
      name: name.trim(),
      savedAt: new Date().toISOString(),
      request: copy(request),
      result: copy(result),
      selected,
    });
  }
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="MIGRATION STUDIO"
        title="On-Prem → AWS 이전 설계"
        description="원본 사양, 이전 가정, 후보 선택을 하나의 근거로 연결합니다."
      />
      {failure && (
        <Alert type="error" dismissible onDismiss={() => setFailure("")}>
          {failure}
        </Alert>
      )}
      <Wizard
        activeStepIndex={step}
        allowSkipTo={false}
        i18nStrings={{
          stepNumberLabel: (n) => `단계 ${n}`,
          collapsedStepsLabel: (n, total) => `${total}단계 중 ${n}단계`,
          skipToButtonLabel: (s) => `${s.title}으로 이동`,
          navigationAriaLabel: "AWS 이전 설계 단계",
          cancelButton: "취소",
          previousButton: "이전",
          nextButton: step === 1 ? "후보 계산" : "다음",
          submitButton: "이전안 저장",
          optional: "선택 사항",
        }}
        onCancel={cancel}
        onSubmit={submit}
        isLoadingNextStep={busy}
        onNavigate={({ detail }) => {
          if (detail.requestedStepIndex === 3 && !candidate) {
            setFailure("유효한 후보를 먼저 선택하세요.");
            return;
          }
          setStep(detail.requestedStepIndex);
          if (detail.requestedStepIndex === 2) void calculate();
        }}
        steps={[
          {
            title: "원본 서버 확인",
            description: "On-Prem 사양과 측정 근거",
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">이전할 서버</Header>}>
                  <SpaceBetween size="l">
                    <Choice
                      label="On-Prem 서버"
                      value={asset.id}
                      options={assets.map((a) => ({
                        value: a.id,
                        label: `${a.name} · ${a.role}`,
                      }))}
                      onChange={selectAsset}
                    />
                    {initial && (
                      <Box color="text-body-secondary">
                        저장 당시 원본 사양을 복제했습니다. 서버를 다시 선택하면
                        현재 자산 사양으로 새 이전안을 시작합니다.
                      </Box>
                    )}
                    <Mapping asset={asset} />
                    <ColumnLayout columns={3}>
                      <Metric
                        label="CPU 피크 사용률"
                        value={fmt(asset.peak_cpu_percent)}
                        unit="%"
                      />
                      <Metric
                        label="메모리 피크 실사용"
                        value={fmt(asset.peak_memory_gib)}
                        unit="GiB"
                      />
                      <Metric
                        label="논리 디스크 사용량"
                        value={fmt(asset.disk_gib)}
                        unit="GiB"
                      />
                    </ColumnLayout>
                    <div>
                      <Box variant="awsui-key-label">
                        측정·사양 근거 · {asset.observed_on}
                      </Box>
                      <Box>{asset.source || "근거 미입력"}</Box>
                    </div>
                  </SpaceBetween>
                </Container>
                <Alert type="info">
                  현재 서버 한 대를 하나의 워크로드로 계산합니다. 물리 코어를
                  vCPU로 자동 환산하지 않으며, 서버 통합이나 데이터베이스 분할은
                  별도로 검토해야 합니다.
                </Alert>
              </SpaceBetween>
            ),
          },
          {
            title: "이전 조건 설정",
            description: "산정 경로·성장·가용성",
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">산정 경로</Header>}>
                  <RadioGroup
                    ariaLabel="산정 경로"
                    value={String(plan.mode)}
                    onChange={(e) => change("mode", e.detail.value)}
                    items={[
                      {
                        value: "measured",
                        label: "실측 사용량으로 산정",
                        description:
                          "CPU·메모리 피크와 성장·목표 활용률로 노드당 요구량을 계산합니다.",
                      },
                      {
                        value: "direct",
                        label: "확정 사양으로 비교",
                        description:
                          "성장·장애 여유를 포함해 확인한 최종 vCPU·GiB를 후보와 비교합니다.",
                      },
                    ]}
                  />
                </Container>
                <Container header={<Header variant="h2">배포 조건</Header>}>
                  <div className="form-grid">
                    <Choice
                      label="AWS 리전"
                      value={String(plan.region)}
                      options={[
                        {
                          value: "ap-northeast-2",
                          label: "아시아 태평양 (서울) · ap-northeast-2",
                        },
                      ]}
                      onChange={(v) => change("region", v)}
                    />
                    <Choice
                      label="대상 운영체제"
                      value={String(plan.os)}
                      options={["Linux", "Windows"].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      onChange={(v) => change("os", v)}
                    />
                    <Choice
                      label="대상 CPU 아키텍처"
                      value={String(plan.architecture)}
                      options={[
                        { value: "x86_64", label: "x86_64 · Intel" },
                        { value: "arm64", label: "arm64 · AWS Graviton" },
                      ]}
                      onChange={(v) => change("architecture", v)}
                    />
                    <Choice
                      label="인스턴스 패밀리"
                      value={String(plan.family)}
                      options={[
                        { value: "all", label: "전체 C / M / R" },
                        { value: "C", label: "C · 컴퓨팅 최적화" },
                        { value: "M", label: "M · 범용" },
                        { value: "R", label: "R · 메모리 최적화" },
                      ]}
                      onChange={(v) => change("family", v)}
                    />
                    {field("target_nodes")}
                    {field(
                      "tolerated_failures",
                      "장애 후 남는 노드의 용량을 계산합니다. 실제 장애전환 보장은 아닙니다.",
                    )}
                  </div>
                  <div className="field-gap">
                    <Checkbox
                      checked={plan.distribution_verified === true}
                      onChange={(e) =>
                        change("distribution_verified", e.detail.checked)
                      }
                    >
                      노드 간 균등 분할 처리를 검증했습니다.
                    </Checkbox>
                    <Box color="text-body-secondary" fontSize="body-s">
                      미확인 시 각 노드가 전체 부하를 처리하도록 계산합니다.
                      단일 writer DB는 이 상태를 유지하세요.
                    </Box>
                  </div>
                  {plan.architecture === "arm64" && (
                    <div className="field-gap">
                      <Checkbox
                        checked={plan.arm_verified === true}
                        onChange={(e) =>
                          change("arm_verified", e.detail.checked)
                        }
                      >
                        Linux와 바이너리·라이브러리·운영 에이전트의 ARM 호환성을
                        확인했습니다.
                      </Checkbox>
                    </div>
                  )}
                </Container>
                <Container
                  header={
                    <Header variant="h2">
                      {plan.mode === "measured"
                        ? "부하와 성장 가정"
                        : "확정한 노드당 요구량"}
                    </Header>
                  }
                >
                  <SpaceBetween size="l">
                    {plan.mode === "measured" ? (
                      <>
                        <div className="form-grid">
                          {field("growth_percent")}
                          {field("years", "0~10년, 정수 연도")}
                          {field("cpu_target_percent")}
                          {field("memory_target_percent")}
                          {field(
                            "fixed_memory_gib",
                            "원본 피크 메모리에 포함된 OS·런타임 고정분. 대상 노드마다 필요합니다.",
                          )}
                          {field(
                            "relative_performance",
                            "1은 동등 성능을 가정한 값입니다. 실측한 성능비가 있으면 근거와 함께 수정하세요.",
                          )}
                        </div>
                        {field("relative_performance_basis")}
                      </>
                    ) : (
                      <>
                        <div className="form-grid">
                          {field("direct_vcpu")}
                          {field("direct_memory_gib")}
                        </div>
                        <Alert type="info">
                          입력한 최종 요구량에 성장률·목표 활용률·분산 계수를
                          다시 적용하지 않습니다.
                        </Alert>
                      </>
                    )}
                    {field(
                      "basis",
                      "이전 조건을 선택한 이유와 검토 근거를 기록하세요.",
                    )}
                  </SpaceBetween>
                </Container>
                <Container
                  header={<Header variant="h2">스토리지·I/O·가동 시간</Header>}
                >
                  <SpaceBetween size="l">
                    <div className="form-grid">
                      {field(
                        "storage_growth_percent",
                        "목표 시점까지의 전체 증가분. CPU 연간 성장과 별도입니다.",
                      )}
                      {field("storage_reserve_percent")}
                      {field("ebs_iops")}
                      {field("ebs_throughput_mibps")}
                      {field("network_gbps")}
                      {field(
                        "hours_per_month",
                        "컴퓨트 가동 시간. EBS는 정지 중에도 1개월 보관하는 비용입니다.",
                      )}
                    </div>
                    <Box color="text-body-secondary">
                      IOPS·처리량·네트워크는 성장과 장애 상황을 고려한 노드당
                      최종 실부하입니다. 디스크는 {fmt(asset.disk_gib)} GiB를
                      기준으로 각 노드에 논리 볼륨 1개를 구성합니다.
                    </Box>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },
          {
            title: "EC2·EBS 후보 비교",
            description: "사양·지속 성능·예상 비용",
            content: (
              <SpaceBetween size="l">
                {busy && (
                  <Box padding="xl" textAlign="center">
                    <Spinner size="large" />
                    <p>확인한 입력으로 후보를 계산하고 있습니다.</p>
                  </Box>
                )}
                {result?.errors.length ? (
                  <Alert type="error" header="입력 확인이 필요합니다">
                    <ul>
                      {result.errors.map((e, i) => (
                        <li key={i}>
                          {e.field}: {e.message}
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => setStep(1)}>조건 수정</Button>
                  </Alert>
                ) : null}
                {result?.requirements && (
                  <Container
                    header={
                      <Header
                        variant="h2"
                        description="노드당 요구량입니다. 실제 인스턴스 사양은 아래에서 선택합니다."
                      >
                        계산된 요구량
                      </Header>
                    }
                  >
                    <ColumnLayout columns={4} variant="text-grid">
                      <Metric
                        label="CPU"
                        value={fmt(result.requirements.vcpu.value)}
                        unit="vCPU"
                      />
                      <Metric
                        label="메모리"
                        value={fmt(result.requirements.memory_gib.value)}
                        unit="GiB"
                      />
                      <Metric
                        label="gp3 용량"
                        value={fmt(result.storage?.size_gib)}
                        unit="GiB"
                      />
                      <Metric
                        label="장애 후 생존"
                        value={result.requirements.surviving_nodes}
                        unit="노드"
                      />
                    </ColumnLayout>
                  </Container>
                )}
                {result && (
                  <Table
                    items={result.candidates ?? []}
                    trackBy="instance_type"
                    selectionType="single"
                    selectedItems={candidate ? [candidate] : []}
                    onSelectionChange={(e) => {
                      setSelected(
                        e.detail.selectedItems[0]?.instance_type ?? "",
                      );
                      setConfirmed(false);
                    }}
                    ariaLabels={{
                      selectionGroupLabel: "EC2 후보 선택",
                      itemSelectionLabel: (_, c) => `${c.instance_type} 선택`,
                    }}
                    header={
                      <Header
                        variant="h2"
                        counter={`(${result.candidates?.length ?? 0})`}
                        description={result.ranking}
                        actions={
                          <Button
                            onClick={() => void calculate()}
                            disabled={busy}
                            iconName="refresh"
                          >
                            다시 계산
                          </Button>
                        }
                      >
                        조건에 맞는 EC2 후보
                      </Header>
                    }
                    columnDefinitions={[
                      {
                        id: "type",
                        header: "인스턴스",
                        cell: (c) => (
                          <Button
                            variant="inline-link"
                            onClick={() => inspect(c, result)}
                          >
                            {c.instance_type}
                          </Button>
                        ),
                      },
                      { id: "cpu", header: "vCPU", cell: (c) => c.vcpu },
                      {
                        id: "ram",
                        header: "메모리",
                        cell: (c) => `${fmt(c.memory_gib)} GiB`,
                      },
                      {
                        id: "network",
                        header: "지속 네트워크",
                        cell: (c) => `${c.network_baseline_gbps} Gbps`,
                      },
                      {
                        id: "ebs",
                        header: "지속 EBS",
                        cell: (c) => (
                          <>
                            {fmt(c.ebs_baseline_iops)} IOPS
                            <div className="secondary">
                              {fmt(c.ebs_baseline_MBps)} MB/s
                            </div>
                          </>
                        ),
                      },
                      {
                        id: "cost",
                        header: "EC2 + EBS / 월",
                        cell: (c) => (
                          <strong>{money(c.cost.total_monthly)}</strong>
                        ),
                      },
                    ]}
                    empty={
                      <Empty
                        title="현재 조건에 맞는 후보가 없습니다"
                        action={
                          <Button onClick={() => setStep(1)}>조건 검토</Button>
                        }
                      >
                        36개 C/M/R 카탈로그의 CPU·메모리·지속 I/O 또는 gp3
                        범위를 확인하세요. 기준을 완화해 임의 후보를 추천하지
                        않습니다.
                      </Empty>
                    }
                  />
                )}
                {candidate && result && (
                  <Container header={<Header variant="h2">선택한 구성</Header>}>
                    <Mapping
                      asset={asset}
                      candidate={candidate}
                      result={result}
                    />
                  </Container>
                )}
                {result?.trace && (
                  <ExpandableSection headerText="계산 과정과 근거 보기">
                    <Table
                      items={result.trace}
                      columnDefinitions={[
                        { id: "n", header: "계산 항목", cell: (t) => t.name },
                        {
                          id: "e",
                          header: "계산식",
                          cell: (t) => t.expression,
                        },
                        {
                          id: "v",
                          header: "결과",
                          cell: (t) => `${t.value} ${t.unit}`,
                        },
                      ]}
                      variant="embedded"
                    />
                    <Box padding={{ top: "s" }}>
                      <SourceLink id="xlsx-d6bfd84a3ce8">
                        워크북 · AWS EC2!B39:B42, B55:B70
                      </SourceLink>
                    </Box>
                  </ExpandableSection>
                )}
                {result?.warnings && (
                  <Alert type="info" header="계산에 포함된 가정과 검토 범위">
                    <ul>
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                    <Box fontSize="body-s">
                      공식 사양 확인 {bootstrap.catalog.verified_on} · 가격표{" "}
                      {bootstrap.catalog.price_publication_date.slice(0, 10)} ·
                      서울 / Shared / On-Demand
                    </Box>
                  </Alert>
                )}
              </SpaceBetween>
            ),
          },
          {
            title: "검토 후 저장",
            description: "이전안·근거·산정서",
            content:
              candidate && result ? (
                <SpaceBetween size="l">
                  <Container header={<Header variant="h2">이전안 요약</Header>}>
                    <SpaceBetween size="l">
                      <Field
                        label="이전안 이름"
                        value={name}
                        onChange={setName}
                      />
                      <Mapping
                        asset={asset}
                        candidate={candidate}
                        result={result}
                      />
                      <ColumnLayout columns={3} variant="text-grid">
                        <Metric
                          label="EC2 월 컴퓨트"
                          value={money(candidate.cost.compute_monthly)}
                        />
                        <Metric
                          label="EBS 월 보관"
                          value={money(candidate.cost.ebs_monthly)}
                        />
                        <Metric
                          label="월 예상 소계"
                          value={money(candidate.cost.total_monthly)}
                          note="USD · 세금 및 제외 비용 별도"
                        />
                      </ColumnLayout>
                      <Box color="text-body-secondary">
                        제외: {candidate.cost.excluded.join(", ")}. 전체 TCO
                        또는 실제 청구액이 아닙니다.
                      </Box>
                    </SpaceBetween>
                  </Container>
                  <ExpandableSection
                    defaultExpanded
                    headerText="입력한 가정 확인"
                  >
                    <Table
                      variant="embedded"
                      items={Object.entries(plan).filter(
                        ([key]) =>
                          !["direct_vcpu", "direct_memory_gib"].includes(key) ||
                          plan.mode === "direct",
                      )}
                      columnDefinitions={[
                        {
                          id: "key",
                          header: "가정",
                          cell: ([key]) => planLabels[key] ?? key,
                        },
                        {
                          id: "v",
                          header: "입력값",
                          cell: ([, val]) => planValue(val),
                        },
                      ]}
                    />
                  </ExpandableSection>
                  <Checkbox
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.detail.checked)}
                  >
                    입력 근거와 상대성능·분산·비용 범위를 검토했습니다. 이
                    결과를 이전 설계 초안으로 저장합니다.
                  </Checkbox>
                  <Box color="text-body-secondary">
                    저장 후 AWS 이전안 목록에서 비교·JSON 내보내기·산정서 인쇄를
                    할 수 있습니다.
                  </Box>
                </SpaceBetween>
              ) : (
                <Alert type="warning">먼저 유효한 후보를 선택하세요.</Alert>
              ),
          },
        ]}
      />
    </SpaceBetween>
  );
}
