import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import ProgressBar from "@cloudscape-design/components/progress-bar";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import {
  api,
  download,
  fmt,
  money,
  sum,
  type Asset,
  type Bootstrap,
  type MigrationDraft,
  type MigrationResult,
  type Project,
} from "./domain";
import {
  calculatedDraft,
  draftStatus,
  putDraft,
  requestFor,
  statusLabels,
  type DraftStatus,
  type PortfolioView,
} from "./migrationState";
import { Choice, Empty, Field, Metric, PageHeading } from "./ui";

export function DraftBadge({ status }: { status: DraftStatus }) {
  return (
    <StatusIndicator
      type={
        (
          {
            pending: "not-started",
            stale: "warning",
            complete: "info",
            invalid: "warning",
            no_candidates: "warning",
            failed: "error",
          } as const
        )[status]
      }
    >
      {statusLabels[status]}
    </StatusIndicator>
  );
}
const commonFields = [
  ["growth_percent", "연간 성장률 (%)", 0, 1000],
  ["years", "산정 기간 (년)", 0, 10],
  ["cpu_target_percent", "CPU 목표 사용률 (%)", 1, 100],
  ["memory_target_percent", "메모리 목표 사용률 (%)", 1, 100],
  ["hours_per_month", "월 사용시간 (시간)", 1, 744],
] as const;
export function Portfolio({
  project,
  update,
  bootstrap,
  open,
  navigate,
  view,
  setView,
}: {
  project: Project;
  update: Dispatch<SetStateAction<Project>>;
  bootstrap: Bootstrap;
  open: (id: string) => void;
  navigate: (p: string) => void;
  view: PortfolioView;
  setView: Dispatch<SetStateAction<PortfolioView>>;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    stopped: boolean;
  } | null>(null);
  const [common, setCommon] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const drafts = new Map(project.migrationDrafts?.map((d) => [d.assetId, d]));
  const rows = project.assets.map((asset) => {
    const draft = drafts.get(asset.id);
    const status = draftStatus(asset, draft, bootstrap.catalog.catalog_version);
    const candidate =
      status === "complete"
        ? draft?.result?.candidates?.find(
            (c) => c.instance_type === draft.selected,
          )
        : undefined;
    return {
      ...asset,
      asset,
      draft,
      status,
      candidate,
      monthly: candidate?.cost.total_monthly ?? null,
    };
  });
  const filtered = rows
    .filter(
      (r) =>
        `${r.name} ${r.id} ${r.hardware ?? ""}`
          .toLowerCase()
          .includes(view.search.trim().toLowerCase()) &&
        (view.role === "all" || r.role === view.role) &&
        (view.status === "all" || r.status === view.status),
    )
    .sort((a, b) => {
      const value =
        view.sort === "monthly"
          ? a.monthly === null
            ? b.monthly === null
              ? 0
              : 1
            : b.monthly === null
              ? -1
              : Number(a.monthly) - Number(b.monthly)
          : String(a[view.sort as "name" | "role" | "status"]).localeCompare(
              String(b[view.sort as "name" | "role" | "status"]),
              "ko",
              { numeric: true },
            );
      return view.descending ? -value : value;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / view.size));
  const page = Math.min(view.page, pages);
  const visible = filtered.slice((page - 1) * view.size, page * view.size);
  const selected = rows.filter((r) => view.selected.includes(r.id));
  const priced = rows.filter((r) => r.monthly !== null);
  const complete = rows.filter((r) => r.status === "complete").length;
  const attention = rows.filter((r) =>
    ["invalid", "no_candidates", "failed", "stale"].includes(r.status),
  ).length;
  const updateView = (values: Partial<PortfolioView>) =>
    setView((v) => ({ ...v, ...values }));
  function store(draft: MigrationDraft) {
    update((p) => (p.id === project.id ? putDraft(p, draft) : p));
  }
  async function calculate(assets: Asset[]) {
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setRunning(true);
    setMessage("");
    setProgress({ done: 0, total: assets.length, stopped: false });
    let cursor = 0;
    async function worker() {
      while (!controller.signal.aborted && cursor < assets.length) {
        const asset = assets[cursor++];
        const old = drafts.get(asset.id);
        const request = requestFor(asset, old);
        let next: MigrationDraft;
        try {
          const result = await api<MigrationResult>(
            "/api/migrate",
            request,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          next = calculatedDraft(request, result, old?.selected);
        } catch (e) {
          if (controller.signal.aborted) return;
          next = {
            assetId: asset.id,
            plan: request.plan,
            request,
            selected: "",
            failure: (e as Error).message,
          };
        }
        // Keep incoming portfolio results out of the synchronous layout update lane.
        // UI errors must not be converted into a per-asset network failure.
        startTransition(() => {
          store(next);
          setProgress((p) => p && { ...p, done: p.done + 1 });
        });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(4, assets.length) }, worker),
    );
    if (abort.current === controller) {
      startTransition(() => {
        setRunning(false);
        setProgress((p) => p && { ...p, stopped: controller.signal.aborted });
      });
    }
  }
  const commonErrors = Object.fromEntries(
    commonFields.flatMap(([key, , min, max]) => {
      const value = common?.[key] ?? "";
      return value &&
        (!/^\d+(\.\d+)?$/.test(value) ||
          Number(value) < min ||
          Number(value) > max ||
          (key === "years" && !Number.isInteger(Number(value))))
        ? [
            [
              key,
              `${min}~${max}${key === "years" ? " 정수" : ""} 범위로 입력하세요.`,
            ],
          ]
        : [];
    }),
  );
  function applyCommon() {
    if (!common || Object.keys(commonErrors).length) return;
    const patch = Object.fromEntries(
      Object.entries(common).filter(([, value]) => value !== ""),
    );
    update((p) =>
      selected.reduce((next, row) => {
        const old = next.migrationDrafts?.find((d) => d.assetId === row.id);
        return putDraft(next, {
          ...old,
          assetId: row.id,
          selected: old?.selected ?? "",
          plan: { ...requestFor(row.asset, old).plan, ...patch },
        });
      }, p),
    );
    setMessage(
      `${selected.length}개 자산에 공통 조건을 적용했습니다. 변경된 결과는 다시 산정하세요.`,
    );
    setCommon(null);
  }
  function exportRows() {
    const safe = (v: unknown) => {
      const s = String(v ?? "");
      return `"${(/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
    };
    const lines = [
      [
        "자산 ID",
        "서버 이름",
        "역할",
        "OS",
        "원본 논리 CPU",
        "원본 GiB",
        "상태",
        "EC2",
        "노드 수",
        "gp3 GiB/노드",
        "월 USD (EC2+EBS)",
        "산정 시각",
      ],
      ...filtered.map((r) => [
        r.id,
        r.name,
        r.role,
        r.os,
        r.vcpu,
        r.memory_gib,
        statusLabels[r.status],
        r.candidate?.instance_type,
        r.candidate ? r.draft?.result?.requirements?.target_nodes : "",
        r.candidate ? r.draft?.result?.storage?.size_gib : "",
        r.monthly,
        r.draft?.calculatedAt,
      ]),
    ];
    download(
      "migration-portfolio.csv",
      "\uFEFF" + lines.map((r) => r.map(safe).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <SpaceBetween size="m">
      <PageHeading
        eyebrow="AWS MIGRATION · PORTFOLIO"
        title="AWS 이전 설계"
        description="수십 개의 On-Prem 자산을 함께 산정하고, 서버별 이전 조건과 AWS 후보를 검토하세요."
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate("assets")}>
              자산 관리·CSV 등록
            </Button>
            <Button
              disabled={!filtered.length}
              iconName="download"
              onClick={exportRows}
            >
              목록 CSV
            </Button>
          </SpaceBetween>
        }
      />
      <Container>
        <ColumnLayout columns={4} variant="text-grid">
          <Metric
            label="전체 이전 대상"
            value={rows.length}
            unit="개"
            note="현재 프로젝트의 On-Prem 자산"
          />
          <Metric
            label="후보 검토 가능"
            value={complete}
            unit="개"
            note="자동 산정 초안 · 검토 후 이전안 저장"
          />
          <Metric
            label="확인 필요"
            value={attention}
            unit="개"
            note="입력·후보·통신 오류 및 재산정 대상"
          />
          <Metric
            label="EC2 + EBS 월 소계"
            value={
              priced.length
                ? money(sum(priced.map((r) => r.monthly!)))
                : "미산정"
            }
            note={`${priced.length}/${rows.length}개 현재 결과만 포함 · USD`}
          />
        </ColumnLayout>
      </Container>
      <Box color="text-body-secondary">
        서울 리전 · {bootstrap.catalog.verified_on} 스냅샷. 노드 수를 반영한 EC2
        + EBS 비용이며 세금·트래픽·백업·추가 라이선스 등은 제외합니다. 서버
        통합이나 애플리케이션 성능을 보장하는 결과가 아닙니다.
      </Box>
      {message && (
        <Alert dismissible onDismiss={() => setMessage("")}>
          {message}
        </Alert>
      )}
      {progress && running && (
        <Container>
          <SpaceBetween size="s">
            <ProgressBar
              value={
                progress.total ? (100 * progress.done) / progress.total : 0
              }
              label={
                running
                  ? "선택 자산 산정 중"
                  : progress.stopped
                    ? "산정 중지 · 완료 건 유지"
                    : "일괄 산정 완료"
              }
              description={`${progress.done}/${progress.total}개 처리 · 각 자산의 상태와 오류를 목록에서 확인하세요.`}
            />
            {running && (
              <Button onClick={() => abort.current?.abort()}>산정 중지</Button>
            )}
          </SpaceBetween>
        </Container>
      )}
      <Table
        items={visible}
        trackBy="id"
        selectionType="multi"
        wrapLines
        stripedRows
        selectedItems={visible.filter((r) => view.selected.includes(r.id))}
        onSelectionChange={(e) =>
          updateView({
            selected: [
              ...view.selected.filter(
                (id) => !visible.some((r) => r.id === id),
              ),
              ...e.detail.selectedItems.map((r) => r.id),
            ],
          })
        }
        isItemDisabled={() => running}
        ariaLabels={{
          tableLabel: "AWS 이전 대상 목록",
          selectionGroupLabel: "이전 대상 선택",
          allItemsSelectionLabel: () => "현재 페이지 전체 선택",
          itemSelectionLabel: (_, item) => `${item.name} 선택`,
        }}
        sortingColumn={{ sortingField: view.sort }}
        sortingDescending={view.descending}
        onSortingChange={(e) =>
          updateView({
            sort: e.detail.sortingColumn.sortingField ?? "name",
            descending: !!e.detail.isDescending,
            page: 1,
          })
        }
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length}/${rows.length})`}
            description={
              <SpaceBetween size="xxs">
                <span>{`선택 ${selected.length}개 · 페이지 밖 선택도 유지됩니다. 화면 이동 시 진행 중 요청은 중지됩니다.`}</span>
                {progress && !running && (
                  <div role="status">
                    <strong>
                      {progress.stopped
                        ? "산정 중지 · 완료 건 유지"
                        : "일괄 산정 완료"}
                    </strong>
                    <span>
                      {" "}
                      · {progress.done}/{progress.total}개 처리
                    </span>
                  </div>
                )}
              </SpaceBetween>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={running || !selected.length}
                  onClick={() => setCommon({})}
                >
                  공통 조건 적용
                </Button>
                <Button
                  variant="primary"
                  disabled={running || !selected.length}
                  onClick={() => void calculate(selected.map((r) => r.asset))}
                >
                  선택 {selected.length}개 산정
                </Button>
              </SpaceBetween>
            }
          >
            이전 대상
          </Header>
        }
        filter={
          <SpaceBetween size="s">
            <div className="portfolio-filters">
              <Input
                type="search"
                ariaLabel="이전 대상 검색"
                placeholder="서버 이름, ID, 장비 검색"
                value={view.search}
                onChange={(e) =>
                  updateView({ search: e.detail.value, page: 1 })
                }
              />
              <Choice
                label="역할 필터"
                value={view.role}
                options={[
                  { value: "all", label: "모든 역할" },
                  ...[...new Set(rows.map((r) => r.role))]
                    .sort()
                    .map((r) => ({ value: r, label: r })),
                ]}
                onChange={(role) => updateView({ role, page: 1 })}
              />
              <Choice
                label="산정 상태 필터"
                value={view.status}
                options={[
                  { value: "all", label: "모든 상태" },
                  ...Object.entries(statusLabels).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                onChange={(status) => updateView({ status, page: 1 })}
              />
              <Choice
                label="페이지당 자산"
                value={String(view.size)}
                options={[25, 50, 100].map((n) => ({
                  value: String(n),
                  label: `${n}개`,
                }))}
                onChange={(size) => updateView({ size: Number(size), page: 1 })}
              />
            </div>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="inline-link"
                disabled={running || !filtered.length}
                onClick={() =>
                  updateView({ selected: filtered.map((r) => r.id) })
                }
              >
                검색 결과 {filtered.length}개 전체 선택
              </Button>
              <Button
                variant="inline-link"
                disabled={running || !selected.length}
                onClick={() => updateView({ selected: [] })}
              >
                선택 해제
              </Button>
              <Button
                variant="inline-link"
                onClick={() =>
                  updateView({
                    search: "",
                    role: "all",
                    status: "all",
                    page: 1,
                  })
                }
              >
                필터 초기화
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pages}
            onChange={(e) => updateView({ page: e.detail.currentPageIndex })}
            ariaLabels={{
              nextPageLabel: "다음 자산 페이지",
              previousPageLabel: "이전 자산 페이지",
              pageLabel: (n) => `자산 ${n}페이지`,
            }}
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: "On-Prem 자산",
            sortingField: "name",
            minWidth: 190,
            cell: (r) => (
              <SpaceBetween size="xxs">
                <Link
                  href={`#migrate/${encodeURIComponent(r.id)}`}
                  onFollow={(e) => {
                    e.preventDefault();
                    open(r.id);
                  }}
                >
                  {r.name}
                </Link>
                <Box fontSize="body-s" color="text-body-secondary">
                  {r.os} · {r.role}
                </Box>
              </SpaceBetween>
            ),
          },
          {
            id: "spec",
            header: "원본 사양",
            minWidth: 135,
            cell: (r) => (
              <>
                {fmt(r.vcpu)} CPU / {fmt(r.memory_gib)} GiB
                <br />
                <Box fontSize="body-s">디스크 {fmt(r.disk_gib)} GiB</Box>
              </>
            ),
          },
          {
            id: "status",
            header: "산정 상태",
            sortingField: "status",
            minWidth: 135,
            cell: (r) => <DraftBadge status={r.status} />,
          },
          {
            id: "requirement",
            header: "요구량 / 노드",
            minWidth: 145,
            cell: (r) =>
              r.candidate
                ? `${fmt(r.draft?.result?.requirements?.vcpu.value)} vCPU / ${fmt(r.draft?.result?.requirements?.memory_gib.value)} GiB`
                : "—",
          },
          {
            id: "ec2",
            header: "EC2 초안",
            minWidth: 150,
            cell: (r) =>
              r.candidate ? (
                <>
                  {r.candidate.instance_type}
                  <Box fontSize="body-s">
                    × {r.draft?.result?.requirements?.target_nodes} 노드
                  </Box>
                </>
              ) : (
                "—"
              ),
          },
          {
            id: "storage",
            header: "gp3 / 노드",
            minWidth: 120,
            cell: (r) =>
              r.candidate
                ? `${fmt(r.draft?.result?.storage?.size_gib)} GiB`
                : "—",
          },
          {
            id: "monthly",
            header: "월 비용 (USD)",
            sortingField: "monthly",
            minWidth: 135,
            cell: (r) => (r.monthly === null ? "미산정" : money(r.monthly)),
          },
        ]}
        empty={
          <Empty
            title={
              rows.length
                ? "조건에 맞는 자산이 없습니다"
                : "On-Prem 자산을 먼저 등록하세요"
            }
            action={
              <Button
                onClick={() =>
                  rows.length
                    ? updateView({ search: "", role: "all", status: "all" })
                    : navigate("assets")
                }
              >
                {rows.length ? "검색 조건 초기화" : "서버 자산 등록"}
              </Button>
            }
          >
            CSV로 최대 200개 서버를 등록한 뒤 선택한 자산을 한 번에 산정할 수
            있습니다.
          </Empty>
        }
      />
      <Modal
        visible={common !== null}
        header={`선택 ${selected.length}개 자산 공통 조건`}
        closeAriaLabel="공통 조건 닫기"
        onDismiss={() => setCommon(null)}
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button onClick={() => setCommon(null)}>취소</Button>
            <Button
              variant="primary"
              disabled={
                !Object.values(common ?? {}).some(Boolean) ||
                !!Object.keys(commonErrors).length
              }
              onClick={applyCommon}
            >
              선택 자산에 적용
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Alert>
            입력한 항목만 덮어씁니다. 빈 항목은 자산별 값을 유지합니다.
            성장률·목표 사용률은 실측 방식에 적용되며 확정 사양 방식의
            vCPU·메모리는 바뀌지 않습니다.
          </Alert>
          {commonFields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={common?.[key] ?? ""}
              error={commonErrors[key]}
              onChange={(v) => setCommon((c) => ({ ...c, [key]: v }))}
            />
          ))}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
