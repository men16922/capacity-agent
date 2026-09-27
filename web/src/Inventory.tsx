import { AssetEditor } from "./AssetEditor";
import { assessmentFields } from "./references";
import { useRef, useState } from "react";
import Papa from "papaparse";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import {
  assetErrors,
  memoryUsed,
  diskUsed,
  blankAsset,
  download,
  fmt,
  uid,
  type Asset,
  type Project,
} from "./domain";
import { Empty, PageHeading } from "./ui";

type Props = {
  project: Project;
  update: (p: Project) => void;
  migrate: (id: string) => void;
  navigate: (page: string, id?: string) => void;
  environment?: "onprem" | "aws";
  notify: (text: string, type?: "success" | "error" | "info") => void;
  loadDemo: () => void;
};
export function Inventory({
  project,
  update,
  migrate,
  notify,
  loadDemo,
  navigate,
  environment = "onprem",
}: Props) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Asset[]>([]);
  const [draft, setDraft] = useState<Asset | null>(null);

  const [deleting, setDeleting] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const shown = project.assets.filter((a) =>
    `${a.name} ${a.role} ${a.hardware ?? ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
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
        if (environment === "aws" && !asset.instance_type)
          errs.instance_type = "현재 EC2 유형이 필요합니다.";
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
      "memory_usage_mode",
      "peak_memory_percent",
      "disk_usage_mode",
      "disk_allocated_gib",
      "disk_used_percent",
      "instance_type",
      "current_iops",
      "current_throughput_mibps",
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
              "amount",
              "",
              "amount",
              "500",
              "",
              environment === "aws" ? "m8i.4xlarge" : "",
              environment === "aws" ? "6000" : "",
              environment === "aws" ? "200" : "",
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
        eyebrow={
          environment === "aws" ? "AWS · INVENTORY" : "ON-PREM · INVENTORY"
        }
        title={environment === "aws" ? "AWS 자산" : "서버 자산"}
        description={
          environment === "aws"
            ? "운영 중인 EC2와 gp3 사양·사용량을 정리하고 최적화 제안에 연결하세요."
            : "자산별 할당량과 사용량을 확인하고, 상세에서 용량 최적화와 AWS 마이그레이션을 시작하세요."
        }
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
        items={shown.slice(
          (Math.min(page, Math.max(1, Math.ceil(shown.length / 25))) - 1) * 25,
          Math.min(page, Math.max(1, Math.ceil(shown.length / 25))) * 25,
        )}
        pagination={
          <Pagination
            currentPageIndex={Math.min(
              page,
              Math.max(1, Math.ceil(shown.length / 25)),
            )}
            pagesCount={Math.max(1, Math.ceil(shown.length / 25))}
            onChange={(e) => setPage(e.detail.currentPageIndex)}
            ariaLabels={{
              nextPageLabel: "다음 페이지",
              previousPageLabel: "이전 페이지",
              pageLabel: (n) => `${n} 페이지`,
            }}
          />
        }
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
                  onClick={() =>
                    environment === "aws"
                      ? navigate("aws-optimize-detail", selected[0].id)
                      : migrate(selected[0].id)
                  }
                >
                  {environment === "aws" ? "최적화 →" : "AWS 마이그레이션 →"}
                </Button>
              </SpaceBetween>
            }
          >
            자산 목록
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
                  navigate(
                    environment === "aws" ? "aws-asset-detail" : "asset-detail",
                    a.id,
                  );
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
            header: "디스크 사용 / 할당",
            cell: (a) =>
              `${fmt(diskUsed(a))} / ${fmt(a.disk_allocated_gib)} GiB`,
          },
          {
            id: "usage",
            header: "CPU 피크 / 메모리 피크",
            cell: (a) =>
              `${fmt(a.peak_cpu_percent)} % / ${fmt(memoryUsed(a))} GiB`,
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
      {draft && (
        <AssetEditor
          asset={draft}
          isExisting={project.assets.some((a) => a.id === draft.id)}
          aws={environment === "aws"}
          onDismiss={() => setDraft(null)}
          onSave={(asset) => {
            const exists = project.assets.some((a) => a.id === asset.id);
            if (!exists && project.assets.length >= 200) {
              notify("프로젝트당 최대 200개 자산입니다.", "error");
              return;
            }
            update({
              ...project,
              assets: exists
                ? project.assets.map((a) => (a.id === asset.id ? asset : a))
                : [...project.assets, asset],
            });
            setDraft(null);
            setSelected([]);
            notify(
              "자산을 저장했습니다. 기존 산정안은 당시 사양을 유지합니다.",
            );
          }}
        />
      )}
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
