import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import {
  api,
  copy,
  fmt,
  money,
  uid,
  type Bootstrap,
  type Candidate,
  type MigrationResult,
  type Project,
  type Scenario,
} from "./domain";
import {
  calculatedDraft,
  compactResult,
  draftStatus,
  putDraft,
  requestFor,
  signature,
} from "./migrationState";
import { DraftBadge } from "./Portfolio";
import { planLabels } from "./Migration";
import { ASSESSMENT_REFERENCE, assessmentFields } from "./references";
import { Empty, Field, Mapping, Metric, PageHeading } from "./ui";

export function MigrationDetail({
  project,
  assetId,
  bootstrap,
  update,
  back,
  edit,
  save,
  inspect,
}: {
  project: Project;
  assetId: string;
  bootstrap: Bootstrap;
  update: Dispatch<SetStateAction<Project>>;
  back: () => void;
  edit: () => void;
  save: (s: Scenario) => void;
  inspect: (c: Candidate, r: MigrationResult) => void;
}) {
  const asset = project.assets.find((a) => a.id === assetId);
  const draft = project.migrationDrafts?.find((d) => d.assetId === assetId);
  const request = asset ? requestFor(asset, draft) : null;
  const status = asset
    ? draftStatus(asset, draft, bootstrap.catalog.catalog_version)
    : "pending";
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [tab, setTab] = useState("overview");
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState(`${asset?.name ?? ""} 이전안`);
  const abort = useRef<AbortController | null>(null);
  const currentRequest = useRef(request);
  currentRequest.current = request;
  const requestKey = signature(request);
  const latest =
    result && signature(result.input) === requestKey ? result : null;
  const shown =
    latest ??
    (status === "complete" || status === "no_candidates" || status === "invalid"
      ? draft?.result
      : undefined);
  const candidate = shown?.candidates?.find(
    (c) => c.instance_type === draft?.selected,
  );
  async function calculate() {
    if (!request) return;
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setFailure("");
    try {
      const result = await api<MigrationResult>(
        "/api/migrate",
        request,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        signature(currentRequest.current) !== signature(request)
      )
        return;
      setResult(result);
      update((p) =>
        p.id === project.id
          ? putDraft(p, calculatedDraft(request, result, draft?.selected))
          : p,
      );
    } catch (e) {
      if (!controller.signal.aborted) setFailure((e as Error).message);
    } finally {
      if (abort.current === controller && !controller.signal.aborted)
        setBusy(false);
    }
  }
  // Compact persisted drafts have only one candidate. Obtain all candidates on entry.
  useEffect(() => {
    if (status === "complete" || status === "no_candidates") void calculate();
    return () => abort.current?.abort();
  }, [project.id, assetId]);
  if (!asset || !request)
    return (
      <Container>
        <Empty
          title="이 자산을 찾을 수 없습니다"
          action={<Button onClick={back}>이전 대상 목록</Button>}
        >
          삭제되었거나 다른 프로젝트의 자산 주소입니다.
        </Empty>
      </Container>
    );
  const labels: Partial<Record<keyof typeof asset, string>> = {
    ...assessmentFields,
    id: "자산 ID",
    name: "서버 이름",
    role: "역할",
    hardware: "장비·가상화 정보",
    os: "운영체제",
    architecture: "아키텍처",
    vcpu: "할당 논리 CPU (개)",
    memory_gib: "할당 메모리 (GiB)",
    disk_gib: "디스크 사용량 입력 (GiB, 사용량 방식)",
    disk_allocated_gib: "논리 디스크 할당량 (GiB)",
    disk_usage_mode: "디스크 입력 방식",
    disk_used_percent: "디스크 사용률 (%)",
    memory_usage_mode: "메모리 입력 방식",
    peak_memory_percent: "메모리 사용률 (%)",
    peak_cpu_percent: "CPU 피크 사용률 (%)",
    peak_memory_gib: "메모리 피크 사용량 (GiB)",
    iops: "지속 IOPS",
    throughput_mibps: "지속 처리량 (MiB/s)",
    network_gbps: "지속 네트워크 (Gbps)",
    source: "측정·입력 근거",
    observed_on: "측정 기준일",
  };
  const sourceTable = (
    <Table
      variant="embedded"
      items={Object.entries(labels)}
      columnDefinitions={[
        { id: "field", header: "항목", cell: ([, label]) => label },
        {
          id: "value",
          header: "현재 On-Prem 값",
          cell: ([key]) => asset[key as keyof typeof asset] || "미입력",
        },
      ]}
    />
  );
  return (
    <SpaceBetween size="l">
      <Button iconName="angle-left" onClick={back}>
        이전 대상 목록
      </Button>
      <PageHeading
        eyebrow="AWS MIGRATION · RESOURCE DETAIL"
        title={asset.name}
        description={`${asset.role} · ${asset.os} · ${asset.id}`}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={edit}>이전 조건 편집</Button>
            <Button loading={busy} onClick={() => void calculate()}>
              이 자산 재산정
            </Button>
            <Button
              variant="primary"
              disabled={busy || !candidate || !latest}
              onClick={() => {
                setConfirmed(false);
                setReview(true);
              }}
            >
              검토 후 저장
            </Button>
          </SpaceBetween>
        }
      />
      <DraftBadge status={status} />
      {failure && (
        <Alert type="error">
          {failure} 현재 후보 전체를 확인하지 못했습니다. 다시 산정하세요.
        </Alert>
      )}
      {draft?.failure && <Alert type="error">{draft.failure}</Alert>}
      {status === "stale" && (
        <Alert type="warning">
          원본 사양·이전 조건 또는 카탈로그가 바뀌었습니다. 과거 결과는 목록
          소계에서 제외됩니다. 최신 조건으로 다시 산정하세요.
        </Alert>
      )}
      {status === "pending" && (
        <Alert>
          아직 산정하지 않은 자산입니다. 이전 조건을 검토하거나 기본 조건으로
          산정하세요.
        </Alert>
      )}
      {shown?.errors?.length ? (
        <Alert type="warning" header="이 자산의 입력을 확인하세요">
          <ul>
            {shown.errors.map((e, i) => (
              <li key={i}>
                {planLabels[e.field.replace("plan.", "")] ?? e.field}:{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <Tabs
        activeTabId={tab}
        onChange={(e) => setTab(e.detail.activeTabId)}
        tabs={[
          {
            id: "overview",
            label: "이전 요약",
            content: (
              <SpaceBetween size="l">
                <Container
                  header={<Header variant="h2">원본과 AWS 구성</Header>}
                >
                  <Mapping asset={asset} candidate={candidate} result={shown} />
                </Container>
                <Container>
                  <ColumnLayout columns={4} variant="text-grid">
                    <Metric
                      label="요구 vCPU / 노드"
                      value={fmt(shown?.requirements?.vcpu.value)}
                    />
                    <Metric
                      label="요구 메모리 / 노드"
                      value={fmt(shown?.requirements?.memory_gib.value)}
                      unit="GiB"
                    />
                    <Metric
                      label="gp3 / 노드"
                      value={fmt(shown?.storage?.size_gib)}
                      unit="GiB"
                    />
                    <Metric
                      label="EC2 + EBS 월 비용"
                      value={money(candidate?.cost.total_monthly)}
                      note="전체 노드 포함 · USD · 부분 비용"
                    />
                  </ColumnLayout>
                </Container>
                <Alert>
                  현재 후보는 입력 조건을 충족하는 계산 초안입니다.
                  상대성능·소프트웨어 호환성·장애 시 분산 처리와 실제 부하를
                  검토한 뒤 이전안으로 저장하세요.
                </Alert>
                <Container
                  header={<Header variant="h2">견적 전 확인할 정보</Header>}
                >
                  <p>
                    자산 유형(물리 서버·가상 서버·하이퍼바이저 등), 애플리케이션
                    연결, OS·제품 버전, 라이선스, 의존성, 복구 요구사항,
                    네트워크 사용량과 이전 작업 범위를 확인하세요. 현재
                    사양·사용량만으로 이 항목들이 확인된 것으로 판단하지
                    않습니다.
                  </p>
                  <Link external href={ASSESSMENT_REFERENCE.url}>
                    {ASSESSMENT_REFERENCE.title}
                  </Link>
                  <Box fontSize="body-s">
                    이 항목은 AWS 평가 지침을 바탕으로 한 검토 범위입니다. 특정
                    사업자·조직에 한정된 플랫폼 분류를 사용하지 않습니다.
                  </Box>
                </Container>
                <Box color="text-body-secondary">
                  최근 산정{" "}
                  {draft?.calculatedAt
                    ? new Date(draft.calculatedAt).toLocaleString("ko-KR")
                    : "없음"}{" "}
                  · 사양 확인 {bootstrap.catalog.verified_on} ·
                  세금·전송·백업·추가 라이선스·이관 인건비 제외
                </Box>
              </SpaceBetween>
            ),
          },
          {
            id: "source",
            label: "원본 사양",
            content: (
              <Container
                header={
                  <Header variant="h2">현재 서버 사양과 측정 근거</Header>
                }
              >
                {sourceTable}
              </Container>
            ),
          },
          {
            id: "conditions",
            label: "이전 조건",
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={<Button onClick={edit}>조건 수정</Button>}
                  >
                    자산별 산정 조건
                  </Header>
                }
              >
                <Table
                  variant="embedded"
                  items={Object.entries(request.plan)}
                  columnDefinitions={[
                    {
                      id: "key",
                      header: "항목",
                      cell: ([key]) => planLabels[key] ?? key,
                    },
                    {
                      id: "value",
                      header: "설정",
                      cell: ([, value]) =>
                        typeof value === "boolean"
                          ? value
                            ? "확인함"
                            : "미확인"
                          : ({
                              measured: "실측 사용량",
                              direct: "확정 사양",
                              all: "전체",
                            }[value] ?? value),
                    },
                  ]}
                />
              </Container>
            ),
          },
          {
            id: "candidates",
            label: "EC2 후보",
            content: (
              <SpaceBetween size="m">
                {!latest && (
                  <Alert>후보 전체를 보려면 이 자산을 다시 산정하세요.</Alert>
                )}
                <Table
                  items={latest?.candidates ?? []}
                  loading={busy}
                  loadingText="후보 조회 중"
                  wrapLines
                  selectionType="single"
                  trackBy="instance_type"
                  selectedItems={candidate && latest ? [candidate] : []}
                  onSelectionChange={(e) => {
                    const c = e.detail.selectedItems[0];
                    if (c && latest)
                      update((p) =>
                        putDraft(
                          p,
                          calculatedDraft(request, latest, c.instance_type),
                        ),
                      );
                  }}
                  ariaLabels={{
                    selectionGroupLabel: "상세 EC2 후보 선택",
                    itemSelectionLabel: (_, c) => `${c.instance_type} 선택`,
                  }}
                  header={
                    <Header
                      variant="h2"
                      counter={`(${latest?.candidates?.length ?? 0})`}
                      description="기존 선택이 현재 조건을 충족하면 재산정 후에도 유지합니다."
                    >
                      조건을 충족하는 후보
                    </Header>
                  }
                  columnDefinitions={[
                    {
                      id: "name",
                      header: "인스턴스",
                      cell: (c) => (
                        <Button
                          variant="inline-link"
                          onClick={() => latest && inspect(c, latest)}
                        >
                          {c.instance_type}
                        </Button>
                      ),
                    },
                    {
                      id: "spec",
                      header: "사양 / 노드",
                      cell: (c) => `${c.vcpu} vCPU / ${c.memory_gib} GiB`,
                    },
                    {
                      id: "network",
                      header: "지속 네트워크",
                      cell: (c) => `${c.network_baseline_gbps} Gbps`,
                    },
                    {
                      id: "cost",
                      header: "월 비용 (전체 노드)",
                      cell: (c) => money(c.cost.total_monthly),
                    },
                  ]}
                  empty={
                    <Box>
                      조건을 충족하는 후보가 없습니다. 요구량과 대상 패밀리를
                      확인하세요.
                    </Box>
                  }
                />
              </SpaceBetween>
            ),
          },
          {
            id: "evidence",
            label: "계산 근거",
            content: (
              <SpaceBetween size="m">
                {shown?.warnings?.map((w, i) => (
                  <Alert key={i} type="warning">
                    {w}
                  </Alert>
                ))}
                <Table
                  header={<Header variant="h2">결정론적 계산 내역</Header>}
                  items={shown?.trace ?? []}
                  wrapLines
                  columnDefinitions={[
                    { id: "name", header: "단계", cell: (r) => r.name },
                    {
                      id: "expression",
                      header: "계산식",
                      cell: (r) => <code>{r.expression}</code>,
                    },
                    {
                      id: "value",
                      header: "결과",
                      cell: (r) => `${r.value} ${r.unit}`,
                    },
                  ]}
                  empty={<Box>산정 후 입력과 계산식이 표시됩니다.</Box>}
                />
                {candidate && (
                  <SpaceBetween size="s">
                    <Link external href={candidate.spec_url}>
                      AWS 공식 인스턴스 사양
                    </Link>
                    {candidate.cost.hourly_price && (
                      <Link
                        external
                        href={candidate.cost.hourly_price.source_url}
                      >
                        AWS 공식 가격표 ·{" "}
                        {candidate.cost.hourly_price.effective_date}
                      </Link>
                    )}
                  </SpaceBetween>
                )}
                <Table
                  header={<Header variant="h2">제외된 후보와 사유</Header>}
                  items={latest?.rejected ?? []}
                  wrapLines
                  columnDefinitions={[
                    {
                      id: "name",
                      header: "인스턴스",
                      cell: (r) => r.instance_type,
                    },
                    {
                      id: "reason",
                      header: "제외 사유",
                      cell: (r) => r.reasons.join(" · "),
                    },
                  ]}
                  empty={<Box>재산정 후 제외 사유를 확인할 수 있습니다.</Box>}
                />
              </SpaceBetween>
            ),
          },
        ]}
      />
      <Modal
        visible={review}
        onDismiss={() => setReview(false)}
        header="검토한 이전안 저장"
        closeAriaLabel="검토 창 닫기"
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button onClick={() => setReview(false)}>취소</Button>
            <Button
              variant="primary"
              disabled={
                !confirmed ||
                !name.trim() ||
                name.length > 200 ||
                !candidate ||
                !latest ||
                busy
              }
              onClick={() => {
                if (!candidate || !latest) return;
                save({
                  id: uid(),
                  name: name.trim(),
                  savedAt: new Date().toISOString(),
                  request: copy(request),
                  result: compactResult(latest, candidate.instance_type),
                  selected: candidate.instance_type,
                });
                setReview(false);
              }}
            >
              이전안 저장
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Field label="이전안 이름" value={name} onChange={setName} />
          <Box>
            {candidate?.instance_type} · {money(candidate?.cost.total_monthly)}{" "}
            / 월
          </Box>
          <Checkbox
            checked={confirmed}
            onChange={(e) => setConfirmed(e.detail.checked)}
          >
            입력 근거와 상대성능 가정·호환성·비용 제외 범위를 검토했습니다.
          </Checkbox>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
