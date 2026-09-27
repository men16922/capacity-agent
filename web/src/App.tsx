import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import AppLayout from "@cloudscape-design/components/app-layout";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import Flashbar from "@cloudscape-design/components/flashbar";
import Modal from "@cloudscape-design/components/modal";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import SplitPanel from "@cloudscape-design/components/split-panel";

import TopNavigation from "@cloudscape-design/components/top-navigation";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import {
  api,
  copy,
  download,
  newProject,
  parseProject,
  uid,
  type Bootstrap,
  type CalcRequest,
  type CalcResult,
  type Candidate,
  type MigrationResult,
  type MigrationDraft,
  type Project,
  type Scenario,
  type OptimizationScenario,
} from "./domain";
import { AssetDetail, OptimizationList } from "./Optimization";
import { OptimizationScenarios } from "./OptimizationScenarios";
import { Inventory } from "./Inventory";
import { Dashboard } from "./Dashboard";
import { Migration } from "./Migration";
import { Portfolio } from "./Portfolio";
import { MigrationDetail } from "./MigrationDetail";
import {
  compactResult,
  putDraft,
  initialPortfolioView,
} from "./migrationState";
import { Calculator } from "./Calculator";
import { Knowledge, Benchmarks } from "./Knowledge";
import { Reports, Scenarios } from "./Review";
import portfolioExample from "../../examples/migration-portfolio-48.json";
import { CandidateDetail, Field, SourceAvailability, SourceTitles } from "./ui";

