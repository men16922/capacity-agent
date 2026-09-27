export const TTA_REFERENCE = {
  title: "정보시스템 하드웨어 규모산정 지침",
  publisher: "한국정보통신기술협회(TTA)",
  version: "TTAK.KO-10.0292/R3",
  published: "2023-12-06",
  url: "https://committee.tta.or.kr/data/standard_view.jsp?commit_code=PG423&nowSu=1&pk_num=TTAK.KO-10.0292%2FR3",
  checked: "2026-09-28",
};
export const ASSESSMENT_REFERENCE = {
  title: "AWS 마이그레이션 평가 데이터 요구사항",
  url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/application-portfolio-assessment-guide/understanding-complete-assessment-data-requirements.html",
};
export const unitLabel = (unit = "") =>
  unit
    .replaceAll("MB-as-labeled-in-source", "MB(원문 표기)")
    .replace(/^factor$/, "배율")
    .replace(/^percent$/, "%");
export function unitOptions(unit: string) {
  const capacity =
    /^(?:MB-as-labeled-in-source|B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)(\/user)?$/.exec(
      unit,
    );
  const options = capacity
    ? [
        "MB-as-labeled-in-source",
        "B",
        "KB",
        "KiB",
        "MB",
        "MiB",
        "GB",
        "GiB",
        "TB",
        "TiB",
      ].map((u) => u + (capacity[1] ?? ""))
    : [unit];
  return options.map((value) => ({ value, label: unitLabel(value) }));
}

export const assessmentFields = {
  asset_type: "자산 유형",
  environment: "운영 환경",
  application: "애플리케이션 연결",
  os_version: "OS 버전",
  software: "소프트웨어·DB 제품/버전",
  license: "라이선스 조건",
  dependencies: "내부·외부 의존성",
  availability: "가용성·재해복구 요구사항",
} as const;
