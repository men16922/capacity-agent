import Decimal from "decimal.js";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Link from "@cloudscape-design/components/link";
import { ASSESSMENT_REFERENCE, assessmentFields } from "./references";
import { useState, useEffect } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { assetErrors, api, fmt, type Asset } from "./domain";
import { Choice, Field } from "./ui";

export function AssetEditor({
  asset,
  isExisting,
  aws = false,
  onSave,
  onDismiss,
}: {
  asset: Asset;
  isExisting: boolean;
  aws?: boolean;
  onSave: (a: Asset) => void;
  onDismiss: () => void;
}) {
  const [draft, setDraft] = useState({ ...asset });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<
    {
      instance_type: string;
      vcpu: string;
      memory_gib: string;
      architecture: string;
    }[]
  >([]);
  useEffect(() => {
    if (aws)
      api<{ instances: typeof catalog }>("/api/catalog")
        .then((r) => setCatalog(r.instances))
        .catch(() =>
          setErrors({
            instance_type: "카탈로그를 불러오지 못했습니다. 다시 열어 주세요.",
          }),
        );
  }, [aws]);
  function save() {
    const e = assetErrors(draft);
    if (
      aws &&
      !e.vcpu &&
      !e.memory_gib &&
      !catalog.some(
        (c) =>
          c.instance_type === draft.instance_type &&
          new Decimal(c.vcpu).eq(draft.vcpu) &&
          new Decimal(c.memory_gib).eq(draft.memory_gib) &&
          c.architecture === draft.architecture,
      )
    )
      e.instance_type = "현재 EC2 유형과 할당 사양을 일치시켜 주세요.";
    setErrors(e);
    if (!Object.keys(e).length) onSave(draft);
  }
  return (
    <Modal
      visible={true}
      onDismiss={onDismiss}
      size="large"
      header={
        isExisting
          ? aws
            ? "AWS 자산 수정"
            : "서버 자산 수정"
          : aws
            ? "AWS 자산 추가"
            : "서버 자산 추가"
      }
      closeAriaLabel="닫기"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={aws && !catalog.length}
              onClick={save}
            >
              서버 저장
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {draft && (
        <SpaceBetween size="l">
          {aws && (
            <Choice
              label="현재 EC2 유형"
              value={draft.instance_type ?? ""}
              options={catalog.map((c) => ({
                value: c.instance_type,
                label: `${c.instance_type} · ${c.vcpu} vCPU / ${fmt(c.memory_gib)} GiB`,
              }))}
              onChange={(v) => {
                const c = catalog.find((c) => c.instance_type === v)!;
                setDraft({
                  ...draft,
                  instance_type: v,
                  vcpu: c.vcpu,
                  memory_gib: c.memory_gib,
                  architecture: c.architecture,
                });
              }}
              description="서울 공식 카탈로그. 현재 운영 중인 EC2 사양을 선택하세요."
            />
          )}
          {errors.instance_type && (
            <Alert type="error">{errors.instance_type}</Alert>
          )}
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
                ["disk_allocated_gib", "논리 디스크 할당량", "GiB"],
                ["peak_cpu_percent", "CPU 피크 사용률", "%"],

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
                value={draft[key] ?? ""}
                disabled={aws && ["vcpu", "memory_gib"].includes(key)}
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
          <div className="form-grid">
            <Choice
              label="메모리 사용량 입력 방식"
              value={draft.memory_usage_mode || "amount"}
              options={[
                { value: "amount", label: "실사용량 (GiB)" },
                { value: "percent", label: "사용률 (%)" },
              ]}
              onChange={(v) => setDraft({ ...draft, memory_usage_mode: v })}
            />
            {draft.memory_usage_mode === "percent" ? (
              <Field
                label="메모리 피크 사용률"
                unit="%"
                value={draft.peak_memory_percent ?? ""}
                error={errors.peak_memory_percent}
                onChange={(v) => setDraft({ ...draft, peak_memory_percent: v })}
              />
            ) : (
              <Field
                label="메모리 피크 실사용"
                unit="GiB"
                value={draft.peak_memory_gib}
                error={errors.peak_memory_gib}
                onChange={(v) => setDraft({ ...draft, peak_memory_gib: v })}
              />
            )}
            <Choice
              label="디스크 사용량 입력 방식"
              value={draft.disk_usage_mode || "amount"}
              options={[
                { value: "amount", label: "실사용량 (GiB)" },
                { value: "percent", label: "사용률 (%)" },
              ]}
              onChange={(v) => setDraft({ ...draft, disk_usage_mode: v })}
            />
            {draft.disk_usage_mode === "percent" ? (
              <Field
                label="디스크 사용률"
                unit="%"
                value={draft.disk_used_percent ?? ""}
                error={errors.disk_used_percent}
                onChange={(v) => setDraft({ ...draft, disk_used_percent: v })}
              />
            ) : (
              <Field
                label="논리 디스크 사용량"
                unit="GiB"
                value={draft.disk_gib}
                error={errors.disk_gib}
                onChange={(v) => setDraft({ ...draft, disk_gib: v })}
              />
            )}
            {aws && (
              <>
                <Field
                  label="현재 gp3 프로비저닝 IOPS"
                  value={draft.current_iops ?? ""}
                  error={errors.current_iops}
                  onChange={(v) => setDraft({ ...draft, current_iops: v })}
                />
                <Field
                  label="현재 gp3 프로비저닝 처리량"
                  unit="MiB/s"
                  value={draft.current_throughput_mibps ?? ""}
                  error={errors.current_throughput_mibps}
                  onChange={(v) =>
                    setDraft({ ...draft, current_throughput_mibps: v })
                  }
                />
              </>
            )}
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
  );
}
