import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { memoryUsed, fmt, sum, type Project } from "./domain";
import { Empty, Metric, PageHeading, StepCard } from "./ui";

type Props = {
  project: Project;
  navigate: (page: string, id?: string) => void;
  loadDemo: () => void;
};
export function Dashboard({ project, navigate, loadDemo }: Props) {
  const onprem = project.assets;
  const aws = project.awsAssets ?? [];
  const optimizations = project.optimizations ?? [];
  const measured = onprem.filter(
    (a) => a.peak_cpu_percent && memoryUsed(a) && a.source,
  ).length;
  const migrated = new Set(
    project.scenarios
      .filter((s) => onprem.some((a) => a.id === s.request.asset.id))
      .map((s) => s.request.asset.id),
  ).size;
  const awsOptimized = new Set(
    optimizations
      .filter(
        (s) =>
          s.request.environment === "aws" &&
          aws.some((a) => a.id === s.request.asset.id),
      )
      .map((s) => s.request.asset.id),
  ).size;
  const activities = [
    ...project.calculations.map((c) => ({
      id: c.id,
      name: c.name,
      type: "TTA·네트워크 용량산정",
      at: c.savedAt ?? "",
      target: "onprem-scenarios",
    })),
    ...project.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      type: "AWS 마이그레이션",
      at: s.savedAt,
      target: "scenarios",
    })),
    ...optimizations.map((s) => ({
      id: s.id,
      name: s.name,
      type: `${s.request.environment === "aws" ? "AWS" : "On-Prem"} 최적화`,
      at: s.savedAt,
      target:
        s.request.environment === "aws"
          ? "aws-optimization-scenarios"
          : "onprem-scenarios",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="PROJECT OVERVIEW"
        title="통합 대시보드"
        description={`${project.name}의 On-Prem 자산과 AWS 마이그레이션·최적화 진행 현황입니다.`}
        actions={
          <Button
            variant="primary"
            iconName="add-plus"
            onClick={() => navigate("assets")}
          >
            자산 등록·가져오기
          </Button>
        }
      />
      <Container header={<Header variant="h2">프로젝트 현황</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <Metric
            label="On-Prem 자산"
            value={onprem.length}
            unit="개"
            note={`논리 CPU ${fmt(sum(onprem.map((a) => a.vcpu)), 0)} · 메모리 ${fmt(sum(onprem.map((a) => a.memory_gib)))} GiB`}
          />
          <Metric
            label="AWS 운영 자산"
            value={aws.length}
            unit="개"
            note="현재 EC2로 직접 등록한 자산"
          />
          <Metric
            label="저장한 마이그레이션안"
            value={project.scenarios.length}
            unit="개"
            note={`${migrated}개 원본 자산 연결`}
          />
          <Metric
            label="저장한 최적화안"
            value={optimizations.length}
            unit="개"
            note={`On-Prem ${optimizations.filter((s) => s.request.environment === "onprem").length} · AWS ${optimizations.filter((s) => s.request.environment === "aws").length}`}
          />
        </ColumnLayout>
      </Container>
      <div className="dashboard-grid">
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button onClick={() => navigate("assets")}>자산 목록</Button>
              }
            >
              On-Prem
            </Header>
          }
        >
          <SpaceBetween size="l">
            <div className="progress-row">
              <span>CPU·메모리 측정 및 근거 입력</span>
              <strong>
                {measured} / {onprem.length}
              </strong>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${onprem.length ? (measured / onprem.length) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="secondary">
              자산 상세에서 할당량·사용률을 확인하고 실사용 최적화안을 만드세요.
              신규 업무 요구량은 TTA·네트워크 모델로 별도 산정합니다.
            </p>
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => navigate("calculator")}>용량산정</Button>
              <Button onClick={() => navigate("onprem-scenarios")}>
                산정 시나리오 (
                {project.calculations.length +
                  optimizations.filter(
                    (s) => s.request.environment === "onprem",
                  ).length}
                )
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </Container>
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button onClick={() => navigate("aws-assets")}>
                  AWS 자산 목록
                </Button>
              }
            >
              AWS
            </Header>
          }
        >
          <SpaceBetween size="l">
            <div className="progress-row">
              <span>마이그레이션 검토·저장</span>
              <strong>
                {migrated} / {onprem.length} 자산
              </strong>
            </div>
            <div className="progress-row">
              <span>운영 AWS 자산 최적화안 저장</span>
              <strong>
                {awsOptimized} / {aws.length} 자산
              </strong>
            </div>
            <p className="secondary">
              On-Prem 이전 후보와 현재 운영하는 AWS 자산을 구분합니다. 최적화
              제안의 비용은 EC2 On-Demand·gp3 예상치입니다.
            </p>
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => navigate("migrate")}>
                AWS 마이그레이션
              </Button>
              <Button onClick={() => navigate("aws-optimize")}>
                사용률 기반 최적화
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </Container>
      </div>
      {onprem.length > measured && (
        <Alert
          type="warning"
          action={
            <Button onClick={() => navigate("assets")}>측정값 확인</Button>
          }
        >
          {onprem.length - measured}개 On-Prem 자산에 CPU·메모리 사용량 또는
          측정 근거가 필요합니다.
        </Alert>
      )}
      {!onprem.length && !aws.length && (
        <Container>
          <Empty
            title="프로젝트의 첫 자산을 등록하세요"
            action={
              <SpaceBetween direction="horizontal" size="s">
                <Button onClick={() => navigate("assets")}>
                  On-Prem 자산 등록
                </Button>
                <Button onClick={() => navigate("aws-assets")}>
                  AWS 자산 등록
                </Button>
                <Button onClick={loadDemo}>예제 프로젝트 추가</Button>
              </SpaceBetween>
            }
          >
            CSV로 여러 자산을 함께 등록하고 각 상세에서 확인할 수 있습니다.
          </Empty>
        </Container>
      )}
      <Table
        items={activities}
        header={
          <Header
            variant="h2"
            actions={
              <Button onClick={() => navigate("reports")}>산정서 보기</Button>
            }
          >
            최근 저장한 설계
          </Header>
        }
        columnDefinitions={[
          {
            id: "name",
            header: "이름",
            cell: (r) => (
              <Button variant="inline-link" onClick={() => navigate(r.target)}>
                {r.name}
              </Button>
            ),
          },
          { id: "type", header: "작업", cell: (r) => r.type },
          {
            id: "date",
            header: "저장 시각",
            cell: (r) =>
              r.at ? new Date(r.at).toLocaleString("ko-KR") : "기존 저장 결과",
          },
        ]}
        empty={
          <Empty title="저장한 설계가 없습니다">
            자산별 조건을 계산하고 검토 후 저장하면 이곳에 표시됩니다.
          </Empty>
        }
      />
      <ColumnLayout columns={3}>
        <StepCard
          number="01"
          title="자산과 측정값"
          description="On-Prem과 AWS의 현재 사양을 프로젝트별로 정리합니다."
          onClick={() => navigate("assets")}
        />
        <StepCard
          number="02"
          title="산정·마이그레이션·최적화"
          description="업무 요구량과 실사용 측정값에 맞는 모델을 선택합니다."
          onClick={() => navigate("calculator")}
        />
        <StepCard
          number="03"
          title="시나리오와 산정서"
          description="가정과 근거를 보존한 결과를 비교하고 공유합니다."
          onClick={() => navigate("reports")}
        />
      </ColumnLayout>
    </SpaceBetween>
  );
}
