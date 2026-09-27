import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import {
  profileNames,
  type Project,
  type OptimizationScenario,
} from "./domain";
import { Empty, PageHeading } from "./ui";
export function OptimizationScenarios({
  project,
  environment,
  update,
  report,
  navigate,
}: {
  project: Project;
  environment: "onprem" | "aws";
  update: (p: Project) => void;
  report: (id: string) => void;
  navigate: (p: string, id?: string) => void;
}) {
  const [selected, setSelected] = useState<OptimizationScenario[]>([]);
  const [deleting, setDeleting] = useState(false);
  const items = (project.optimizations ?? []).filter(
    (s) => s.request.environment === environment,
  );
  const [a, b] = selected;
  const same =
    selected.length === 2 &&
    a.request.asset.id === b.request.asset.id &&
    a.result.model_version === b.result.model_version &&
    a.request.environment === b.request.environment;
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow={`${environment.toUpperCase()} · SCENARIOS`}
        title={environment === "aws" ? "최적화 시나리오" : "산정 시나리오"}
        description="저장한 입력과 결과를 검토합니다. 동일 자산·환경·모델 버전의 두 최적화안을 선택하면 비교할 수 있습니다."
        actions={
          <Button
            onClick={() =>
              navigate(environment === "aws" ? "aws-optimize" : "assets")
            }
          >
            자산에서 새 시나리오 만들기
          </Button>
        }
      />
      <Table
        items={items}
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={(e) => setSelected(e.detail.selectedItems)}
        ariaLabels={{
          allItemsSelectionLabel: () => "최적화 시나리오 전체 선택",
          selectionGroupLabel: "최적화 시나리오 선택",
          itemSelectionLabel: (_, s) => `${s.name} 선택`,
        }}
        header={
          <Header
            variant="h2"
            counter={`(${items.length})`}
            actions={
              <Button
                disabled={!selected.length}
                onClick={() => setDeleting(true)}
              >
                선택 삭제
              </Button>
            }
          >
            실사용 최적화 시나리오
          </Header>
        }
        columnDefinitions={[
          {
            id: "name",
            header: "시나리오",
            cell: (s) => (
              <Button
                variant="inline-link"
                onClick={() => report(`opt:${s.id}`)}
              >
                {s.name}
              </Button>
            ),
          },
          { id: "asset", header: "자산", cell: (s) => s.request.asset.name },
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
          <Empty title="저장된 최적화 시나리오가 없습니다">
            자산 상세에서 사용량 기반으로 계산하고 검토 후 저장하세요.
          </Empty>
        }
      />
      {selected.length >= 2 &&
        (same ? (
          <Container
            header={
              <Header variant="h2">
                {a.name} ↔ {b.name}
              </Header>
            }
          >
            <Table
              variant="embedded"
              items={["vcpu", "memory_gib", "disk_gib"] as const}
              columnDefinitions={[
                {
                  id: "resource",
                  header: "자원",
                  cell: (k) =>
                    ({
                      vcpu: "CPU",
                      memory_gib: "메모리 GiB",
                      disk_gib: "디스크 GiB",
                    })[k],
                },
                {
                  id: "a",
                  header: a.name,
                  cell: (k) => a.result.requirements?.[k].minimum,
                },
                {
                  id: "b",
                  header: b.name,
                  cell: (k) => b.result.requirements?.[k].minimum,
                },
                {
                  id: "delta",
                  header: "두 번째 − 첫 번째",
                  cell: (k) =>
                    (b.result.requirements?.[k].minimum ?? 0) -
                    (a.result.requirements?.[k].minimum ?? 0),
                },
              ]}
            />
          </Container>
        ) : (
          <Alert type="warning">
            동일 자산·환경·모델 버전의 최적화안 두 개만 선택하세요.
          </Alert>
        ))}
      {environment === "onprem" && (
        <Table
          items={project.calculations}
          header={
            <Header
              variant="h2"
              counter={`(${project.calculations.length})`}
              actions={
                <Button onClick={() => navigate("calculator")}>
                  업무 요구량 산정
                </Button>
              }
            >
              TTA·네트워크 업무 요구량
            </Header>
          }
          columnDefinitions={[
            {
              id: "name",
              header: "산정 이름",
              cell: (s) => (
                <Button
                  variant="inline-link"
                  onClick={() => report(`calc:${s.id}`)}
                >
                  {s.name}
                </Button>
              ),
            },
            {
              id: "model",
              header: "모델",
              cell: (s) => profileNames[s.request.profile_id],
            },
            {
              id: "target",
              header: "산정 대상",
              cell: (s) =>
                Array.from(
                  new Set(s.request.calculations.map((c) => c.system_id)),
                ).join(", "),
            },
            {
              id: "count",
              header: "계산식 수",
              cell: (s) => s.request.calculations.length,
            },
          ]}
          empty={
            <Empty title="저장한 업무 요구량 산정이 없습니다">
              TTA·네트워크 계산은 실사용 최적화와 단위·목적이 다릅니다.
            </Empty>
          }
        />
      )}
      <Modal
        visible={deleting}
        header="최적화 시나리오 삭제"
        closeAriaLabel="닫기"
        onDismiss={() => setDeleting(false)}
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button onClick={() => setDeleting(false)}>취소</Button>
            <Button
              variant="primary"
              onClick={() => {
                update({
                  ...project,
                  optimizations: (project.optimizations ?? []).filter(
                    (s) => !selected.some((x) => x.id === s.id),
                  ),
                });
                setSelected([]);
                setDeleting(false);
              }}
            >
              삭제
            </Button>
          </SpaceBetween>
        }
      >
        선택한 {selected.length}개 최적화안을 삭제합니다. 원본 자산은
        유지됩니다.
      </Modal>
    </SpaceBetween>
  );
}
