import {
  copy,
  planFor,
  type Asset,
  type MigrationDraft,
  type MigrationRequest,
  type MigrationResult,
  type Project,
} from "./domain";

export const statusLabels = {
  pending: "미산정",
  stale: "재산정 필요",
  complete: "후보 검토",
  invalid: "입력 확인",
  no_candidates: "후보 없음",
  failed: "요청 실패",
};
export type DraftStatus = keyof typeof statusLabels;
// Object key order in a JSON backup does not change its meaning.
export function signature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${signature(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
export function requestFor(
  asset: Asset,
  draft?: MigrationDraft,
): MigrationRequest {
  return {
    schema_version: 1,
    asset: copy(asset),
    plan: copy(draft?.plan ?? planFor(asset)),
  };
}
export function draftStatus(
  asset: Asset,
  draft: MigrationDraft | undefined,
  catalog: string,
): DraftStatus {
  if (!draft?.request) return "pending";
  if (
    signature(requestFor(asset, draft)) !== signature(draft.request) ||
    (draft.result?.provenance?.catalog_version &&
      draft.result.provenance.catalog_version !== catalog)
  )
    return "stale";
  if (draft.failure) return "failed";
  return draft.result && draft.result.status in statusLabels
    ? (draft.result.status as DraftStatus)
    : "pending";
}
export function compactResult(
  result: MigrationResult,
  selected: string,
): MigrationResult {
  // Retain only the selected candidate; detail pages obtain the complete current list.
  return copy({
    ...result,
    candidates: result.candidates?.filter((c) => c.instance_type === selected),
    rejected: undefined,
  });
}
export function calculatedDraft(
  request: MigrationRequest,
  result: MigrationResult,
  selected?: string,
): MigrationDraft {
  const choice =
    result.candidates?.find((c) => c.instance_type === selected)
      ?.instance_type ??
    result.candidates?.[0]?.instance_type ??
    "";
  return {
    assetId: request.asset.id,
    plan: copy(request.plan),
    request: copy(request),
    result: compactResult(result, choice),
    selected: choice,
    calculatedAt: new Date().toISOString(),
  };
}
export function putDraft(project: Project, draft: MigrationDraft): Project {
  if (!project.assets.some((a) => a.id === draft.assetId)) return project;
  return {
    ...project,
    migrationDrafts: [
      ...(project.migrationDrafts ?? []).filter(
        (d) =>
          d.assetId !== draft.assetId &&
          project.assets.some((a) => a.id === d.assetId),
      ),
      draft,
    ],
  };
}
export type PortfolioView = {
  search: string;
  role: string;
  status: string;
  page: number;
  size: number;
  sort: string;
  descending: boolean;
  selected: string[];
};
export const initialPortfolioView: PortfolioView = {
  search: "",
  role: "all",
  status: "all",
  page: 1,
  size: 25,
  sort: "name",
  descending: false,
  selected: [],
};
