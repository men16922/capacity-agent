import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import AppLayout from "@cloudscape-design/components/app-layout";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Flashbar from "@cloudscape-design/components/flashbar";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import SplitPanel from "@cloudscape-design/components/split-panel";
import Tabs from "@cloudscape-design/components/tabs";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import {
  api,
  copy,
  download,
  money,
  newProject,
  parseProject,
  sum,
  uid,
  type Bootstrap,
  type CalcRequest,
  type CalcResult,
  type Candidate,
  type MigrationResult,
  type Project,
  type Scenario,
} from "./domain";
import { Dashboard, Inventory } from "./Inventory";
import { Migration } from "./Migration";
import { Calculator } from "./Calculator";
import { Knowledge, Benchmarks } from "./Knowledge";
import { Reports, Scenarios } from "./Review";
import {
  CandidateDetail,
  Field,
  Mapping,
  Metric,
  PageHeading,
  Empty,
  SourceAvailability,
} from "./ui";

const STORAGE = "capacity-agent.workspace.v1";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    return {
      project: raw ? parseProject(JSON.parse(raw)) : newProject(),
      error: "",
    };
  } catch {
    return {
      project: newProject(),
      error:
        "저장한 프로젝트 형식을 읽지 못했습니다. 기존 저장값을 보존하고 자동 저장을 중지했습니다. JSON 백업 후 새 프로젝트를 시작하세요.",
    };
  }
}
const titles: Record<string, string> = {
  dashboard: "대시보드",
  assets: "서버 자산",
  calculator: "용량산정",
  "aws-overview": "마이그레이션 개요",
  migrate: "이전 설계",
  scenarios: "이전안·시나리오",
  reports: "산정서",
  wiki: "산정 Wiki",
  benchmarks: "벤치마크 참고",
};
type Notice = {
  id: string;
  type: "success" | "error" | "info";
  content: string;
};

