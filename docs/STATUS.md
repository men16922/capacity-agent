# Status

Last Updated: 2026-09-27

## 현재 기준

- P0 Wiki·P1 결정론적 엔진·P2 On-Prem/AWS Cloudscape 대시보드의 로컬 구현·검증 완료.
- 원본56경로·36출처를 보존했다. Wiki51페이지·개념8개·계산식21개. AWS 엑셀·가이드·네트워크·클라우드 보안 자료 포함.
- On-Prem 자산 CRUD/CSV, 세 프로파일 입력·계산·출처, AWS 실측/확정 사양·EC2·gp3·예상 비용·이전안 비교·산정서·JSON 재현 구현.
- 공식 서울 카탈로그36개: C8i/M8i/R8i/C8g/M8g/R8g. 사양 확인2026-09-27, 가격표 발행2026-09-25. 런타임 외부 호출 없음.
- 한국어 Cloudscape, 다크 모드·390px 화면·키보드, Wiki 본문 검색·벤치마크 링크·로컬 원본 조회.
- `make check`: 원본/추출 해시·출처·식·링크 및 Python71개 테스트 통과. `make engine-smoke` 통과.
- TypeScript·production build, Playwright8개 흐름 통과. 주요3화면 axe WCAG 자동 검사 위반0개. A4 산정서4페이지 텍스트·렌더 확인.
- 공개 준비: .gitignore에 원본·전체 추출·키·환경·로그·의존성·빌드 제외. 원본 없는 공개 체크아웃에서 실행하도록 API/검증기 구성.
- 원본 없는 공개 stage 체크아웃에서 npm ci·build·gate·CLI 및 새 Python3.13 환경의71개 테스트·브라우저8개 통과. GitHub public 생성·commit·push는 마무리 단계이며 원격 CI 실행 결과는 아직 없음.
- overnight-harness1.6.0은 초기화 상태이며 무인 모델 루프는 실행하지 않음.

## 실행

[웹 사용법](WEB_USAGE.md)의 설치·빌드 후 `make web-start`. 기본 주소 `http://127.0.0.1:8765`.

## 남는 제품 범위

- 다음은 P3 Wiki 검색·요구사항 에이전트와 자산/제품 버전별 보안 검토·증적 관리.
- 실제 AWS 자원 생성·데이터 이관·성능/장애전환 시험, 공동 편집·인증·공개 호스팅은 미수행.
- 서울36개 사양·단일 gp3/노드·EC2 On-Demand+EBS 비용만 제공. 네트워크·백업·세금·이관·별도 라이선스 비용 제외.
- HWP 표/그림 완전 변환, XLS 미해결 식·Excel 네이티브 재계산, TTA 최신 유효본·정오표·현행 보안 기준 대조는 미완료.
- AWS 엑셀과 사용 가이드의 해시 불일치, 원문 MB/MiB 해석, 네트워크 가이드의 안정성/F(x)/세션시간 충돌은 Wiki에 유지.

[웹 검증](WEB_VERIFICATION.md) · [엔진 검증](ENGINE_VERIFICATION.md) · [다음 작업](NEXT_PLAN.md) · [진행 기록](PROGRESS_LOG.md)
