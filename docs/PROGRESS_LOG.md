# Progress Log

## 2026-09-28 — 프로젝트 계층·자산 중심 최적화·일괄 검토 저장

- Status: P2.2 구현·로컬 검증 완료, 공개 반영 마감 진행.
- Changed: 프로젝트 목록·IndexedDB 독립 저장/revision·통합 대시보드·좌측 On-Prem/AWS·프로젝트별 주소. legacy 보존·가져오기 새 프로젝트 추가.
- Changed: 자산 목록/상세/편집·사용률/사용량 입력·On-Prem 최적화·AWS 운영 자산/최적화·스냅샷 비교/산정서. AWS 선택 여러 건 일괄 검토 저장.
- Changed: 화면 책임별 모듈 분리·dead import/CSS 제거·noUnusedLocals·공개 제외 강화·기획/설계/사용 문서 정리.
- Verified: 원본/출처·Python77개·CLI·Ruff·타입/build·브라우저20개44.4초 통과. 기존 golden·200개 처리·충돌/늦은응답/한도/중복·axe 유지.
- Verified: 실제 Chrome에서 기존 데이터 보존·48개 일괄 저장·두 환경 최적화 각각1안·산정서·새로고침 복원. 8765 서버와 대시보드 유지.
- Evidence: docs/PROJECT_WORKSPACE_DESIGN.md, WEB_VERIFICATION.md, images/project-dashboard.png.
- Blockers: 로컬 기능 장애 없음. 실제 AWS/성능/ML 결과로 주장하지 않음.
- Next: 공개 파일 검사→commit/push→원격 CI/HEAD 확인.

## 2026-09-28 — 다수 자산 이전 설계·공식 출처·문서 완료

- Status: P2.1 구현·로컬/원격 검증·public 반영·대시보드 기동 완료.
- Changed: 최대200개 목록·검색·필터·페이지·선택 일괄 산정·공통 조건·자산별 상세5탭. 초안과 검토 저장 분리, 변경 감지·소계 제외·JSON 재계산.
- Changed: 범용 견적 입력8개, 공식 TTA/AWS 웹 근거·읽기 쉬운 단위. 합성48개 JSON/CSV, 기획·설계·사용·데이터 사전·검증 문서 및 문서 안내.
- Verified: Python71개·CLI·TypeScript/build·브라우저14개 통과(29.5초). 48개 부분 실패와200개 전체 산정 각각6회 반복 통과. 모바일390px·axe 검사·데스크톱 화면 검토.
- Evidence: 연속 결과 갱신의 React185 재현 후 startTransition 및 예외 범위 분리로 수정. 저장48개446,252바이트·200개5MB 미만·새로고침 복원 확인.
- Evidence: 공식 TTA 상세의 R3 유효 이력·2023-12-06 개정과 AWS 평가 지침 확인. 특정 고객 자료·원본은 공개 대상에 넣지 않음.
- Verified: 코드4b9043d public push·원격 HEAD 일치. GitHub Actions36333255452에서 원본 없이 Python71개·브라우저14개·빌드/CLI 통과. Chrome 최신 AWS 목록·8765 health 확인.
- Blockers: 로컬 요청 범위의 장애 없음. 실제 AWS 이관·전체 견적/TCO·LLM 연결은 후속 범위.
- Next: P3 Wiki 검색·인용 평가와 요구사항 추출·계산 도구 계약. 기획/설계/사용 가이드는 docs/README.md에서 탐색.

## 2026-09-28 — Public GitHub·원격 CI·대시보드 기동 완료

