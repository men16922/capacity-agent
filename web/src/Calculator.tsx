import { useEffect, useRef, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import Textarea from "@cloudscape-design/components/textarea";
import {
  api,
  copy,
  download,
  fieldNames,
  fmt,
  formulaNames,
  profileNames,
  TODAY,
  uid,
  type Bootstrap,
  type CalcRequest,
  type CalcResult,
  type Calculation,
} from "./domain";
import { Choice, Field, PageHeading, SourceLink, InputEvidence } from "./ui";

import { TTA_REFERENCE, unitLabel, unitOptions } from "./references";

export function Calculator({
  bootstrap,
  save,
  initial,
}: {
  bootstrap: Bootstrap;
  save: (request: CalcRequest, result: CalcResult) => void;
  initial?: CalcRequest;
}) {
  const [request, setRequest] = useState<CalcRequest>(() =>
    copy(initial ?? bootstrap.examples["tta-r3-2023"]),
  );
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [evidence, setEvidence] = useState(
    "사용자가 수정한 설계 가정 · 근거 검토 필요",
  );
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [tab, setTab] = useState("form");
  const sequence = useRef(0);
  const fingerprint = JSON.stringify(request);
  useEffect(() => {
    const controller = new AbortController();
    const seq = ++sequence.current;
    setBusy(true);
    setResult(null);
    setFailure("");
    const timer = setTimeout(() => {
      api<CalcResult>("/api/calculate", request, controller.signal)
        .then((r) => {
          if (seq === sequence.current) setResult(r);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setFailure(e.message);
        })
        .finally(() => {
          if (seq === sequence.current) setBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The JSON fingerprint intentionally captures nested input edits.
  }, [fingerprint]);
  const job = request.calculations[selected];
  const rule = bootstrap.formulas.find((f) => f.id === job?.formula_id);
  const active = result?.results?.find((r) => r.id === job?.id);
  const missing = [
    ...new Set([
      ...(active?.missing_fields ?? []),
      ...Object.entries(job?.inputs ?? {})
        .filter(
          ([, v]) =>
            !v.result_ref &&
            (v.value == null ||
              v.value === "" ||
              (Array.isArray(v.value) && !v.value.length)),
        )
        .map(([k]) => k),
    ]),
  ];
  function editJob(next: Calculation) {
    setRequest((p) => ({
      ...p,
      as_of: TODAY,
      calculations: p.calculations.map((j, i) => (i === selected ? next : j)),
    }));
  }
  function chooseProfile(profile: string) {
    setRequest(copy(bootstrap.examples[profile]));
    setSelected(0);
    setResult(null);
    setJsonError("");
  }
  function applyJson() {
    try {
      if (new Blob([json]).size > 2 * 1024 * 1024)
        throw new Error("입력 JSON은 2MB 이하여야 합니다.");
      const next = JSON.parse(json) as CalcRequest;
      if (
        !next ||
        !Array.isArray(next.calculations) ||
        !next.calculations.length ||
        next.calculations.length > 100 ||
        !profileNames[next.profile_id] ||
        next.calculations.some(
          (c) =>
            !c ||
            typeof c.inputs !== "object" ||
            c.inputs === null ||
            typeof c.options !== "object" ||
            c.options === null,
        )
      )
        throw new Error("프로파일과 계산 항목 구조를 확인하세요.");
      setRequest(next);
      setSelected(0);
      setJsonError("");
      setTab("form");
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }
  function clearValues() {
    const next = copy(request);
    next.scenario_id = `sizing-${uid().slice(0, 8)}`;
    next.assumptions = ["사용자 신규 산정 · 입력 및 근거 확인 필요"];
    for (const c of next.calculations)
      for (const input of Object.values(c.inputs))
        if (!input.result_ref) {
          input.value = Array.isArray(input.value) ? [] : null;
          input.origin = "estimated";
          input.evidence = "";
          input.as_of = TODAY;
        }
    setRequest(next);
  }
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="DETERMINISTIC SIZING"
        title="용량산정"
        description="확인한 입력을 버전이 고정된 계산식에 대입합니다. 값을 바꾸면 같은 엔진으로 다시 계산합니다."
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Button
              onClick={() =>
                download(
                  "capacity-input.json",
                  JSON.stringify(request, null, 2),
                )
              }
              iconName="download"
            >
              입력 JSON
            </Button>
            <Button
              variant="primary"
              disabled={!result || busy || result.status !== "calculated"}
              onClick={() => result && save(copy(request), copy(result))}
            >
              산정 결과 저장
            </Button>
          </SpaceBetween>
        }
      />
      <Alert type="info">
        {request.assumptions.some((a) =>
          /example|appendix|Synthetic|Reproduce/i.test(a),
        )
          ? "현재 입력은 원문·합성 예제입니다. 업무에 맞는 값과 근거로 수정하세요."
          : "작성 중인 산정입니다. 미입력은 0으로 처리하지 않습니다."}{" "}
        CPU 결과는 시스템 성능 요구량이며 코어 수·장비 대수로 바로 환산되지
        않습니다.
      </Alert>
      <div className="calculator-toolbar">
        <Choice
          label="산정 기준"
          value={request.profile_id}
          options={Object.entries(profileNames).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={chooseProfile}
        />
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={clearValues}>입력 비우기</Button>
          <Button onClick={() => chooseProfile(request.profile_id)}>
            예제 불러오기
          </Button>
        </SpaceBetween>
      </div>
      {failure && <Alert type="error">{failure}</Alert>}
      <Tabs
        activeTabId={tab}
        onChange={(e) => {
          setTab(e.detail.activeTabId);
          if (e.detail.activeTabId === "json")
            setJson(JSON.stringify(request, null, 2));
        }}
        tabs={[
          {
            id: "form",
            label: "입력과 계산",
            content: (
              <div className="calculator-layout">
                <Container header={<Header variant="h2">계산 항목</Header>}>
                  <SpaceBetween size="m">
                    {request.calculations.map((c, index) => (
                      <button
                        key={c.id}
                        className={`calc-nav ${selected === index ? "active" : ""}`}
                        onClick={() => setSelected(index)}
                      >
                        <span>
                          {formulaNames[c.formula_id] ?? c.formula_id}
                        </span>
                        <small>
                          {c.system_id} · {c.id}
                        </small>
                      </button>
                    ))}
                  </SpaceBetween>
                </Container>
                <SpaceBetween size="l">
                  {job && (
                    <Container
                      header={
                        <Header
                          variant="h2"
                          description={`${job.system_id} · ${job.formula_id}`}
                        >
                          {formulaNames[job.formula_id] ?? job.formula_id}
                        </Header>
                      }
                    >
                      <SpaceBetween size="l">
                        <Field
                          label="수정한 값의 근거"
                          value={evidence}
                          onChange={setEvidence}
                          description="다음 입력 수정부터 이 근거와 오늘 기준일을 적용합니다. 기존 원문 기본값의 출처는 보존됩니다."
                        />
                        <div className="form-grid">
                          {Object.entries(job.inputs).map(([key, input]) =>
                            input.result_ref ? (
                              <FormField
                                key={key}
                                label={`${fieldNames[key] ?? key} · ${unitLabel(input.unit)}`}
                                description={`${key} · ${input.result_ref} 결과 참조`}
                              >
                                <Box padding={{ top: "xs" }}>
                                  <StatusIndicator type="info">
                                    {input.result_ref} 계산값 자동 연결
                                  </StatusIndicator>
                                </Box>
                              </FormField>
                            ) : (
                              <Field
                                key={key}
                                id={`calc-${key}`}
                                label={`${fieldNames[key] ?? key} (${unitLabel(input.unit)})`}
                                value={
                                  Array.isArray(input.value)
                                    ? input.value.join(", ")
                                    : (input.value ?? "")
                                }
                                description={`${key}${Array.isArray(input.value) ? " · 포트별 값을 쉼표로 구분하세요." : ""}`}
                                onChange={(value) =>
                                  editJob({
                                    ...job,
                                    inputs: {
                                      ...job.inputs,
                                      [key]: {
                                        ...input,
                                        value: Array.isArray(input.value)
                                          ? value
                                              .split(",")
                                              .map((x) => x.trim())
                                              .filter(Boolean)
                                          : value === ""
                                            ? null
                                            : value,
                                        origin: "estimated",
                                        evidence,
                                        as_of: TODAY,
                                      },
                                    },
                                  })
                                }
                              />
                            ),
                          )}
                        </div>
                        <ExpandableSection headerText="적용 옵션·단위·입력 출처">
                          <SpaceBetween size="m">
                            {rule?.source_id === "tta-r3" && (
                              <Box>
                                표준 개정일 {TTA_REFERENCE.published}. 입력
                                기준일은 값의 기록일이며 표준 발행일과 다릅니다.
                                MB(원문 표기)는 MiB로 자동 환산하지 않습니다.
                              </Box>
                            )}
                            <div className="form-grid">
                              {Object.entries(job.options).map(
                                ([key, value]) =>
                                  key === "capacity_unit" ? (
                                    <Choice
                                      key={key}
                                      label="용량 기준 단위"
                                      value={String(value)}
                                      options={unitOptions(String(value))}
                                      onChange={(v) =>
                                        editJob({
                                          ...job,
                                          options: { ...job.options, [key]: v },
                                        })
                                      }
                                    />
                                  ) : (
                                    <Field
                                      key={key}
                                      label={key}
                                      value={String(value)}
                                      onChange={(v) =>
                                        editJob({
                                          ...job,
                                          options: { ...job.options, [key]: v },
                                        })
                                      }
                                    />
                                  ),
                              )}
                            </div>
                            <Table
                              variant="embedded"
                              items={Object.entries(job.inputs)}
                              columnDefinitions={[
                                {
                                  id: "key",
                                  header: "입력",
                                  cell: ([key]) => fieldNames[key] ?? key,
                                },
                                {
                                  id: "unit",
                                  header: "단위",
                                  cell: ([key, input]) =>
                                    input.result_ref ? (
                                      unitLabel(input.unit)
                                    ) : (
                                      <Choice
                                        label={`${key} 단위`}
                                        options={unitOptions(input.unit)}
                                        value={input.unit}
                                        onChange={(value) =>
                                          editJob({
                                            ...job,
                                            inputs: {
                                              ...job.inputs,
                                              [key]: {
                                                ...input,
                                                unit: value,
                                                origin: "estimated",
                                                evidence,
                                                as_of: TODAY,
                                              },
                                            },
                                          })
                                        }
                                      />
                                    ),
                                },
                                {
                                  id: "origin",
                                  header: "근거",
                                  cell: ([, input]) => (
                                    <InputEvidence
                                      input={input}
                                      sourceId={rule?.source_id}
                                    />
                                  ),
                                },
                                {
                                  id: "date",
                                  header: "입력 기준일",
                                  cell: ([, input]) =>
                                    input.as_of ?? "동일 실행",
                                },
                              ]}
                            />
                          </SpaceBetween>
                        </ExpandableSection>
                        {rule && (
                          <div className="formula-box">
                            <div className="eyebrow">계산식과 출처</div>
                            <code>{rule.expression}</code>
                            <div>
                              <SourceLink
                                id={rule.source_id}
                                page={rule.source_pages[0]}
                              >
                                {bootstrap.documents.find(
                                  (d) =>
                                    d.id === `sources/${rule.source_id}.md`,
                                )?.title ?? "산정 참고 자료"}{" "}
                                · PDF p.{rule.source_pages.join(", ")}
                              </SourceLink>
                            </div>
                          </div>
                        )}
                      </SpaceBetween>
                    </Container>
                  )}
                  <Container
                    header={
                      <Header
                        variant="h2"
                        actions={
                          <StatusIndicator
                            type={
                              busy
                                ? "loading"
                                : active?.status === "calculated"
                                  ? "success"
                                  : "warning"
                            }
                          >
                            {busy
                              ? "재계산 중"
                              : active?.status === "calculated"
                                ? "계산 완료"
                                : "입력 확인"}
                          </StatusIndicator>
                        }
                      >
                        현재 항목 결과
                      </Header>
                    }
                  >
                    {active?.status === "calculated" ? (
                      <SpaceBetween size="m">
                        <div className="calculation-value">
                          {fmt(active.raw_value, 6)}{" "}
                          <span>{unitLabel(active.unit)}</span>
                        </div>
                        <Box color="text-body-secondary">
                          산정 원값 {active.raw_value} · 표시 반올림{" "}
                          {active.display_value}
                          {active.minimum_whole_value
                            ? ` · 정수 최소 할당 ${active.minimum_whole_value}`
                            : ""}
                        </Box>
                        <ExpandableSection headerText="대입값과 단위 변환">
                          <Box>
                            정확한 유리수: {active.exact_value?.numerator} /{" "}
                            {active.exact_value?.denominator}
                          </Box>
                          <Table
                            variant="embedded"
                            items={Object.entries(active.trace?.inputs ?? {})}
                            columnDefinitions={[
                              {
                                id: "key",
                                header: "입력",
                                cell: ([key]) => fieldNames[key] ?? key,
                              },
                              {
                                id: "original",
                                header: "원 입력",
                                cell: ([, input]) =>
                                  `${input.original.result_ref ?? input.original.value} ${unitLabel(input.original.unit)}`,
                              },
                              {
                                id: "norm",
                                header: "계산에 사용한 값",
                                cell: ([, input]) =>
                                  `${input.normalized_value} ${unitLabel(input.normalized_unit)}`,
                              },
                            ]}
                          />
                        </ExpandableSection>
                      </SpaceBetween>
                    ) : (
                      <SpaceBetween size="s">
                        {busy ? (
                          <Box>입력한 값으로 다시 계산하고 있습니다.</Box>
                        ) : (
                          <>
                            <Box>필수값·단위·입력 간 관계를 확인하세요.</Box>
                            {missing.length ? (
                              <Box>
                                미입력:{" "}
                                {missing
                                  .map((k) => fieldNames[k] ?? k)
                                  .join(", ")}
                              </Box>
                            ) : null}
                            {active?.errors?.map((e, i) => (
                              <Box key={i} color="text-status-error">
                                {e.path ? `${e.path}: ` : ""}
                                {e.message}
                              </Box>
                            ))}
                          </>
                        )}
                      </SpaceBetween>
                    )}
                  </Container>
                </SpaceBetween>
              </div>
            ),
          },
          {
            id: "results",
            label: "전체 결과",
            content: (
              <Table
                loading={busy}
                loadingText="계산 중"
                items={result?.results ?? []}
                columnDefinitions={[
                  {
                    id: "name",
                    header: "계산 항목",
                    cell: (r) =>
                      `${r.system_id} · ${formulaNames[r.formula_id] ?? r.formula_id}`,
                  },
                  {
                    id: "status",
                    header: "상태",
                    cell: (r) => (
                      <StatusIndicator
                        type={r.status === "calculated" ? "success" : "warning"}
                      >
                        {r.status === "calculated" ? "계산 완료" : "입력 확인"}
                      </StatusIndicator>
                    ),
                  },
                  {
                    id: "value",
                    header: "산정값",
                    cell: (r) =>
                      r.raw_value == null
                        ? "미산정"
                        : `${fmt(r.raw_value, 6)} ${unitLabel(r.unit)}`,
                  },
                  {
                    id: "source",
                    header: "출처",
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
                empty={<Box>계산 결과가 없습니다.</Box>}
              />
            ),
          },
          {
            id: "json",
            label: "JSON 가져오기·편집",
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="전체 입력·단위·근거·옵션을 유지한 요청을 가져올 수 있습니다."
                    actions={<Button onClick={applyJson}>입력에 적용</Button>}
                  >
                    재현 가능한 산정 입력
                  </Header>
                }
              >
                <FormField errorText={jsonError}>
                  <Textarea
                    value={json}
                    onChange={(e) => setJson(e.detail.value)}
                    rows={24}
                    ariaLabel="산정 입력 JSON"
                    spellcheck={false}
                  />
                </FormField>
              </Container>
            ),
          },
        ]}
      />
      {result?.errors?.length ? (
        <Alert type="warning" header="전체 산정 확인 사항">
          <ul>
            {result.errors.map((e, i) => (
              <li key={i}>
                {e.path}: {e.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </SpaceBetween>
  );
}