import { ProjectHub } from "./ProjectHub";
import {
  useProjectLibrary,
  verifyImport,
  compactOptimization,
  PROJECT_FILE_LIMIT,
} from "./projectStore";
const STORAGE = "capacity-agent.workspace.v1";
const titles: Record<string, string> = {
  dashboard: "통합 대시보드",
  assets: "서버 자산",
  calculator: "용량산정",
  "aws-overview": "마이그레이션 개요",
  migrate: "AWS 마이그레이션",
  "asset-detail": "자산 상세",
  "onprem-scenarios": "산정 시나리오",
  "aws-assets": "AWS 자산",
  "aws-asset-detail": "AWS 자산 상세",
  "aws-optimize": "최적화",
  "aws-optimize-detail": "최적화 상세",
  "aws-optimization-scenarios": "최적화 시나리오",
  "migration-detail": "자산 상세",
  "migration-edit": "이전 조건 편집",
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

function readRoute() {
  try {
    const [, section, id, edit] =
      window.location.hash
        .replace(/^#project\/[^/]+\/?/, "#")
        .match(/^#([^/]*)(?:\/([^/]*))?(?:\/(edit))?$/) ?? [];
    if (section === "migrate" && id)
      return {
        page: edit ? "migration-edit" : "migration-detail",
        assetId: decodeURIComponent(id),
        clone: "",
      };
    if (["assets", "aws-assets", "aws-optimize"].includes(section) && id)
      return {
        page:
          section === "assets"
            ? "asset-detail"
            : section === "aws-assets"
              ? "aws-asset-detail"
              : "aws-optimize-detail",
        assetId: decodeURIComponent(id),
        clone: "",
      };
    if (section === "clone" && id)
      return {
        page: "migration-edit",
        assetId: "",
        clone: decodeURIComponent(id),
      };
    return {
      page: section && titles[section] ? section : "dashboard",
      assetId: "",
      clone: "",
    };
  } catch {
    return { page: "dashboard", assetId: "", clone: "" };
  }
}
export default function App() {
  const library = useProjectLibrary();
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const match = hash.match(/^#project\/([^/]+)/);
  let projectId = "";
  try {
    projectId = match ? decodeURIComponent(match[1]) : "";
  } catch {
    /* Invalid URL remains on the project hub. */
  }
  const record = library.records.find((r) => r.id === projectId);
  function open(id: string) {
    location.hash = `project/${encodeURIComponent(id)}/dashboard`;
  }
  useEffect(() => {
    if (
      library.ready &&
      !match &&
      hash &&
      hash !== "#projects" &&
      library.records[0]
    )
      location.hash = `project/${encodeURIComponent(library.records[0].id)}/${hash.slice(1)}`;
  }, [library.ready, hash]);
  if (!library.ready)
    return (
      <main className="boot-error">
        {library.error ? (
          <Alert
            type="error"
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
            {library.error}
          </Alert>
        ) : (
          <Spinner size="large" />
        )}
      </main>
    );
  if (!record)
    return (
      <ProjectHub
        records={library.records}
        error={
          match
            ? "프로젝트를 찾을 수 없습니다. 목록에서 선택하세요."
            : library.error
        }
        open={open}
        add={library.add}
      />
    );
  return (
    <Workspace
      key={record.id}
      project={record.project}
      setProject={(p) => library.update(record.id, p)}
      saveState={
        library.projectErrors[record.id]
          ? "저장 중지 · JSON 백업 필요"
          : library.saving
            ? "저장 중…"
            : "이 브라우저에 저장됨"
      }
      storageError={library.projectErrors[record.id] ?? ""}
      addProject={async (p) => {
        await library.add(p);
        open(p.id);
      }}
    />
  );
}
function Workspace({
  project,
  setProject,
  saveState,
  storageError,
  addProject,
}: {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  saveState: string;
  storageError: string;
  addProject: (p: Project) => Promise<void>;
}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState("");
  const [route] = useState(readRoute);
  const [page, setPage] = useState(route.page);
  const [assetId, setAssetId] = useState(route.assetId);
  const [draftScenario, setDraftScenario] = useState<Scenario | undefined>(() =>
    project.scenarios.find((s) => s.id === route.clone),
  );
  const [portfolioView, setPortfolioView] = useState(initialPortfolioView);
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
    "blank" | "demo" | "portfolio-demo" | "import" | null
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
    function changed() {
      const route = readRoute();
      setPage(route.page);
      setAssetId(route.assetId);
      setDraftScenario(project.scenarios.find((s) => s.id === route.clone));
      setSplitOpen(false);
      setMigrationKey((k) => k + 1);
    }
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [project.scenarios]);
  const scopedHref = (href: string) =>
    href === "#projects"
      ? href
      : `#project/${encodeURIComponent(project.id)}/${href.slice(1)}`;
  const follow = (href: string) => {
    if (href === "#projects") location.hash = "projects";
    else navigate(href.replace(/^#project\/[^/]+\//, "#").slice(1));
  };
  function navigate(next: string, id = assetId, clone = "") {
    const suffix = clone
      ? `#clone/${encodeURIComponent(clone)}`
      : ["migration-detail", "migration-edit"].includes(next)
        ? `#migrate/${encodeURIComponent(id)}${next === "migration-edit" ? "/edit" : ""}`
        : ["asset-detail", "aws-asset-detail", "aws-optimize-detail"].includes(
              next,
            )
          ? `#${next === "asset-detail" ? "assets" : next === "aws-asset-detail" ? "aws-assets" : "aws-optimize"}/${encodeURIComponent(id)}`
          : `#${next}`;
    const hash = `#project/${encodeURIComponent(project.id)}/${suffix.slice(1)}`;
    setAssetId(id);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setPage(next);
    setAssetId(id);
    setSplitOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function migrate(id: string) {
    setAssetId(id);
    setDraftScenario(undefined);
    setMigrationKey((k) => k + 1);
    navigate(id ? "migration-detail" : "migrate", id);
  }
  function editAsset(id: string) {
    setAssetId(id);
    setDraftScenario(undefined);
    setMigrationKey((k) => k + 1);
    navigate("migration-edit", id);
  }
  function updateDraft(draft: MigrationDraft) {
    setProject((p) => putDraft(p, draft));
  }
  function showReport(id: string) {
    setReportId(id);
    navigate("reports");
  }
  function saveScenario(s: Scenario) {
    if (project.scenarios.length >= 200) {
      notify(
        "프로젝트당 최대 200개 이전안을 보관할 수 있습니다. 기존 JSON을 백업한 뒤 정리하세요.",
        "error",
      );
      return;
    }
    setProject((p) => ({
      ...p,
      scenarios: [
        ...p.scenarios,
        { ...s, result: compactResult(s.result, s.selected) },
      ],
    }));
    notify(
      "이전안을 저장했습니다. 산정서와 시나리오 비교에서 확인할 수 있습니다.",
    );
    showReport(s.id);
  }
  function saveOptimization(s: OptimizationScenario) {
    if ((project.optimizations?.length ?? 0) >= 200) {
      notify("최적화안은 프로젝트당 최대 200개입니다.", "error");
      return;
    }
    setProject((p) => ({
      ...p,
      optimizations: [
        ...(p.optimizations ?? []),
        { ...s, result: compactOptimization(s.result) },
      ],
    }));
    notify("최적화 시나리오를 저장했습니다.");
    showReport(`opt:${s.id}`);
  }
  function saveCalculation(
    request: CalcRequest,
    result: CalcResult,
    name: string,
  ) {
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
          savedAt: new Date().toISOString(),
          name,
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
      if (file.size > PROJECT_FILE_LIMIT)
        throw new Error("프로젝트 파일은 20MB 이하여야 합니다.");
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
          : replacement === "portfolio-demo"
            ? { ...parseProject(copy(portfolioExample)), id: uid() }
            : newProject(replacement === "demo");
      if (replacement === "blank")
        next.name = projectName.trim() || "새 인프라 프로젝트";
      if (replacement === "import") next = await verifyImport(next);
      await addProject(next);
      setReplacement(null);
      setPendingProject(null);
      setAssetId("");
      setDraftScenario(undefined);
      setReportId("");

      notify(
        replacement === "import"
          ? "프로젝트를 가져오고 계산 결과를 현재 엔진으로 검증했습니다."
          : replacement === "demo" || replacement === "portfolio-demo"
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
  let content: React.ReactNode = null;
  if (bootstrap) {
    if (page === "dashboard") content = <Dashboard {...props} />;
    if (page === "assets") content = <Inventory {...props} />;
    if (
      page === "asset-detail" ||
      page === "aws-asset-detail" ||
      page === "aws-optimize-detail"
    )
      content = (
        <AssetDetail
          key={`${page}:${assetId}`}
          asset={(page === "asset-detail"
            ? project.assets
            : (project.awsAssets ?? [])
          ).find((a) => a.id === assetId)}
          environment={page === "asset-detail" ? "onprem" : "aws"}
          project={project}
          update={setProject}
          navigate={navigate}
          save={saveOptimization}
          optimizationOnly={page === "aws-optimize-detail"}
        />
      );
    if (page === "aws-assets")
      content = (
        <Inventory
          {...props}
          environment="aws"
          project={{ ...project, assets: project.awsAssets ?? [] }}
          update={(p) => setProject({ ...project, awsAssets: p.assets })}
        />
      );
    if (page === "aws-optimize")
      content = <OptimizationList project={project} navigate={navigate} />;
    if (page === "onprem-scenarios" || page === "aws-optimization-scenarios")
      content = (
        <OptimizationScenarios
          project={project}
          environment={page === "onprem-scenarios" ? "onprem" : "aws"}
          update={setProject}
          report={showReport}
          navigate={navigate}
        />
      );
    if (page === "calculator")
      content = <Calculator bootstrap={bootstrap} save={saveCalculation} />;
    if (page === "aws-overview" || page === "migrate")
      content = (
        <Portfolio
          key={project.id}
          project={project}
          update={setProject}
          bootstrap={bootstrap}
          open={migrate}
          loadExample={() => setReplacement("portfolio-demo")}
          navigate={navigate}
          view={portfolioView}
          setView={setPortfolioView}
        />
      );
    if (page === "migration-detail")
      content = (
        <MigrationDetail
          key={`${project.id}:${assetId}`}
          project={project}
          assetId={assetId}
          bootstrap={bootstrap}
          update={setProject}
          back={() => navigate("migrate")}
          edit={() => editAsset(assetId)}
          save={saveScenario}
          inspect={(candidate, result) => {
            setDetail({ candidate, result });
            setSplitOpen(true);
          }}
        />
      );
    if (page === "migration-edit")
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
          selectAsset={editAsset}
          bootstrap={bootstrap}
          initial={draftScenario}
          draft={
            draftScenario
              ? undefined
              : project.migrationDrafts?.find((d) => d.assetId === assetId)
          }
          updateDraft={draftScenario ? undefined : updateDraft}
          save={saveScenario}
          inspect={(candidate, result) => {
            setDetail({ candidate, result });
            setSplitOpen(true);
          }}
          cancel={() =>
            draftScenario ? navigate("scenarios") : migrate(assetId)
          }
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
            navigate("migration-edit", s.request.asset.id, s.id);
          }}
          report={showReport}
          start={() => navigate("migrate")}
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
    <SourceTitles.Provider
      value={Object.fromEntries(
        (bootstrap?.sources ?? []).map((s) => [
          s.id,
          bootstrap?.documents.find((d) => d.id === s.card)?.title ??
            "참고 자료",
        ]),
      )}
    >
      <SourceAvailability.Provider
        value={Object.fromEntries(
          (bootstrap?.sources ?? []).map((s) => [s.id, s.available]),
        )}
      >
        <div id="top-nav" className="no-print">
          <TopNavigation
            identity={{
              href: "#projects",
              title: "Capacity Agent",
              onFollow: (e) => {
                e.preventDefault();
                location.hash = "projects";
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
              activeHref={scopedHref(
                `#${page.startsWith("migration-") ? "migrate" : page === "asset-detail" ? "assets" : page === "aws-asset-detail" ? "aws-assets" : page === "aws-optimize-detail" ? "aws-optimize" : page}`,
              )}
              header={{ href: scopedHref("#dashboard"), text: project.name }}
              onFollow={(e) => {
                e.preventDefault();
                follow(e.detail.href);
              }}
              items={scopeNavigation(
                [
                  { type: "link", text: "프로젝트 목록", href: "#projects" },
                  { type: "divider" },
                  { type: "link", text: "통합 대시보드", href: "#dashboard" },
                  {
                    type: "section",
                    text: "On-Prem",
                    items: [
                      { type: "link", text: "서버 자산", href: "#assets" },
                      { type: "link", text: "용량산정", href: "#calculator" },
                      {
                        type: "link",
                        text: "산정 시나리오",
                        href: "#onprem-scenarios",
                      },
                    ],
                  },
                  {
                    type: "section",
                    text: "AWS",
                    items: [
                      {
                        type: "link",
                        text: "AWS 마이그레이션",
                        href: "#migrate",
                      },
                      {
                        type: "link",
                        text: "이전안·시나리오",
                        href: "#scenarios",
                      },
                      { type: "link", text: "AWS 자산", href: "#aws-assets" },
                      { type: "link", text: "최적화", href: "#aws-optimize" },
                      {
                        type: "link",
                        text: "최적화 시나리오",
                        href: "#aws-optimization-scenarios",
                      },
                    ],
                  },
                  { type: "divider" },
                  { type: "link", text: "산정서", href: "#reports" },
                  {
                    type: "section",
                    text: "참고 자료",
                    items: [
                      { type: "link", text: "산정 Wiki", href: "#wiki" },
                      {
                        type: "link",
                        text: "벤치마크 참고",
                        href: "#benchmarks",
                      },
                    ],
                  },
                ],
                scopedHref,
              )}
            />
          }
          navigationWidth={228}
          breadcrumbs={
            <div className="no-print">
              <BreadcrumbGroup
                items={[
                  { text: "Capacity Agent", href: "#projects" },
                  { text: project.name, href: "#dashboard" },
                  ...([
                    "assets",
                    "asset-detail",
                    "calculator",
                    "onprem-scenarios",
                  ].includes(page)
                    ? [{ text: "On-Prem", href: "#assets" }]
                    : [
                          "migrate",
                          "scenarios",
                          "migration-detail",
                          "migration-edit",
                        ].includes(page) || page.startsWith("aws-")
                      ? [{ text: "AWS", href: "#migrate" }]
                      : []),
                  ...(page.startsWith("migration-")
                    ? [{ text: "AWS 마이그레이션", href: "#migrate" }]
                    : page === "asset-detail"
                      ? [{ text: "서버 자산", href: "#assets" }]
                      : page === "aws-asset-detail"
                        ? [{ text: "AWS 자산", href: "#aws-assets" }]
                        : page === "aws-optimize-detail"
                          ? [{ text: "최적화", href: "#aws-optimize" }]
                          : []),
                  {
                    text: page.includes("detail")
                      ? ([...project.assets, ...(project.awsAssets ?? [])].find(
                          (a) => a.id === assetId,
                        )?.name ?? titles[page])
                      : titles[page],
                    href: `#${page}`,
                  },
                ].map((i) => ({ ...i, href: scopedHref(i.href) }))}
                onFollow={(e) => {
                  e.preventDefault();
                  follow(e.detail.href);
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
                  <Button
                    onClick={() => {
                      setProjectName("");
                      setReplacement("blank");
                    }}
                  >
                    새 프로젝트
                  </Button>
                </SpaceBetween>
              </div>
              {storageError && (
                <Alert type="error" header="자동 저장 중지">
                  {storageError}
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
                      <Button onClick={() => location.reload()}>
                        다시 연결
                      </Button>
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
              : replacement === "portfolio-demo"
                ? "48개 합성 자산 예제 불러오기"
                : replacement === "demo"
                  ? "예제 프로젝트 불러오기"
                  : "새 프로젝트 시작"
          }
          closeAriaLabel="닫기"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  disabled={importing}
                  onClick={() => setReplacement(null)}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  loading={importing}
                  disabled={replacement === "blank" && projectName.length > 200}
                  onClick={() => void replaceProject()}
                >
                  계속
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            {replacement === "blank" && (
              <Field
                label="프로젝트 이름"
                value={projectName}
                onChange={setProjectName}
              />
            )}
            <Box>
              새 프로젝트로{" "}
              {replacement === "import"
                ? `“${pendingProject?.name}”`
                : replacement === "portfolio-demo"
                  ? "48개 합성 자산 예제"
                  : replacement === "demo"
                    ? "예제 프로젝트"
                    : "빈 프로젝트"}
              를 추가합니다. 기존 프로젝트는 그대로 유지됩니다.
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
    </SourceTitles.Provider>
  );
}

function scopeNavigation(
  items: readonly import("@cloudscape-design/components/side-navigation").SideNavigationProps.Item[],
  scope: (href: string) => string,
): readonly import("@cloudscape-design/components/side-navigation").SideNavigationProps.Item[] {
  return items.map((item) =>
    item.type === "section"
      ? { ...item, items: scopeNavigation(item.items, scope) }
      : item.type === "link"
        ? { ...item, href: scope(item.href) }
        : item,
  );
}