- Status: 사용자 웹 목표와 공개 저장소·기동 추가 요청 완료.
- Changed: GitHub CLI로 men16922/capacity-agent public 생성, main 코드 커밋 b2474b6 push. 원본·전체 추출·환경·키·로그는 제외.
- Verified: 공개 stage의 새 Python3.13 환경에서71개 테스트·브라우저8개 재현. 실제 GitHub clone에서도 원본 제외·Wiki gate 통과, 원격 HEAD 일치.
- Verified: GitHub Actions36327965577 성공. Linux/Python3.12/Node24에서71개 테스트·CLI·빌드·8개 브라우저 흐름 및 검증 artifact 생성.
- Verified: 127.0.0.1:8765 백그라운드 서버, health/HTML200. Chrome 대시보드 탭 유지. 실행 PID·로그는 .workspace에만 저장.
- Blockers: 요청 범위에 남은 장애 없음. 실제 AWS 이관·LLM 연결·클라우드 호스팅은 후속 범위.
- Next: P3 Wiki 검색·인용 평가와 에이전트 입력/계산 도구 계약.

## 2026-09-27 — On-Prem/AWS 웹 구현·로컬 검증 완료

- Status: P2 로컬 구현·검증 완료. 공개 GitHub와 기동 마무리 진행.
- Changed: Cloudscape 두 탭, 자산 CRUD/CSV,21식 입력, AWS4단계 마법사·후보 상세·시나리오·산정서·Wiki.
- Changed: 공식 서울36사양·54 EC2 단가·3 gp3 단가. 실측/확정·HA·고정 메모리·gp3·비용 코어와 FastAPI.
- Changed: 원본 없는 공개 실행, .gitignore·새 체크아웃 게이트·실행 문서·CI 구성. 원본56개·전체 추출은 보존.
- Verified: Python71개, Playwright8개, TypeScript/build, Ruff, format, 세 CLI 예제 통과. 주요3화면 axe 위반0개.
- Verified: 9.6vCPU/47GiB/450GiB와 821.2856USD, 원본 수정 후 과거 이전안 유지·JSON 재계산·늦은 응답 무효화. A4 PDF4페이지 텍스트와 렌더 확인.
- Evidence: docs/WEB_VERIFICATION.md, docs/images/, 브라우저 재현 코드 web/tests/dashboard.spec.ts.
- Blockers: 로컬 웹 완료를 막는 사항 없음. 실제 AWS·모델·원격 배포는 미실행.
- Next: 공개 대상 검사·새 체크아웃 재현 후 public commit/push·로컬 기동 상태 확인.

## 2026-09-27 — 보안 가이드 Wiki 반영·Cloudscape 마이그레이션 계획

- Status: 보안 자료 등록 완료. On-Prem/AWS 대시보드·마이그레이션 구현 및 검증 목표 진행 중.
- Changed: 클라우드 취약점 가이드 766페이지 추출, 39종 목차·주요 체크리스트·용량 가정 연결. 원본56개·36출처·Wiki51페이지.
- Changed: WEB_PLAN·MIGRATION_DESIGN 작성. 사용자 지시로 On-Prem/AWS 메뉴와 마이그레이션을 핵심으로 올리고 EC2·gp3·비용을 P2에 포함.
- Verified: PDF p.7·549 렌더 검토. make check 통과: 원본/추출 해시·링크458개·21식·테스트51개. 원본 수정 없음.
- Evidence: Cloudscape 공식 문서, AWS 공식 사양·서울 가격표 확보. 번들 Node24.19.0을 사용하며 전역 설정은 변경하지 않음.
- Next: 공식 카탈로그·마이그레이션 코어·HTTP와 Cloudscape 화면 구현 후 브라우저 검증.

## 2026-09-27 — 결정론적 계산 엔진 P1 및 추가 네트워크 가이드 완료

