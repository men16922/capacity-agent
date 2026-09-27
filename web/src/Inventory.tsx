import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Link from "@cloudscape-design/components/link";
import { ASSESSMENT_REFERENCE, assessmentFields } from "./references";
import { useRef, useState } from "react";
import Papa from "papaparse";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import {
  assetErrors,
  blankAsset,
  download,
  fmt,
  money,
  sum,
  uid,
  type Asset,
  type Project,
} from "./domain";
import {
  Choice,
  Empty,
  Field,
  Mapping,
  Metric,
  PageHeading,
  StepCard,
} from "./ui";

type Props = {
  project: Project;
  update: (p: Project) => void;
  migrate: (id: string) => void;
  navigate: (page: string) => void;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  loadDemo: () => void;
};
export function Dashboard({ project, migrate, navigate, loadDemo }: Props) {
  const measured = project.assets.filter(
    (a) => a.peak_cpu_percent && a.peak_memory_gib,
  ).length;
  const linked = new Set(
    project.scenarios
      .filter((s) => project.assets.some((a) => a.id === s.request.asset.id))
      .map((s) => s.request.asset.id),
  ).size;
  const last = project.scenarios.at(-1);
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="INFRASTRUCTURE WORKSPACE"
        title="인프라 설계 대시보드"
        description="현재 사양을 이해하고, 근거를 따라 다음 구성을 설계하세요."
        actions={
          <Button
            variant="primary"
            iconName="add-plus"
            onClick={() => navigate("assets")}
          >
            서버 자산 관리
          </Button>
        }
      />
      <section className="migration-hero">
        <div>
          <div className="hero-kicker">ON-PREM → AWS</div>
          <h2>
            현재 인프라에서
            <br />
            다음 아키텍처까지.
          </h2>
          <p>
            서버 사양과 실제 사용량을 AWS 요구량으로 연결합니다.
            <br />
            EC2 후보, 스토리지, 비용과 계산 근거를 한 번에 검토하세요.
          </p>
          <SpaceBetween direction="horizontal" size="s">
            <Button
              variant="primary"
              onClick={() =>
                project.assets.length ? navigate("migrate") : navigate("assets")
              }
            >
              AWS 이전 설계 시작
            </Button>
            {!project.assets.length && (
              <Button onClick={loadDemo}>예제로 둘러보기</Button>
            )}
          </SpaceBetween>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <div className="rack">
            <span />
            <span />
            <span />
          </div>
          <span className="hero-path">······→</span>
          <div className="cloud-symbol">
            <span>EC2</span>
            <span>EBS</span>
          </div>
          <small>사양 · 사용량 · 근거</small>
        </div>
      </section>
      <Container>
        <ColumnLayout columns={4} variant="text-grid">
          <Metric
            label="서버 자산"
            value={project.assets.length}
            unit="개"
            note="현재 프로젝트에 등록한 서버"
          />
          <Metric
            label="할당 논리 CPU"
            value={fmt(sum(project.assets.map((a) => a.vcpu)), 0)}
            unit="개"
            note="물리 코어 수와 구분"
          />
          <Metric
            label="할당 메모리"
            value={fmt(sum(project.assets.map((a) => a.memory_gib)))}
            unit="GiB"
            note="등록 자산의 합계"
          />
          <Metric
            label="AWS 이전안 연결"
            value={`${linked} / ${project.assets.length}`}
            note="자산별 저장한 이전안"
          />
        </ColumnLayout>
      </Container>
      <div className="two-column">
        <Container
          header={
            <Header
              variant="h2"
              counter={`(${project.assets.length})`}
              actions={
                <Button
                  variant="inline-link"
                  onClick={() => navigate("assets")}
                >
                  전체 보기
                </Button>
              }
            >
              서버 자산
            </Header>
          }
        >
          {project.assets.length ? (
            <Table
              variant="embedded"
              items={project.assets.slice(0, 5)}
              trackBy="id"
              columnDefinitions={[
                {
                  id: "name",
                  header: "서버",
                  cell: (a) => (
                    <Button variant="inline-link" onClick={() => migrate(a.id)}>
                      {a.name}
                    </Button>
                  ),
                },
                {
                  id: "role",
                  header: "역할",
                  cell: (a) => <Badge color="grey">{a.role}</Badge>,
                },
                {
                  id: "spec",
                  header: "논리 CPU / 메모리",
                  cell: (a) => `${a.vcpu} / ${a.memory_gib} GiB`,
                },
                {
                  id: "data",
                  header: "사용량",
                  cell: (a) => (
                    <StatusIndicator
                      type={
                        a.peak_cpu_percent && a.peak_memory_gib
                          ? "info"
                          : "pending"
                      }
                    >
                      {a.peak_cpu_percent && a.peak_memory_gib
                        ? "입력됨"
                        : "입력 필요"}
                    </StatusIndicator>
                  ),
                },
              ]}
            />
          ) : (
            <Empty
              title="첫 서버를 등록하세요"
              action={
                <Button onClick={() => navigate("assets")}>서버 추가</Button>
              }
            >
              사양을 직접 입력하거나 CSV로 가져올 수 있습니다.
            </Empty>
          )}
        </Container>
        <Container header={<Header variant="h2">설계 준비 현황</Header>}>
          <SpaceBetween size="l">
            <div className="progress-row">
              <span>사용량 입력</span>
              <strong>
                {measured} / {project.assets.length}
              </strong>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${project.assets.length ? (measured / project.assets.length) * 100 : 0}%`,
                }}
              />
            </div>
            <Box color="text-body-secondary">
              CPU 피크와 메모리 실사용이 있으면 실측 기반의 이전안을 계산할 수
              있습니다.
            </Box>
            <div className="review-row">
              <StatusIndicator type="info">
                원본 사양을 보존하는 이전안
              </StatusIndicator>
              <p>가정과 후보를 바꿔도 On-Prem 원본은 유지됩니다.</p>
            </div>
            <Button variant="normal" onClick={() => navigate("wiki")}>
              산정 기준 살펴보기
            </Button>
          </SpaceBetween>
        </Container>
      </div>
      {last && (
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button onClick={() => navigate("scenarios")}>
                  이전안 비교
                </Button>
              }
            >
              최근 AWS 이전안 · {last.name}
            </Header>
          }
        >
          <Mapping
            asset={last.request.asset}
            candidate={last.result.candidates?.find(
              (c) => c.instance_type === last.selected,
            )}
            result={last.result}
          />
        </Container>
      )}
      <ColumnLayout columns={3}>
        <StepCard
          number="01"
          title="자산 정리"
          description="현재 사양과 사용량의 기준을 맞춥니다."
          onClick={() => navigate("assets")}
        />
        <StepCard
          number="02"
          title="필요 용량 산정"
          description="TTA·네트워크 식으로 요구량을 계산합니다."
          onClick={() => navigate("calculator")}
        />
        <StepCard
          number="03"
          title="AWS 이전 설계"
          description="후보 사양과 비용을 검토하고 산정서를 만듭니다."
          onClick={() =>
            project.assets.length
              ? migrate(project.assets[0].id)
              : navigate("assets")
          }
        />
      </ColumnLayout>
    </SpaceBetween>
  );
}

export function Inventory({
  project,
  update,
  migrate,
  notify,
  loadDemo,
}: Props) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Asset[]>([]);
  const [draft, setDraft] = useState<Asset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const shown = project.assets.filter((a) =>
    `${a.name} ${a.role} ${a.hardware ?? ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  function save() {
    if (!draft) return;
    const e = assetErrors(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const exists = project.assets.some((a) => a.id === draft.id);
    if (!exists && project.assets.length >= 200) {
      notify("프로젝트당 최대 200개 서버를 등록할 수 있습니다.", "error");
      return;
    }
    update({
      ...project,
      assets: exists
        ? project.assets.map((a) => (a.id === draft.id ? draft : a))
        : [...project.assets, draft],
    });
    setSelected([]);
    setDraft(null);
    notify(
      exists
        ? "서버 사양을 수정했습니다. 저장된 이전안은 당시 사양을 유지합니다."
        : "서버 자산을 추가했습니다.",
    );
  }
  async function importCsv(file: File) {
    try {
      if (file.size > 1024 * 1024)
        throw new Error("CSV는 1MB 이하여야 합니다.");
      const parsed = Papa.parse<Record<string, string>>(await file.text(), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
      });
      if (Object.keys(parsed.meta.renamedHeaders ?? {}).length)
        throw new Error(
          "CSV 열 이름이 중복됩니다. 양식의 열 이름을 확인하세요.",
        );
      if (parsed.errors.length)
        throw new Error("CSV 열·따옴표 형식을 확인하세요.");
      if (
        !parsed.data.length ||
        parsed.data.length + project.assets.length > 200
      )
        throw new Error("1~200개 자산 범위에서 가져올 수 있습니다.");
      const rows = parsed.data.map((row, i) => {
        const allowed = Object.keys(blankAsset());
        const asset = {
          ...blankAsset(),
          ...Object.fromEntries(
            Object.entries(row).filter(([k]) => allowed.includes(k)),
          ),
          id: uid(),
        } as Asset;
        const errs = assetErrors(asset);
        if (Object.keys(errs).length)
          throw new Error(
            `${i + 2}행: ${Object.keys(errs).join(", ")} 값을 확인하세요.`,
          );
        return asset;
      });
      update({ ...project, assets: [...project.assets, ...rows] });
      notify(`${rows.length}개 서버를 가져왔습니다.`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  function template() {
    const fields = [
      "name",
      "role",
      "os",
      "architecture",
      "vcpu",
      "memory_gib",
      "disk_gib",
      "peak_cpu_percent",
      "peak_memory_gib",
      "iops",
      "throughput_mibps",
      "network_gbps",
      "source",
      "observed_on",
      "hardware",
      ...Object.keys(assessmentFields),
    ];
    download(
      "capacity-assets-template.csv",
      "\uFEFF" +
        Papa.unparse({
          fields,
          data: [
            [
              "예제 서버",
              "WEB/WAS",
              "Linux",
              "x86_64",
              "16",
              "64",
              "300",
              "35",
              "32",
              "6000",
              "200",
              "0.5",
              "예제 · 실제 측정값 아님",
              "2026-09-27",
              "VM",
              ...Object.keys(assessmentFields).map(() => ""),
            ],
          ],
        }),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="ON-PREM INVENTORY"
        title="서버 자산"
        description="현재 서버의 사양과 사용량을 등록합니다. 이 자산을 AWS 이전안에 연결할 수 있습니다."
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={template} iconName="download">
              CSV 양식
            </Button>
            <Button onClick={() => upload.current?.click()} iconName="upload">
              CSV 가져오기
            </Button>
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => {
                setDraft(blankAsset());
                setErrors({});
              }}
            >
              서버 추가
            </Button>
          </SpaceBetween>
        }
      />
      <input
        className="visually-hidden"
        type="file"
        accept=".csv,text/csv"
        ref={upload}
        aria-label="서버 CSV 파일"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importCsv(f);
          e.target.value = "";
        }}
      />
      <Table
        items={shown}
        trackBy="id"
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={(e) => setSelected(e.detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: "서버 선택",
          itemSelectionLabel: (_, a) => `${a.name} 선택`,
        }}
        header={
          <Header
            variant="h2"
            counter={`(${project.assets.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!selected.length}
                  onClick={() => {
                    setDraft({ ...selected[0] });
                    setErrors({});
                  }}
                >
                  수정
                </Button>
                <Button
                  disabled={!selected.length}
                  onClick={() => setDeleting(true)}
                >
                  삭제
                </Button>
                <Button
                  disabled={!selected.length}
                  onClick={() => migrate(selected[0].id)}
                >
                  AWS 이전 설계 →
                </Button>
              </SpaceBetween>
            }
          >
            등록된 서버
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            onChange={(e) => setFilter(e.detail.filteringText)}
            filteringPlaceholder="서버 이름, 역할, 하드웨어 검색"
            filteringAriaLabel="서버 검색"
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: "서버 이름",
            cell: (a) => (
              <Button
                variant="inline-link"
                onClick={() => {
                  setDraft({ ...a });
                  setErrors({});
                }}
              >
                {a.name}
              </Button>
            ),
          },
          {
            id: "role",
            header: "역할 / OS",
            cell: (a) => (
              <>
                <strong>{a.role}</strong>
                <div className="secondary">
                  {a.os} · {a.architecture}
                </div>
              </>
            ),
          },
          { id: "cpu", header: "논리 CPU", cell: (a) => fmt(a.vcpu, 0) },
          {
            id: "ram",
            header: "메모리",
            cell: (a) => `${fmt(a.memory_gib)} GiB`,
          },
          {
            id: "disk",
            header: "디스크 사용",
            cell: (a) => `${fmt(a.disk_gib)} GiB`,
          },
          {
            id: "usage",
            header: "CPU 피크 / 메모리 피크",
            cell: (a) =>
              `${fmt(a.peak_cpu_percent)} % / ${fmt(a.peak_memory_gib)} GiB`,
          },
          { id: "source", header: "측정 기준일", cell: (a) => a.observed_on },
        ]}
        empty={
          <Empty
            title="등록된 서버가 없습니다"
            action={
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  onClick={() => {
                    setDraft(blankAsset());
                    setErrors({});
                  }}
                >
                  서버 추가
                </Button>
                <Button onClick={loadDemo}>예제 불러오기</Button>
              </SpaceBetween>
            }
          >
            CSV 양식을 내려받아 여러 서버를 한 번에 가져올 수도 있습니다.
          </Empty>
        }
      />
      <Alert type="info">
        논리 CPU는 사용률을 측정한 분모와 일치시켜 주세요. 디스크는 RAID 원시
        용량이 아닌 OS·데이터·로그를 포함한 논리 사용량입니다. 실측값이 없으면
        비워 두고 AWS에서 확정 사양 경로를 선택할 수 있습니다.
      </Alert>
      <Modal
        visible={!!draft}
        onDismiss={() => setDraft(null)}
        size="large"
        header={
          draft && project.assets.some((a) => a.id === draft.id)
            ? "서버 자산 수정"
            : "서버 자산 추가"
        }
        closeAriaLabel="닫기"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDraft(null)}>
                취소
              </Button>
              <Button variant="primary" onClick={save}>
                서버 저장
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {draft && (
          <SpaceBetween size="l">
            <div className="form-grid">
              <Field
                id="asset-name"
                label="서버 이름"
                value={draft.name}
                error={errors.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />
              <Choice
                label="역할"
                value={draft.role}
                options={["WEB/WAS", "WEB", "WAS", "DB", "BATCH", "기타"].map(
                  (v) => ({ value: v, label: v }),
                )}
                onChange={(v) => setDraft({ ...draft, role: v })}
              />
              <Choice
                label="운영체제"
                value={draft.os}
                options={["Linux", "Windows"].map((v) => ({
                  value: v,
                  label: v,
                }))}
                onChange={(v) => setDraft({ ...draft, os: v })}
              />
              <Choice
                label="아키텍처"
                value={draft.architecture}
                options={["x86_64", "arm64"].map((v) => ({
                  value: v,
                  label: v,
                }))}
                onChange={(v) => setDraft({ ...draft, architecture: v })}
              />
              {(
                [
                  ["vcpu", "할당 논리 CPU", "개"],
                  ["memory_gib", "할당 메모리", "GiB"],
                  ["disk_gib", "논리 디스크 사용량", "GiB"],
                  ["peak_cpu_percent", "CPU 피크 사용률", "%"],
                  ["peak_memory_gib", "메모리 피크 실사용", "GiB"],
                  ["iops", "지속 IOPS", "IOPS"],
                  ["throughput_mibps", "스토리지 지속 처리량", "MiB/s"],
                  ["network_gbps", "네트워크 지속 요구량", "Gbps"],
                ] as const
              ).map(([key, label, unit]) => (
                <Field
                  key={key}
                  id={`asset-${key}`}
                  label={label}
                  unit={unit}
                  value={draft[key]}
                  error={errors[key]}
                  onChange={(v) => setDraft({ ...draft, [key]: v })}
                />
              ))}
              <Field
                label="측정 기준일"
                value={draft.observed_on}
                error={errors.observed_on}
                onChange={(v) => setDraft({ ...draft, observed_on: v })}
              />
              <Field
                label="하드웨어 / 가상화 정보"
                value={draft.hardware ?? ""}
                onChange={(v) => setDraft({ ...draft, hardware: v })}
              />
            </div>
            <ExpandableSection headerText="견적 검토 정보 (선택)">
              <SpaceBetween size="m">
                <Box>
                  알고 있는 정보만 입력하세요. 미입력은 확인되지 않은 항목으로
                  유지하며 EC2+EBS 계산에 포함되지 않는 검토 정보입니다.
                </Box>
                <Link external href={ASSESSMENT_REFERENCE.url}>
                  {ASSESSMENT_REFERENCE.title}
                </Link>
                <div className="form-grid">
                  {(
                    Object.entries(assessmentFields) as [
                      keyof typeof assessmentFields,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={draft[key] ?? ""}
                      error={errors[key]}
                      description={
                        key === "asset_type"
                          ? "물리 서버, 가상 서버, 하이퍼바이저, 컨테이너 등. 호스트와 게스트의 중복 산정 여부를 확인하세요."
                          : key === "environment"
                            ? "운영, 검증, 개발, 테스트 등"
                            : undefined
                      }
                      onChange={(v) => setDraft({ ...draft, [key]: v })}
                    />
                  ))}
                </div>
              </SpaceBetween>
            </ExpandableSection>
            <Field
              label="측정·사양 근거"
              value={draft.source}
              error={errors.source}
              description="측정 구간·백분위·모니터링 자료 등. 예제와 실제 측정값을 구분하세요."
              onChange={(v) => setDraft({ ...draft, source: v })}
            />
          </SpaceBetween>
        )}
      </Modal>
      <Modal
        visible={deleting}
        onDismiss={() => setDeleting(false)}
        header="서버 자산 삭제"
        closeAriaLabel="닫기"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => setDeleting(false)}>취소</Button>
              <Button
                variant="primary"
                onClick={() => {
                  update({
                    ...project,
                    assets: project.assets.filter(
                      (a) => a.id !== selected[0]?.id,
                    ),
                  });
                  setSelected([]);
                  setDeleting(false);
                }}
              >
                삭제
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {selected[0]?.name}을 현재 목록에서 삭제합니다. 저장된 이전안의 당시
        원본 사양은 보존됩니다.
      </Modal>
    </SpaceBetween>
  );
}
