import { unitLabel } from "./references";
import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import {
  delta,
  download,
  fmt,
  formulaNames,
  money,
  percentChange,
  type Bootstrap,
  type Project,
  type Scenario,
} from "./domain";
import {
  Choice,
  Empty,
  Mapping,
  Metric,
  PageHeading,
  SourceLink,
  InputEvidence,
} from "./ui";
import { planLabels } from "./Migration";

export function Scenarios({
  project,
  update,
  edit,
  report,
  start,
}: {
  project: Project;
  update: (p: Project) => void;
  edit: (s: Scenario) => void;
  report: (id: string) => void;
  start: () => void;
}) {
  const [selected, setSelected] = useState<Scenario[]>([]);
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState(false);
  const a = selected[0],
    b = selected[1];
  const first = a?.result.candidates?.find(
    (c) => c.instance_type === a.selected,
  );
  const second = b?.result.candidates?.find(
    (c) => c.instance_type === b.selected,
  );
  const same =
    a &&
    b &&
    a.request.asset.id === b.request.asset.id &&
    a.result.provenance?.region === b.result.provenance?.region &&
    a.result.provenance?.model === b.result.provenance?.model;
  const rows =
    same && first && second
      ? [
          [
            "CPU 요구량 / 노드",
            a.result.requirements!.vcpu.value,
            b.result.requirements!.vcpu.value,
            "vCPU",
          ],
          [
            "메모리 요구량 / 노드",
            a.result.requirements!.memory_gib.value,
            b.result.requirements!.memory_gib.value,
            "GiB",
          ],
          [
            "gp3 용량 / 노드",
            String(a.result.storage!.size_gib),
            String(b.result.storage!.size_gib),
            "GiB",
          ],
          ["선택한 vCPU / 노드", first.vcpu, second.vcpu, "vCPU"],
          ...(first.cost.total_monthly !== null &&
          second.cost.total_monthly !== null
            ? [
                [
                  "EC2 + EBS / 월",
                  first.cost.total_monthly,
                  second.cost.total_monthly,
                  "USD",
                ],
              ]
            : []),
        ]
      : [];
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="AWS PLANNING"
        title="이전안·시나리오 비교"
        description="같은 서버의 가정을 바꿔 비교하세요. 저장 시점의 원본과 계산 근거를 함께 보존합니다."
        actions={
          <Button variant="primary" onClick={start}>
            새 이전안
          </Button>
        }
      />
      <Table
        items={project.scenarios
          .filter((s) =>
            `${s.name} ${s.request.asset.name} ${s.selected}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .slice()
          .reverse()}
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={(e) => setSelected(e.detail.selectedItems.slice(-2))}
        ariaLabels={{
          selectionGroupLabel: "이전안 최대 두 개 선택",
          itemSelectionLabel: (_, s) => `${s.name} 선택`,
          allItemsSelectionLabel: () => "최근 두 개 이전안 선택",
        }}
        header={
          <Header
            variant="h2"
            counter={`(${project.scenarios.length})`}
            description="최대 2개를 선택하면 입력·결과 차이를 비교합니다."
            actions={
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  disabled={selected.length !== 1}
                  onClick={() => edit(selected[0])}
                >
                  복제하여 수정
                </Button>
                <Button
                  disabled={selected.length !== 1}
                  onClick={() => report(selected[0].id)}
                >
                  산정서 보기
                </Button>
                <Button
                  disabled={!selected.length}
                  onClick={() => setDeleting(true)}
                >
                  삭제
                </Button>
              </SpaceBetween>
            }
          >
            저장한 AWS 이전안
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            onChange={(e) => setFilter(e.detail.filteringText)}
            filteringPlaceholder="이전안·서버·인스턴스 검색"
            filteringAriaLabel="이전안 검색"
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: "이전안",
            cell: (s) => (
              <Button variant="inline-link" onClick={() => report(s.id)}>
                {s.name}
              </Button>
            ),
          },
          {
            id: "asset",
            header: "원본 서버",
            cell: (s) => s.request.asset.name,
          },
          {
            id: "target",
            header: "AWS 구성",
            cell: (s) => (
              <>
                {s.selected || "후보 재검토"}
                <div className="secondary">
                  {String(s.request.plan.target_nodes)}개 노드 ·{" "}
                  {s.request.plan.mode === "measured"
                    ? "실측 경로"
                    : "확정 사양"}
                </div>
              </>
            ),
          },
          {
            id: "cost",
            header: "월 예상 소계",
            cell: (s) =>
              money(
                s.result.candidates?.find((c) => c.instance_type === s.selected)
                  ?.cost.total_monthly,
              ),
          },
          {
            id: "date",
            header: "저장일",
            cell: (s) => new Date(s.savedAt).toLocaleString("ko-KR"),
          },
        ]}
        empty={
          <Empty
            title="저장된 이전안이 없습니다"
            action={<Button onClick={start}>AWS 이전 설계 시작</Button>}
          >
            EC2·EBS 후보를 선택한 뒤 이전안을 저장하세요.
          </Empty>
        }
      />
      {a && b && !same && (
        <Alert type="warning">
          같은 원본 서버·리전·계산 모델의 이전안을 선택하세요. 서로 다른 조건의
          결과에는 변화율을 표시하지 않습니다.
        </Alert>
      )}
      {rows.length > 0 && (
        <Container
          header={
            <Header variant="h2" description={`${a.name} → ${b.name}`}>
              시나리오 차이
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Table
              variant="embedded"
              items={rows}
              columnDefinitions={[
                { id: "metric", header: "비교 항목", cell: (r) => r[0] },
                {
                  id: "a",
                  header: "기준안",
                  cell: (r) => `${fmt(r[1])} ${r[3]}`,
                },
                {
                  id: "b",
                  header: "비교안",
                  cell: (r) => `${fmt(r[2])} ${r[3]}`,
                },
                {
                  id: "diff",
                  header: "차이",
                  cell: (r) => `${fmt(delta(r[1], r[2]))} ${r[3]}`,
                },
                {
                  id: "percent",
                  header: "변화율",
                  cell: (r) => {
                    const p = percentChange(r[1], r[2]);
                    return p === null ? "기준값 0 · 계산 불가" : `${fmt(p)} %`;
                  },
                },
              ]}
            />
            <Table
              variant="embedded"
              items={Object.keys({
                ...a.request.plan,
                ...b.request.plan,
              }).filter((k) => a.request.plan[k] !== b.request.plan[k])}
              columnDefinitions={[
                {
                  id: "input",
                  header: "변경한 가정",
                  cell: (key) => planLabels[key] ?? key,
                },
                {
                  id: "a",
                  header: "기준안 입력",
                  cell: (key) => String(a.request.plan[key]),
                },
                {
                  id: "b",
                  header: "비교안 입력",
                  cell: (key) => String(b.request.plan[key]),
                },
              ]}
              empty={<Box>이전 조건 입력이 같습니다.</Box>}
            />
            <Box color="text-body-secondary">
              비용 변화는 EC2·EBS 범위입니다. 절감 효과를 확정하려면 동일 범위의
              On-Prem 비용·라이선스·이관 비용을 추가로 검토해야 합니다.
            </Box>
          </SpaceBetween>
        </Container>
      )}
      <Modal
        visible={deleting}
        onDismiss={() => setDeleting(false)}
        header="선택한 이전안 삭제"
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
                    scenarios: project.scenarios.filter(
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
          </Box>
        }
      >
        {selected.length}개 이전안을 브라우저 저장소에서 삭제합니다. On-Prem
        자산은 유지됩니다.
      </Modal>
    </SpaceBetween>
  );
}

export function Reports({
  project,
  bootstrap,
  selectedId,
  setSelectedId,
}: {
  project: Project;
  bootstrap: Bootstrap;
  selectedId: string;
  setSelectedId: (id: string) => void;
}) {
  const options = [
    ...project.scenarios.map((s) => ({
      value: s.id,
      label: `AWS · ${s.name}`,
    })),
    ...project.calculations.map((c) => ({
      value: `calc:${c.id}`,
      label: `On-Prem · ${c.name}`,
    })),
  ];
  const effectiveId = options.some((o) => o.value === selectedId)
    ? selectedId
    : (options.at(-1)?.value ?? "");
  const scenario = project.scenarios.find((s) => s.id === effectiveId);
  const calc = project.calculations.find((c) => `calc:${c.id}` === effectiveId);
  const candidate = scenario?.result.candidates?.find(
    (c) => c.instance_type === scenario.selected,
  );
  function exportJson() {
    const data = scenario ?? calc;
    if (data)
      download(
        `capacity-report-${data.id}.json`,
        JSON.stringify(
          {
            report_version: 1,
            project_name: project.name,
            type: scenario ? "migration" : "sizing",
            ...data,
          },
          null,
          2,
        ),
      );
  }
  return (
    <SpaceBetween size="l">
      <div className="no-print">
        <PageHeading
          eyebrow="EVIDENCE & DELIVERABLES"
          title="산정서"
          description="입력·가정·결과·출처를 검토 가능한 문서로 보존합니다."
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button
                disabled={!scenario && !calc}
                iconName="download"
                onClick={exportJson}
              >
                산정서 JSON
              </Button>
              <Button
                disabled={!scenario && !calc}
                variant="primary"
                iconName="file"
                onClick={() => {
                  const report = document.querySelector(".report");
                  const root = document.getElementById("print-root");
                  if (report && root) {
                    root.replaceChildren(report.cloneNode(true));
                    window.print();
                  }
                }}
              >
                인쇄 / PDF 저장
              </Button>
            </SpaceBetween>
          }
        />
      </div>
      {!options.length ? (
        <Container>
          <Empty title="출력할 산정 결과가 없습니다">
            On-Prem 계산 결과 또는 AWS 이전안을 먼저 저장하세요.
          </Empty>
        </Container>
      ) : (
        <>
          <div className="no-print">
            <Choice
              label="출력할 산정 결과"
              value={effectiveId}
              options={options}
              onChange={setSelectedId}
            />
          </div>
          <article className="report">
            <div className="report-masthead">
              <div>
                <div className="eyebrow">
                  CAPACITY AGENT ·{" "}
                  {scenario ? "AWS MIGRATION" : "ON-PREM SIZING"}
                </div>
                <h1>{scenario?.name ?? calc?.name}</h1>
                <p>{project.name}</p>
              </div>
              <div className="report-stamp">
                설계 산정서{project.demo && <span>예제 프로젝트</span>}
              </div>
            </div>
            {scenario && candidate ? (
              <SpaceBetween size="l">
                <Mapping
                  asset={scenario.request.asset}
                  candidate={candidate}
                  result={scenario.result}
                />
                <section>
                  <h2>01 · 산정 개요</h2>
                  <div className="report-facts">
                    <div>
                      <span>산정 경로</span>
                      <strong>
                        {scenario.request.plan.mode === "measured"
                          ? "실측 사용량"
                          : "확정 사양"}
                      </strong>
                    </div>
                    <div>
                      <span>리전 / OS</span>
                      <strong>
                        {String(scenario.request.plan.region)} /{" "}
                        {String(scenario.request.plan.os)}
                      </strong>
                    </div>
                    <div>
                      <span>계산 모델</span>
                      <strong>{scenario.result.provenance?.model}</strong>
                    </div>
                    <div>
                      <span>공식 사양 확인</span>
                      <strong>
                        {scenario.result.provenance?.catalog_verified_on}
                      </strong>
                    </div>
                  </div>
                </section>
                <section>
                  <h2>02 · 원본 사양과 근거</h2>
                  <p>
                    {scenario.request.asset.name} ·{" "}
                    {scenario.request.asset.role} ·{" "}
                    {scenario.request.asset.hardware}
                  </p>
                  <Table
                    variant="embedded"
                    items={[
                      ["할당 논리 CPU", scenario.request.asset.vcpu, "개"],
                      ["할당 메모리", scenario.request.asset.memory_gib, "GiB"],
                      [
                        "CPU 피크",
                        scenario.request.asset.peak_cpu_percent,
                        "%",
                      ],
                      [
                        "메모리 피크",
                        scenario.request.asset.peak_memory_gib,
                        "GiB",
                      ],
                      [
                        "논리 디스크 사용량",
                        scenario.request.asset.disk_gib,
                        "GiB",
                      ],
                    ]}
                    columnDefinitions={[
                      { id: "k", header: "입력", cell: (r) => r[0] },
                      {
                        id: "v",
                        header: "값",
                        cell: (r) => `${fmt(r[1])} ${r[2]}`,
                      },
                    ]}
                  />
                  <p>
                    측정 기준일: {scenario.request.asset.observed_on} ·{" "}
                    {scenario.request.asset.source || "미입력"}
                  </p>
                </section>
                <section>
                  <h2>03 · 이전 조건</h2>
                  <Table
                    variant="embedded"
                    items={Object.entries(scenario.request.plan)}
                    columnDefinitions={[
                      {
                        id: "k",
                        header: "가정",
                        cell: ([k]) => planLabels[k] ?? k,
                      },
                      {
                        id: "v",
                        header: "값",
                        cell: ([, v]) =>
                          typeof v === "boolean"
                            ? v
                              ? "확인함"
                              : "미확인"
                            : String(v),
                      },
                    ]}
                  />
                </section>
                <section>
                  <h2>04 · 계산 과정</h2>
                  <Table
                    variant="embedded"
                    items={scenario.result.trace ?? []}
                    columnDefinitions={[
                      { id: "k", header: "계산", cell: (t) => t.name },
                      { id: "e", header: "식", cell: (t) => t.expression },
                      {
                        id: "v",
                        header: "산정 원값",
                        cell: (t) => `${t.value} ${t.unit}`,
                      },
                    ]}
                  />
                </section>
                <section>
                  <h2>05 · 월 예상 비용</h2>
                  <ColumnLayout columns={3}>
                    <Metric
                      label="EC2"
                      value={money(candidate.cost.compute_monthly)}
                    />
                    <Metric
                      label="gp3 EBS"
                      value={money(candidate.cost.ebs_monthly)}
                    />
                    <Metric
                      label="소계"
                      value={money(candidate.cost.total_monthly)}
                    />
                  </ColumnLayout>
                  <p>
                    {candidate.cost.scope} · {candidate.cost.hours}시간 ·{" "}
                    {candidate.cost.nodes}개 노드
                  </p>
                  <p>
                    gp3 세부: 용량 {money(candidate.cost.ebs_breakdown.storage)}
                    , 추가 IOPS {money(candidate.cost.ebs_breakdown.iops)}, 추가
                    처리량 {money(candidate.cost.ebs_breakdown.throughput)}
                  </p>
                  <p>
                    단가 조건: {String(scenario.request.plan.os)} / Shared /
                    On-Demand / USD · 시간당 $
                    {candidate.cost.hourly_price?.usd ?? "미확인"} · 유효일{" "}
                    {candidate.cost.hourly_price?.effective_date ?? "미확인"}
                  </p>
                  <p>
                    제외: {candidate.cost.excluded.join(", ")}. 실제 청구액 또는
                    전체 TCO가 아닙니다.
                  </p>
                </section>
                <section>
                  <h2>06 · 확인할 사항</h2>
                  <ul>
                    {scenario.result.warnings?.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p>
                    보안 점검 상태: 미점검. 2024.06 가이드의 제품별 적용 항목과
                    실제 설정 증적은 별도 확인합니다.
                  </p>
                </section>
                <section className="report-sources">
                  <h2>07 · 근거 문서</h2>
                  <ol>
                    <li>
                      <SourceLink id="xlsx-d6bfd84a3ce8">
                        TTA R3 · AWS 워크북
                      </SourceLink>{" "}
                      · AWS EC2!B39:B42, B55:B70 ·{" "}
                      {scenario.result.provenance?.source_sha256}
                    </li>
                    <li>
                      <Link external href={candidate.spec_url}>
                        AWS EC2 공식 사양
                      </Link>
                      <span>{candidate.spec_url}</span>
                    </li>
                    <li>
                      <Link external href={scenario.result.storage?.source_url}>
                        AWS gp3 공식 사양
                      </Link>
                      <span>{scenario.result.storage?.source_url}</span>
                    </li>
                    <li>
                      <Link
                        external
                        href={candidate.cost.hourly_price?.source_url}
                      >
                        AWS 공식 가격표
                      </Link>{" "}
                      · SKU {candidate.cost.hourly_price?.sku} · 가격표 버전{" "}
                      {scenario.result.provenance?.price_version}
                    </li>
                    <li>
                      <SourceLink id="pdf-1e5aa3fe692c" page={7}>
                        클라우드 취약점 점검 가이드(2024.06)
                      </SourceLink>{" "}
                      · 적용 범위 p.7~8
                    </li>
                  </ol>
                  <p>
                    카탈로그: {scenario.result.provenance?.catalog_version}
                    <br />
                    SHA-256: {scenario.result.provenance?.catalog_sha256}
                  </p>
                </section>
              </SpaceBetween>
            ) : scenario ? (
              <Alert type="warning">
                저장한 후보를 현재 결과에서 찾을 수 없습니다. 이전안을 복제해
                다시 계산하세요.
              </Alert>
            ) : calc ? (
              <SpaceBetween size="l">
                <p>
                  프로파일 {calc.request.profile_id} · 규칙{" "}
                  {calc.request.rule_version} · 기준일 {calc.request.as_of}
                </p>
                <section>
                  <h2>01 · 가정</h2>
                  <ul>
                    {calc.request.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2>02 · 자원별 결과</h2>
                  <Table
                    variant="embedded"
                    items={calc.result.results}
                    columnDefinitions={[
                      {
                        id: "name",
                        header: "계산 항목",
                        cell: (r) =>
                          `${r.system_id} · ${formulaNames[r.formula_id] ?? r.formula_id}`,
                      },
                      {
                        id: "value",
                        header: "산정 원값",
                        cell: (r) =>
                          r.raw_value == null ? (
                            "미산정"
                          ) : (
                            <>
                              {r.raw_value} {unitLabel(r.unit)}
                              <div className="secondary">
                                정확값 {r.exact_value?.numerator} /{" "}
                                {r.exact_value?.denominator}
                              </div>
                            </>
                          ),
                      },
                      {
                        id: "source",
                        header: "원문 근거",
                        cell: (r) =>
                          r.source_refs?.map((s) => (
                            <SourceLink
                              key={s.source_id}
                              id={s.source_id}
                              page={s.pages[0]}
                            >
                              {bootstrap.documents.find(
                                (d) => d.id === `sources/${s.source_id}.md`,
                              )?.title ?? "산정 참고 자료"}{" "}
                              · PDF p.{s.pages.join(",")}
                            </SourceLink>
                          )),
                      },
                    ]}
                  />
                </section>
                {calc.request.calculations.map((j) => (
                  <section key={j.id}>
                    <h2>
                      {j.system_id} ·{" "}
                      {formulaNames[j.formula_id] ?? j.formula_id}
                    </h2>
                    <code>
                      {
                        calc.result.results.find((r) => r.id === j.id)?.trace
                          ?.expression
                      }
                    </code>
                    <Table
                      variant="embedded"
                      items={Object.entries(j.inputs)}
                      columnDefinitions={[
                        { id: "k", header: "입력", cell: ([k]) => k },
                        {
                          id: "v",
                          header: "값·단위",
                          cell: ([, v]) =>
                            `${v.result_ref ? `참조: ${v.result_ref}` : v.value} ${unitLabel(v.unit)}`,
                        },
                        {
                          id: "e",
                          header: "근거·기준일",
                          cell: ([, v]) => (
                            <>
                              <InputEvidence
                                input={v}
                                sourceId={
                                  bootstrap.formulas.find(
                                    (f) => f.id === j.formula_id,
                                  )?.source_id
                                }
                              />
                              <div>입력 기준일 {v.as_of ?? "동일 실행"}</div>
                            </>
                          ),
                        },
                      ]}
                    />
                  </section>
                ))}
                <section>
                  <h2>적용 범위</h2>
                  <p>
                    산정값은 장비의 실측 성능·구매 적합성·장애 전환·보안 검수
                    결과를 뜻하지 않습니다. 원문 MB를 MiB로 자동 환산하지
                    않습니다.
                  </p>
                </section>
              </SpaceBetween>
            ) : null}
            <footer className="report-footer">
              Capacity Agent · 로컬 계산 · 출처 {bootstrap.source_count}개 ·
              입력과 버전은 JSON으로 보존할 수 있습니다.
            </footer>
          </article>
        </>
      )}
    </SpaceBetween>
  );
}
