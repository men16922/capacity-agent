# Agent Brief

> ▶ NEXT SESSION: `docs/NEXT_PLAN.md`를 따른다. 웹·마이그레이션·public GitHub·로컬 기동 완료. 다음 제품 우선순위는 Wiki 검색·인용 평가셋과 요구사항 추출·계산 도구 계약이다.

Last Updated: 2026-09-28

사용자 원본56경로·고유36개를 보존한 LLM Wiki와 결정론적 계산 엔진1.0.0, On-Prem/AWS Cloudscape 대시보드를 구현했다. 핵심 흐름은 원본 자산→실측/확정 사양→EC2·gp3·비용→이전안 비교·산정서다. LLM은 아직 연결하지 않았다.

## Read Order

[상태](STATUS.md) → [다음 작업](NEXT_PLAN.md) → [최근 로그](PROGRESS_LOG.md) → [교훈](LESSONS.md).

## Commands

- 설치·실행: [웹 사용법](WEB_USAGE.md). `make web-start` → `http://127.0.0.1:8765`.
- `make check`: Wiki·출처·21식·Python71개 테스트. 로컬 원본이 있으면 해시 검사도 포함.
- `make check-sources`: 원본과 전체 추출을 필수로 검사.
- `make engine-smoke`: 세 계산 예제 CLI 실행.
- `make web-check`: Python gate·웹 빌드·Playwright8개 흐름. Playwright Chromium 사전 설치 필요.
- `make overnight-where`: 설치된 플러그인 탐색. 무인 실행 seed0개.

## Boundaries

- 원본 `reference/`를 변경하지 않는다. 원본과 전체 추출은 공개 GitHub에 포함하지 않는다.
- TTA/강의/2021가이드/AWS 모델을 분리한다. tpmC/vCPU 임의 환산·측정하지 않은 성능 주장을 하지 않는다.
- AWS 카탈로그는 공식 서울 스냅샷이며 실제 이관·HA·성능·보안 검증과 구분한다.
- 사용자가 이번 웹 완료 후 public repo 생성·commit·push와 로컬 대시보드 기동을 승인했다. 클라우드 배포 승인은 아니다.
- 원문 표/그림 완전 변환·Excel 네이티브 재계산·현행 인증 기준 검증은 남아 있다.

[Wiki](../wiki/index.md) · [웹 명세](WEB_PLAN.md) · [마이그레이션 계약](MIGRATION_DESIGN.md) · [검증](WEB_VERIFICATION.md)
