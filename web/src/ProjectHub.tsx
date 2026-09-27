import { useRef, useState } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import { Empty, Field, Metric, PageHeading } from "./ui";
import {
  newProject,
  parseProject,
  uid,
  download,
  type Project,
} from "./domain";
import {
  verifyImport,
  PROJECT_FILE_LIMIT,
  type ProjectRecord,
} from "./projectStore";
import fixture from "../../examples/migration-portfolio-48.json";
export function ProjectHub({
  records,
  open,
  add,
  error,
}: {
  records: ProjectRecord[];
  open: (id: string) => void;
  add: (p: Project) => Promise<void>;
  error: string;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function create(project: Project) {
    setBusy(true);
    setMessage("");
    try {
      await add(project);
      setCreating(false);
      open(project.id);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(f: File) {
    setBusy(true);
    setMessage("");
    try {
      if (f.size > PROJECT_FILE_LIMIT)
        throw new Error("JSON 파일은 20MB 이하여야 합니다.");
      const p = await verifyImport(parseProject(JSON.parse(await f.text())));
      await add(p);
      open(p.id);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div id="top-nav">
        <TopNavigation
          identity={{ href: "#projects", title: "Capacity Agent" }}
          utilities={[{ type: "button", text: "로컬 프로젝트 · 이 브라우저" }]}
        />
      </div>
      <AppLayout
        ariaLabels={{
          navigation: "프로젝트 탐색",
          navigationToggle: "탐색 메뉴 열기",
          navigationClose: "탐색 메뉴 닫기",
        }}
        headerSelector="#top-nav"
        toolsHide
        navigationWidth={228}
        navigation={
          <SideNavigation
            header={{ text: "Capacity Agent", href: "#projects" }}
            activeHref="#projects"
            items={[{ type: "link", text: "프로젝트", href: "#projects" }]}
          />
        }
        breadcrumbs={
          <BreadcrumbGroup
            ariaLabel="현재 위치"
            items={[
              { text: "Capacity Agent", href: "#projects" },
              { text: "프로젝트", href: "#projects" },
            ]}
          />
        }
        content={
          <SpaceBetween size="l">
            <PageHeading
              eyebrow="CAPACITY AGENT"
              title="프로젝트"
              description="프로젝트를 선택해 On-Prem 용량산정과 AWS 마이그레이션·최적화를 관리하세요."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={busy}
                    onClick={() => file.current?.click()}
                    iconName="upload"
                  >
                    프로젝트 가져오기
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void create({
                        ...parseProject(structuredClone(fixture)),
                        id: uid(),
                      })
                    }
                  >
                    48개 자산 예제
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy}
                    iconName="add-plus"
                    onClick={() => {
                      setName("");
                      setCreating(true);
                    }}
                  >
                    프로젝트 생성
                  </Button>
                </SpaceBetween>
              }
            />
            {(error || message) && (
              <Alert type="error">{error || message}</Alert>
            )}
            {busy && (
              <Alert type="info">
                프로젝트를 준비하고 저장된 계산을 검증하고 있습니다.
              </Alert>
            )}
            <Container>
              <ColumnLayout columns={3} variant="text-grid">
                <Metric label="프로젝트" value={records.length} unit="개" />
                <Metric
                  label="On-Prem 자산"
                  value={records.reduce(
                    (n, r) => n + r.project.assets.length,
                    0,
                  )}
                  unit="개"
                />
                <Metric
                  label="AWS 자산"
                  value={records.reduce(
                    (n, r) => n + (r.project.awsAssets?.length ?? 0),
                    0,
                  )}
                  unit="개"
                />
              </ColumnLayout>
            </Container>
            <Table
              trackBy="id"
              items={records
                .filter((r) =>
                  r.project.name.toLowerCase().includes(query.toLowerCase()),
                )
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
              header={
                <Header variant="h2" counter={`(${records.length})`}>
                  프로젝트 목록
                </Header>
              }
              filter={
                <TextFilter
                  filteringText={query}
                  onChange={(e) => setQuery(e.detail.filteringText)}
                  filteringAriaLabel="프로젝트 검색"
                  filteringPlaceholder="프로젝트 이름 검색"
                />
              }
              columnDefinitions={[
                {
                  id: "name",
                  header: "프로젝트 이름",
                  cell: (r) => (
                    <>
                      <Button variant="inline-link" onClick={() => open(r.id)}>
                        {r.project.name}
                      </Button>{" "}
                      {r.project.demo && <Badge color="grey">예제</Badge>}
                    </>
                  ),
                },
                {
                  id: "onprem",
                  header: "On-Prem 자산",
                  cell: (r) => r.project.assets.length,
                },
                {
                  id: "aws",
                  header: "AWS 자산",
                  cell: (r) => r.project.awsAssets?.length ?? 0,
                },
                {
                  id: "plans",
                  header: "저장 산정안",
                  cell: (r) =>
                    r.project.scenarios.length +
                    r.project.calculations.length +
                    (r.project.optimizations?.length ?? 0),
                },
                {
                  id: "updated",
                  header: "수정 시각",
                  cell: (r) => new Date(r.updatedAt).toLocaleString("ko-KR"),
                },
                {
                  id: "backup",
                  header: "백업",
                  cell: (r) => (
                    <Button
                      variant="inline-link"
                      ariaLabel={`${r.project.name} JSON 내보내기`}
                      onClick={() =>
                        download(
                          `capacity-project-${r.id}.json`,
                          JSON.stringify(r.project, null, 2),
                        )
                      }
                    >
                      JSON 내보내기
                    </Button>
                  ),
                },
              ]}
              empty={
                <Empty
                  title={
                    query
                      ? "일치하는 프로젝트가 없습니다"
                      : "첫 프로젝트를 만드세요"
                  }
                >
                  프로젝트마다 자산·산정안·이전안·산정서를 독립적으로
                  보관합니다.
                </Empty>
              }
            />
            <BoxNote />
          </SpaceBetween>
        }
      />
      <input
        ref={file}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="프로젝트 JSON 파일"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      <Modal
        visible={creating}
        header="프로젝트 생성"
        onDismiss={() => !busy && setCreating(false)}
        closeAriaLabel="닫기"
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button disabled={busy} onClick={() => setCreating(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!name.trim() || name.length > 200}
              onClick={() =>
                void create({ ...newProject(), name: name.trim() })
              }
            >
              생성 후 열기
            </Button>
          </SpaceBetween>
        }
      >
        <Field
          label="프로젝트 이름"
          value={name}
          onChange={setName}
          description="업무·시스템·이관 범위를 구분할 수 있는 이름을 입력하세요."
        />
      </Modal>
    </>
  );
}
function BoxNote() {
  return (
    <p className="secondary">
      이 브라우저에 저장됩니다. 다른 기기에서는 프로젝트 JSON을 가져오세요.
      가져온 파일은 새 프로젝트로 추가하며 계산 결과를 현재 엔진으로 검증합니다.
    </p>
  );
}