export default function App() {
  const [initial] = useState(load);
  const [project, setProject] = useState<Project>(initial.project);
  const [storageBlocked, setStorageBlocked] = useState(!!initial.error);
  const [saveState, setSaveState] = useState("이 브라우저에 저장");
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState("");
  const [mode, setMode] = useState("onprem");
  const [page, setPage] = useState("dashboard");
  const [assetId, setAssetId] = useState("");
  const [draftScenario, setDraftScenario] = useState<Scenario | undefined>();
  const [migrationKey, setMigrationKey] = useState(0);
  const [reportId, setReportId] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dark, setDark] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [detail, setDetail] = useState<{
    candidate: Candidate;
    result: MigrationResult;
  } | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [replacement, setReplacement] = useState<
    "blank" | "demo" | "import" | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [rename, setRename] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = useCallback(
    (content: string, type: Notice["type"] = "success") =>
      setNotices((p) => [...p.slice(-2), { id: uid(), type, content }]),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    api<Bootstrap>("/api/bootstrap", undefined, controller.signal)
      .then(setBootstrap)
      .catch((e) => {
        if (!controller.signal.aborted) setBootError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    applyMode(dark ? Mode.Dark : Mode.Light);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (storageBlocked) return;
    try {
      const text = JSON.stringify(project);
      localStorage.setItem(STORAGE, text);
      setSaveState("이 브라우저에 저장됨");
    } catch {
      setSaveState("저장 실패 · JSON으로 백업하세요");
      notify(
        "브라우저 저장 공간이 부족하거나 저장이 제한되어 있습니다. 프로젝트 JSON을 내려받아 보존하세요.",
        "error",
      );
    }
  }, [project, storageBlocked, notify]);
  function navigate(next: string) {
    if (["aws-overview", "migrate", "scenarios"].includes(next)) setMode("aws");
    if (["dashboard", "assets", "calculator"].includes(next)) setMode("onprem");
    setPage(next);
    setSplitOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function migrate(id: string) {
    setAssetId(id);
    setDraftScenario(undefined);
    setMigrationKey((k) => k + 1);
    navigate("migrate");
  }
  function showReport(id: string) {
    setReportId(id);
    navigate("reports");
  }
  function saveScenario(s: Scenario) {
    if (project.scenarios.length >= 50) {
      notify(
        "프로젝트당 최대 50개 이전안을 보관할 수 있습니다. 기존 JSON을 백업한 뒤 정리하세요.",
        "error",
      );
      return;
    }
    setProject((p) => ({ ...p, scenarios: [...p.scenarios, s] }));
    notify(
      "이전안을 저장했습니다. 산정서와 시나리오 비교에서 확인할 수 있습니다.",
    );
    showReport(s.id);
  }
  function saveCalculation(request: CalcRequest, result: CalcResult) {
    if (project.calculations.length >= 30) {
      notify(
        "최대 30개 산정 결과를 보관할 수 있습니다. JSON으로 백업해 주세요.",
        "error",
      );
      return;
    }
    const id = uid();
    setProject((p) => ({
      ...p,
      calculations: [
        ...p.calculations,
        {
          id,
          name: `${request.scenario_id} · ${new Date().toLocaleDateString("ko-KR")}`,
          request,
          result,
        },
      ],
    }));
    notify("산정 결과와 입력·근거를 저장했습니다.");
    showReport(`calc:${id}`);
  }
  async function readProject(file: File) {
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("프로젝트 파일은 5MB 이하여야 합니다.");
      setPendingProject(parseProject(JSON.parse(await file.text())));
      setReplacement("import");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  async function replaceProject() {
    setImporting(true);
    try {
      let next =
        replacement === "import" && pendingProject
          ? copy(pendingProject)
          : newProject(replacement === "demo");
      if (replacement === "import") {
        const scenarios: Scenario[] = [];
        for (const s of next.scenarios) {
          const result = await api<MigrationResult>("/api/migrate", s.request);
          if (
            result.status !== "complete" ||
            !result.candidates?.some((c) => c.instance_type === s.selected)
          )
            throw new Error(
              `${s.name}: 현재 기준으로 재현할 수 없습니다. 원본 파일의 입력·버전·후보를 확인하세요.`,
            );
          scenarios.push({ ...s, result });
        }
        const calculations: Project["calculations"] = [];
        for (const c of next.calculations) {
          const result = await api<CalcResult>("/api/calculate", c.request);
          if (result.status !== "calculated")
            throw new Error(`${c.name}: 규칙 버전·입력을 확인하세요.`);
          calculations.push({ ...c, result });
        }
        next = { ...next, scenarios, calculations };
      }
      setStorageBlocked(false);
      setProject(next);
      setReplacement(null);
      setPendingProject(null);
      setAssetId("");
      setDraftScenario(undefined);
      setReportId("");
      navigate("dashboard");
      notify(
        replacement === "import"
          ? "프로젝트를 가져오고 계산 결과를 현재 엔진으로 검증했습니다."
          : replacement === "demo"
            ? "예제 프로젝트를 불러왔습니다. 모든 자산은 예제 데이터입니다."
            : "새 프로젝트를 시작했습니다.",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }
  const props = {
    project,
    update: setProject,
    migrate,
    navigate,
    notify,
    loadDemo: () => setReplacement("demo"),
  };
  const navItems =
    mode === "onprem"
      ? [
          { type: "link" as const, text: "대시보드", href: "#dashboard" },
          { type: "link" as const, text: "서버 자산", href: "#assets" },
          { type: "link" as const, text: "용량산정", href: "#calculator" },
        ]
      : [
          {
            type: "link" as const,
            text: "마이그레이션 개요",
            href: "#aws-overview",
          },
          { type: "link" as const, text: "이전 설계", href: "#migrate" },
          {
            type: "link" as const,
            text: "이전안·시나리오",
            href: "#scenarios",
          },
        ];
  let content: React.ReactNode = null;
  if (bootstrap) {
    if (page === "dashboard") content = <Dashboard {...props} />;
    if (page === "assets") content = <Inventory {...props} />;
    if (page === "calculator")
      content = <Calculator bootstrap={bootstrap} save={saveCalculation} />;
    if (page === "aws-overview")
      content = (
        <AwsOverview
          project={project}
          migrate={migrate}
          navigate={navigate}
          report={showReport}
        />
      );
    if (page === "migrate")
      content = (
        <Migration
          key={migrationKey}
          assets={
            draftScenario &&
            !project.assets.some((a) => a.id === draftScenario.request.asset.id)
              ? [...project.assets, draftScenario.request.asset]
              : project.assets
          }
          assetId={assetId || project.assets[0]?.id || ""}
          selectAsset={migrate}
          bootstrap={bootstrap}
          initial={draftScenario}
          save={saveScenario}
          inspect={(candidate, result) => {
            setDetail({ candidate, result });
            setSplitOpen(true);
          }}
          cancel={() => navigate("assets")}
        />
      );
    if (page === "scenarios")
      content = (
        <Scenarios
          project={project}
          update={setProject}
          edit={(s) => {
            setDraftScenario(s);
            setAssetId(s.request.asset.id);
            setMigrationKey((k) => k + 1);
            navigate("migrate");
          }}
          report={showReport}
          start={() => migrate(project.assets[0]?.id ?? "")}
        />
      );
    if (page === "reports")
      content = (
        <Reports
          project={project}
          bootstrap={bootstrap}
          selectedId={reportId}
          setSelectedId={setReportId}
        />
      );
    if (page === "wiki") content = <Knowledge bootstrap={bootstrap} />;
    if (page === "benchmarks") content = <Benchmarks bootstrap={bootstrap} />;
  }
  return (
    <SourceAvailability.Provider
      value={Object.fromEntries(
        (bootstrap?.sources ?? []).map((s) => [s.id, s.available]),
      )}
    >
      <div id="top-nav" className="no-print">
        <TopNavigation
          identity={{
            href: "#",
            title: "Capacity Agent",
            onFollow: (e) => {
              e.preventDefault();
              navigate("dashboard");
            },
          }}
          utilities={[
            {
              type: "button",
              text: "서울 · ap-northeast-2",
              onClick: () =>
                notify(
                  "AWS 사양·단가는 서울 리전의 공식 스냅샷을 사용합니다.",
                  "info",
                ),
            },
            {
              type: "button",
              text: dark ? "라이트 모드" : "다크 모드",
              onClick: () => setDark((v) => !v),
            },
            {
              type: "button",
              text: "프로젝트 설정",
              iconName: "settings",
              onClick: () => {
                setProjectName(project.name);
                setRename(true);
              },
            },
          ]}
        />
      </div>
      <AppLayout
        ariaLabels={{
          navigation: "워크스페이스 탐색",
          navigationToggle: "탐색 메뉴 열기",
          navigationClose: "탐색 메뉴 닫기",
          notifications: "알림",
          tools: "도움말",
          toolsToggle: "도움말 열기",
          toolsClose: "도움말 닫기",
        }}
        headerSelector="#top-nav"
        navigationOpen={navigationOpen}
        onNavigationChange={(e) => setNavigationOpen(e.detail.open)}
        toolsHide
        navigation={
          <SideNavigation
            activeHref={`#${page}`}
            header={{ href: "#dashboard", text: "설계 워크스페이스" }}
            onFollow={(e) => {
              e.preventDefault();
              navigate(e.detail.href.slice(1));
            }}
            items={[
              {
                type: "section",
                text: mode === "onprem" ? "ON-PREM" : "AWS",
                items: navItems,
              },
              { type: "divider" },
              { type: "link", text: "산정서", href: "#reports" },
              {
                type: "section",
                text: "참고 자료",
                items: [
                  { type: "link", text: "산정 Wiki", href: "#wiki" },
                  { type: "link", text: "벤치마크 참고", href: "#benchmarks" },
                ],
              },
            ]}
          />
        }
        navigationWidth={228}
        breadcrumbs={
          <div className="no-print">
            <BreadcrumbGroup
              items={[
                { text: "Capacity Agent", href: "#dashboard" },
                {
                  text: mode === "onprem" ? "On-Prem" : "AWS",
                  href: mode === "onprem" ? "#dashboard" : "#aws-overview",
                },
                { text: titles[page], href: `#${page}` },
              ]}
              onFollow={(e) => {
                e.preventDefault();
                navigate(e.detail.href.slice(1));
              }}
              ariaLabel="현재 위치"
            />
          </div>
        }
        notifications={
          <div className="no-print">
            <Flashbar
              items={notices.map((n) => ({
                ...n,
                dismissible: true,
                dismissLabel: "알림 닫기",
                onDismiss: () =>
                  setNotices((v) => v.filter((x) => x.id !== n.id)),
              }))}
            />
          </div>
        }
        splitPanel={
          detail ? (
            <SplitPanel
              header="EC2 후보 상세"
              i18nStrings={{
                preferencesTitle: "패널 설정",
                preferencesPositionLabel: "패널 위치",
                preferencesPositionDescription:
                  "후보를 검토할 위치를 선택하세요.",
                preferencesPositionSide: "오른쪽",
                preferencesPositionBottom: "아래",
                preferencesConfirm: "확인",
                preferencesCancel: "취소",
                closeButtonAriaLabel: "상세 패널 닫기",
                openButtonAriaLabel: "상세 패널 열기",
                resizeHandleAriaLabel: "상세 패널 크기 조정",
              }}
            >
              <CandidateDetail
                candidate={detail.candidate}
                result={detail.result}
              />
            </SplitPanel>
          ) : undefined
        }
        splitPanelOpen={splitOpen}
        onSplitPanelToggle={(e) => setSplitOpen(e.detail.open)}
        splitPanelPreferences={{ position: "side" }}
        content={
          <SpaceBetween size="l">
            <div className="workspace-bar no-print">
              <div>
                <span className="project-dot" />
                <strong>{project.name}</strong>
                {project.demo && <span className="demo-pill">예제</span>}
                <span className="save-state">{saveState}</span>
              </div>
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="download"
                  onClick={() =>
                    download(
                      `capacity-project-${project.id}.json`,
                      JSON.stringify(project, null, 2),
                    )
                  }
                >
                  프로젝트 JSON
                </Button>
                <Button
                  iconName="upload"
                  onClick={() => fileInput.current?.click()}
                >
                  가져오기
                </Button>
                <Button onClick={() => setReplacement("blank")}>
                  새 프로젝트
                </Button>
              </SpaceBetween>
            </div>
            <div className="mode-tabs no-print">
              <Tabs
                activeTabId={mode}
                onChange={(e) => {
                  setMode(e.detail.activeTabId);
                  navigate(
                    e.detail.activeTabId === "onprem"
                      ? "dashboard"
                      : "aws-overview",
                  );
                }}
                tabs={[
                  { id: "onprem", label: "On-Prem" },
                  { id: "aws", label: "AWS" },
                ]}
              />
            </div>
            {initial.error && storageBlocked && (
              <Alert
                type="error"
                header="자동 저장 중지"
                action={
                  <Button
                    onClick={() =>
                      download(
                        "capacity-recovery.json",
                        localStorage.getItem(STORAGE) ?? "",
                      )
                    }
                  >
                    기존 저장값 백업
                  </Button>
                }
              >
                {initial.error}
              </Alert>
            )}
            {project.demo && (
              <div className="no-print">
                <Alert type="info" dismissible={false}>
                  예제 프로젝트입니다. 실제 운영 사양·측정값이 아닙니다. 새
                  프로젝트에서 실제 자산을 등록하세요.
                </Alert>
              </div>
            )}
            {!bootstrap ? (
              bootError ? (
                <Alert
                  type="error"
                  header="로컬 서버에 연결할 수 없습니다"
                  action={
                    <Button onClick={() => location.reload()}>다시 연결</Button>
                  }
                >
                  {bootError}
                </Alert>
              ) : (
                <Box padding="xxxl" textAlign="center">
                  <Spinner size="large" />
                  <p>산정 기준과 워크스페이스를 불러오고 있습니다.</p>
                </Box>
              )
            ) : (
              content
            )}
            <div className="app-footer no-print">
              Capacity Agent · 결정론적 계산과 원문 근거 · 로컬 워크스페이스
            </div>
          </SpaceBetween>
        }
      />
      <input
        className="visually-hidden"
        type="file"
        ref={fileInput}
        accept=".json,application/json"
        aria-label="프로젝트 JSON 파일"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readProject(file);
          e.target.value = "";
        }}
      />
      <Modal
        visible={!!replacement}
        onDismiss={() => !importing && setReplacement(null)}
        header={
          replacement === "import"
            ? "프로젝트 가져오기"
            : replacement === "demo"
              ? "예제 프로젝트 불러오기"
              : "새 프로젝트 시작"
        }
        closeAriaLabel="닫기"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="s">
              <Button disabled={importing} onClick={() => setReplacement(null)}>
                취소
              </Button>
              <Button
                variant="primary"
                loading={importing}
                onClick={() => void replaceProject()}
              >
                계속
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            현재 브라우저의 프로젝트를{" "}
            {replacement === "import"
              ? `“${pendingProject?.name}”`
              : replacement === "demo"
                ? "예제 프로젝트"
                : "빈 프로젝트"}
            로 바꿉니다. 필요한 경우 먼저 JSON을 내려받아 보존하세요.
          </Box>
          <Button
            iconName="download"
            onClick={() =>
              download(
                `capacity-project-${project.id}.json`,
                JSON.stringify(project, null, 2),
              )
            }
          >
            현재 프로젝트 백업
          </Button>
          {replacement === "import" && (
            <Box>
              저장된 계산은 현재 엔진으로 다시 검증합니다. 검증 실패 시 현재
              프로젝트를 유지합니다.
            </Box>
          )}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={rename}
        onDismiss={() => setRename(false)}
        header="프로젝트 설정"
        closeAriaLabel="닫기"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => setRename(false)}>취소</Button>
              <Button
                variant="primary"
                disabled={!projectName.trim() || projectName.length > 200}
                onClick={() => {
                  setProject((p) => ({ ...p, name: projectName.trim() }));
                  setRename(false);
                }}
              >
                저장
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Field
          label="프로젝트 이름"
          value={projectName}
          onChange={setProjectName}
        />
      </Modal>
    </SourceAvailability.Provider>
  );
}

function AwsOverview({
  project,
  migrate,
  navigate,
  report,
}: {
  project: Project;
  migrate: (id: string) => void;
  navigate: (p: string) => void;
  report: (id: string) => void;
}) {
  const current = [
    ...new Map(
      project.scenarios
        .filter((s) => project.assets.some((a) => a.id === s.request.asset.id))
        .map((s) => [s.request.asset.id, s]),
    ).values(),
  ];
  const priced = current
    .map(
      (s) =>
        s.result.candidates?.find((c) => c.instance_type === s.selected)?.cost
          .total_monthly,
    )
    .filter((v): v is string => v != null);
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="AWS MIGRATION WORKSPACE"
        title="마이그레이션 개요"
        description="현재 서버와 AWS 이전안을 연결하고, 확인한 가정으로 구성을 비교합니다."
        actions={
          <Button
            variant="primary"
            onClick={() => migrate(project.assets[0]?.id ?? "")}
          >
            이전 설계 시작
          </Button>
        }
      />
      <Container>
        <ColumnLayout columns={4} variant="text-grid">
          <Metric
            label="On-Prem 자산"
            value={project.assets.length}
            unit="개"
          />
          <Metric label="이전안이 있는 자산" value={current.length} unit="개" />
          <Metric
            label="저장한 시나리오"
            value={project.scenarios.length}
            unit="개"
          />
          <Metric
            label="EC2 + EBS 월 소계"
            value={priced.length ? money(sum(priced)) : "미산정"}
            note={`자산별 최근 이전안 · ${priced.length}/${current.length}개 비용 산정`}
          />
        </ColumnLayout>
      </Container>
      {!current.length ? (
        <Container>
          <Empty
            title="첫 AWS 이전안을 만들어 보세요"
            action={
              <Button
                variant="primary"
                onClick={() =>
                  project.assets.length
                    ? migrate(project.assets[0].id)
                    : navigate("assets")
                }
              >
                {project.assets.length
                  ? "On-Prem 서버에서 시작"
                  : "서버 자산 등록"}
              </Button>
            }
          >
            실측 사용량 또는 확정 사양을 기준으로 EC2·gp3 후보를 비교합니다.
          </Empty>
        </Container>
      ) : (
        current.map((s) => (
          <Container
            key={s.id}
            header={
              <Header
                variant="h2"
                description={s.name}
                actions={
                  <Button onClick={() => report(s.id)}>산정서 보기</Button>
                }
              >
                {s.request.asset.name}
              </Header>
            }
          >
            <Mapping
              asset={s.request.asset}
              candidate={s.result.candidates?.find(
                (c) => c.instance_type === s.selected,
              )}
              result={s.result}
            />
          </Container>
        ))
      )}
      <Alert type="info">
        가격은 서울 리전의 On-Demand 스냅샷입니다. 소계는 자산별 최근 이전안의
        EC2·EBS만 포함하며, 네트워크·백업·지원·세금·이관 비용은 별도입니다.
      </Alert>
    </SpaceBetween>
  );
}
