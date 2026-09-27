# Status

Last Updated: 2026-09-28

## 현재 기준

- P2.2 구현·문서·리팩토링·로컬 검증 완료. public 반영과 원격 CI 확인 진행 중.
- Capacity Agent 최상위 프로젝트 목록과 선택 후 통합 대시보드. 좌측 On-Prem/AWS 메뉴 및 프로젝트·환경·자산 경로.
- IndexedDB 프로젝트별 저장·legacy 원본 보존·생성/가져오기 분리·revision 충돌 보호. 계정/공동 편집은 미지원.
- On-Prem 목록·페이지·CSV·별도 상세·사용량/사용률 입력·실사용 최적화·저장·동일 자산 비교·산정서. TTA/네트워크21식은 별도 모델.
- AWS 마이그레이션 최대200개 목록·일괄 산정·개별 상세5탭·조건/후보 설정·선택 일괄 검토 저장. 오래된 결과·중복·한도는 저장 차단.
- AWS 운영 자산·사용률 최적화·EC2/gp3 후보·현재/제안 부분 비용·최적화 시나리오·비교·산정서.
- 원본56경로·36출처·Wiki51페이지·21식 유지. 공식 서울36사양·EC2 On-Demand+gp3 스냅샷. 사양 확인2026-09-27, 가격표 발행2026-09-25.
- `make check engine-smoke`: 원본/출처 검사·Python77개·CLI 통과. Ruff·TypeScript strict/noUnusedLocals·production build 통과.
- Playwright20개 전체 통과(44.4초). 프로젝트 분리/충돌·48/200개 산정·일괄 저장 거부 조건·사용률 등가·최적화 JSON 재계산·기존 golden·모바일/키보드/axe 검증.
- 실제 Chrome에서 기존 프로젝트 보존, 별도 예제48개 일괄 저장, On-Prem/AWS 최적화 각각1개 저장·산정서·새로고침 확인. [화면](images/project-dashboard.png).
- 기획/설계/사용 가이드·데이터 계약은 [문서 안내](README.md). 기존 코드4b9043d의 [원격 CI](https://github.com/men16922/capacity-agent/actions/runs/36333255452)는 P2.1 증거이며 이번 변경과 구분한다.
- 로컬 `http://127.0.0.1:8765` 기동, 사용자 Chrome의 통합 대시보드 유지. 모델·무인 루프·AWS 변경은 실행하지 않음.

## 남는 제품 범위

- P3 Wiki 검색·요구사항 에이전트, 자산/제품 버전별 보안 검토·증적 관리.
- 실제 AWS 자원 생성·데이터 이관·성능/장애전환 시험·Compute Optimizer 연결·시계열 수집·공개 호스팅·인증·공동 편집은 미수행.
- 현재 AWS 범위는 서울36사양·EC2/gp3 단일 볼륨이다. 네트워크·백업·세금·별도 라이선스·할인 비용은 제외한다. EBS 축소는 새 볼륨으로 이동 필요.
- HWP 표/그림 완전 변환·Excel 네이티브 재계산·TTA 정오표 전수 확인·현행 보안 기준 대조는 미완료. 가이드/워크북 해시와 MB/MiB·네트워크 모델 충돌은 Wiki에 유지.

[웹 사용법](WEB_USAGE.md) · [검증](WEB_VERIFICATION.md) · [다음 작업](NEXT_PLAN.md) · [진행 기록](PROGRESS_LOG.md)
