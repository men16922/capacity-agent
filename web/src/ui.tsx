import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { createContext, useContext, type ReactNode } from "react";
import {
  fmt,
  type Asset,
  type Candidate,
  type MigrationResult,
} from "./domain";

export function Field({
  label,
  value,
  onChange,
  description,
  error,
  unit,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
  error?: string;
  unit?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <FormField
      label={unit ? `${label} (${unit})` : label}
      description={description}
      errorText={error}
      controlId={id}
    >
      <Input
        controlId={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.detail.value)}
      />
    </FormField>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  description?: string;
}) {
  return (
    <FormField label={label} description={description}>
      <Select
        selectedOption={options.find((o) => o.value === value) ?? null}
        options={options}
        onChange={(e) => onChange(e.detail.selectedOption.value ?? "")}
      />
    </FormField>
  );
}
export function Metric({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box textAlign="center" padding="xl">
      <SpaceBetween size="m">
        <Box variant="h3">{title}</Box>
        <Box color="text-body-secondary">{children}</Box>
        {action}
      </SpaceBetween>
    </Box>
  );
}
export function PageHeading({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <Header variant="h1" description={description} actions={actions}>
        {title}
      </Header>
    </div>
  );
}
export const SourceAvailability = createContext<Record<string, boolean>>({});
export function SourceLink({
  id,
  page,
  children,
}: {
  id: string;
  page?: number;
  children: ReactNode;
}) {
  const available = useContext(SourceAvailability);
  if (available[id] === false)
    return (
      <span title="로컬 reference 폴더에 원본이 없습니다. Wiki 출처 카드를 참고하세요.">
        {children} · 원본 별도
      </span>
    );
  return (
    <Link
      href={`/api/sources/${encodeURIComponent(id)}/original${page ? `#page=${page}` : ""}`}
      external
      externalIconAriaLabel="새 탭에서 원문 열기"
    >
      {children}
    </Link>
  );
}
export function Mapping({
  asset,
  candidate,
  result,
}: {
  asset: Asset;
  candidate?: Candidate;
  result?: MigrationResult;
}) {
  return (
    <div className="mapping" aria-label="원본 서버와 AWS 대상 연결">
      <div className="mapping-node">
        <span className="node-label">ON-PREM</span>
        <strong>{asset.name}</strong>
        <span>
          {fmt(asset.vcpu)} 논리 CPU · {fmt(asset.memory_gib)} GiB
        </span>
        <small>
          {asset.os} · {asset.architecture}
        </small>
      </div>
      <div className="mapping-arrow" aria-hidden="true">
        →
      </div>
      <div className="mapping-node aws">
        <span className="node-label">AMAZON EC2</span>
        <strong>{candidate?.instance_type ?? "후보 검토"}</strong>
        <span>
          {candidate
            ? `${fmt(candidate.vcpu)} vCPU · ${fmt(candidate.memory_gib)} GiB`
            : "이전 조건에 맞는 사양 확인"}
        </span>
        <small>
          {result?.requirements
            ? `${result.requirements.target_nodes}개 노드 · 서울 리전`
            : "ap-northeast-2"}
        </small>
      </div>
      <div className="mapping-arrow" aria-hidden="true">
        +
      </div>
      <div className="mapping-node storage">
        <span className="node-label">AMAZON EBS</span>
        <strong>
          {result?.storage
            ? `${fmt(result.storage.size_gib)} GiB gp3`
            : "gp3 스토리지"}
        </strong>
        <span>
          {result?.storage
            ? `${fmt(result.storage.iops)} IOPS · ${fmt(result.storage.throughput_mibps)} MiB/s`
            : "용량·IOPS·처리량 함께 검토"}
        </span>
        <small>논리 볼륨 1개 / 노드</small>
      </div>
    </div>
  );
}
export function CandidateDetail({
  candidate,
  result,
}: {
  candidate: Candidate;
  result: MigrationResult;
}) {
  return (
    <SpaceBetween size="l">
      <Header variant="h2">{candidate.instance_type}</Header>
      <StatusIndicator type="info">입력 조건의 사양 충족 후보</StatusIndicator>
      <ColumnLayout columns={2}>
        <div>
          <Box variant="awsui-key-label">CPU / 메모리</Box>
          {candidate.vcpu} vCPU / {candidate.memory_gib} GiB
        </div>
        <div>
          <Box variant="awsui-key-label">프로세서</Box>
          {candidate.processor}
        </div>
        <div>
          <Box variant="awsui-key-label">지속 네트워크</Box>
          {candidate.network_baseline_gbps} Gbps
        </div>
        <div>
          <Box variant="awsui-key-label">지속 EBS</Box>
          {fmt(candidate.ebs_baseline_iops)} IOPS /{" "}
          {fmt(candidate.ebs_baseline_MBps)} MB/s
        </div>
      </ColumnLayout>
      <div>
        <Box variant="h3">선정 근거</Box>
        <ul>
          {candidate.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <Box color="text-body-secondary">
          요구량 대비 {fmt(candidate.headroom.vcpu)} vCPU,{" "}
          {fmt(candidate.headroom.memory_gib)} GiB 여유
        </Box>
      </div>
      <div>
        <Box variant="h3">출처</Box>
        <SpaceBetween size="xs">
          <Link external href={candidate.spec_url}>
            AWS 공식 인스턴스 사양
          </Link>
          {candidate.cost.hourly_price && (
            <Link external href={candidate.cost.hourly_price.source_url}>
              공식 가격표 · {candidate.cost.hourly_price.effective_date}
            </Link>
          )}
          <Box fontSize="body-s">
            사양 확인 {result.provenance?.catalog_verified_on} ·{" "}
            {candidate.cost.hourly_price?.sku ?? "가격 미확인"}
          </Box>
        </SpaceBetween>
      </div>
      <Box color="text-body-secondary">
        실제 애플리케이션 성능과 소프트웨어 호환성, AZ 수용량은 이전 전 검증해야
        합니다.
      </Box>
    </SpaceBetween>
  );
}
export function StepCard({
  number,
  title,
  description,
  onClick,
}: {
  number: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Container>
      <div className="step-card">
        <span className="step-number">{number}</span>
        <div>
          <Box variant="h3">{title}</Box>
          <p>{description}</p>
          <Button variant="inline-link" onClick={onClick}>
            {title} 시작 →
          </Button>
        </div>
      </div>
    </Container>
  );
}