- Status: 사용자 목표인 계산 엔진 P1 완료. 웹·에이전트·AWS 전용 확장은 후속 계획에 유지.
- Changed: 표준 라이브러리 Python API·JSON CLI 구현. TTA7식·강의 네트워크4식·추가 가이드10식, 합계21식.
- Changed: 십진 문자열·단위·근거·날짜·누락/0·범위·반올림 계약, 정확한 유리수 연산, 원문 MB 보존, 코드/규칙/출처 해시와 trace.
- Changed: CPU 아키텍처 가중치1회 적용, IOPS 정확값 참조, 포트·세션 정수 올림 참조, RAID·중복 모델 검사.
- Changed: TPC-C·SPC-1·SPC-1C·SPEC 레코드 스키마와 버전/범주/상태/구성/기한 비교. 실제 읽기 예시는 구성 미확인으로 비교 거부 유지.
- Changed: 추가 AWS 가이드16p·네트워크 가이드22p 등록. 원본55경로·35출처, Wiki49페이지. 초기52파일과 추가 원본의 SHA-256 보존 확인.
- Evidence: AWS 가이드의 엑셀 해시921f…와 현재d6bf… 불일치, 네트워크 표준번호R1·안정성 범위 충돌·F(x) 미명세 확인. 네트워크 p.8~9를 렌더 화면에서도 검토.
- Verified: `make check` 통과 — 21식·Wiki49페이지·테스트51개. Python3.9.6 및 별도 Python3.13에서 동일 테스트 통과. 잘못된 JSON 자료형210개 하위 사례 포함.
- Verified: `make engine-smoke`로 TTA·강의·가이드 JSON CLI 실행 통과. 비교 CLI는 구성 미확인 사례에서 incomparable/종료2 확인. JSON Schema 및 모든 예제, Ruff F/E9·포맷 검사 통과.
- Blockers: P1 완료를 막는 사항 없음. 원문 미확인·실측·현행성·네이티브 Excel 검증은 제품·출처 한계로 명시. 외부 모델·AWS API·Git 커밋·배포 없음.
- Next: P2에서 엔진을 재사용하는 입력·가정·계산 근거·시나리오·인쇄 산정서 웹 흐름 구현.

## 2026-09-27 — Wiki·벤치마크 조사·AWS 엑셀 반영·하네스 초기화 완료

- Status: 요청한 자료 정리와 harness-init 완료. 웹 계산 엔진·에이전트는 후속 구현 단계.
- Changed: 초기 52경로에 추가 AWS 엑셀을 포함해 53경로·33출처 등록. 처음 읽은 52파일은 초기 SHA-256과 모두 일치하며 추가 원본도 보존.
- Changed: PDF 188페이지, XLS/XLSX 셀·수식, HWP 문단 추출. 출처 카드 33개·개념 7개·계산식 명세 11개·독립 산술 예제 4개 작성.
- Changed: R3·강의·레거시 XLS의 모델 차이와 부록 수치 불일치 기록. R3 메모리 문구를 PDF 렌더에서도 확인.
- Changed: TPC-C·SPC-1·SPC-1C·SPEC 공식 링크와 비교 규칙, 결과 예시 3개 작성. SPC A32028·C00019의 관련 FDR 페이지 확인.
- Changed: 추가 AWS 엑셀 6시트 분석. TTA와 실측/직접/검증벤치 경로, gp3·가격 범위·MB/MiB 해석·미검증 주장을 구분. AWS 예제 산술 3개를 Decimal로 독립 확인.
- Changed: 제품 계획·계산 계약·하네스 문서/권한/gate 구성. resolver의 Claude 1.4.0 우선 탐색과 Makefile의 Codex 1.6.0 선택 차이를 프로젝트 경로 지정으로 해소.
- Verified: `make check` 통과 — 원본 53개·출처 33개·Wiki 47페이지·로컬 링크 357개·식 11개·예제 4개, 검증기 회귀 테스트 8개 통과.
- Verified: `harness-init.sh --check`, `make overnight-where` 통과. 양쪽 모두 설치된 1.6.0 사용. Python 구문·Wiki JSON 검사 통과.
- Blockers: Excel 네이티브 재계산, AWS 36행 사양 전수 대조, HWP 표·내장 그림 완전 변환, 공식 정오표 확인은 미수행. 파일의 PASS 문구를 이번 검증으로 주장하지 않음.
- Blockers: `git status -sb`로 Git 저장소가 아님을 확인. 기준 커밋·무인 실행 seed 없음. 모델 루프·커밋·push·배포는 실행하지 않음.
- Next: P1에서 R3 핵심 식의 단위·입력·반올림 계약을 확정하고 결정론적 계산 코어 구현. 이후 웹 산출물과 Wiki 에이전트 연결.

[현재 상태](STATUS.md) · [다음 작업](NEXT_PLAN.md)
