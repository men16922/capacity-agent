# 견적 입력 항목과 근거

2026-09-28. 특정 기업·IDC·사업자명을 기본 분류로 사용하지 않는다. 실제 제품명은 자산별 조사값으로만 기록한다. TTA 단체표준, AWS 공식 평가 지침, 사용자 실측·가정을 서로 구분한다.

## 공식 참고 자료

- [한국정보통신기술협회 — 정보시스템 하드웨어 규모산정 지침, TTAK.KO-10.0292/R3](https://committee.tta.or.kr/data/standard_view.jsp?commit_code=PG423&nowSu=1&pk_num=TTAK.KO-10.0292%2FR3): 2023-12-06 개정. 2026-09-28 공식 상세·표준이력에서 R3 유효 표시 확인. 개별 식·예제는 보유한 동일 버전 PDF의 절·페이지로 추적한다. 모든 정오표를 조사했다는 의미는 아니다.
- [AWS Prescriptive Guidance — Understanding complete assessment data requirements](https://docs.aws.amazon.com/prescriptive-guidance/latest/application-portfolio-assessment-guide/understanding-complete-assessment-data-requirements.html): Applications, Infrastructure, Networks, Migration 항목을 견적 조사 구조의 근거로 사용한다. AWS 권고 지침이며 국가·국제 강제 표준으로 표시하지 않는다. 2026-09-28 본문 확인.
- [AWS — Establishing a baseline for the application portfolio](https://docs.aws.amazon.com/prescriptive-guidance/latest/application-portfolio-assessment-guide/baseline-application-portfolio.html): 애플리케이션과 자산 연결, 의존성 및 이전 범위 관리의 근거. 2026-09-28 본문 확인.

## 현재 입력 가능한 항목

| 묶음 | 입력 | 공식 지침의 대응 항목 | 제품에서의 처리 |
| --- | --- | --- | --- |
| 자산 식별 | ID·서버 이름·역할 | Infrastructure: identifier, network name; Applications: type | CSV 가져오기 시 프로젝트 고유 ID 생성 |
| 자산 유형 | 물리 서버·가상 서버·하이퍼바이저·컨테이너 등 | Infrastructure: asset type | 범용 자유 입력. 호스트/게스트 관계와 중복 산정은 사람이 검토 |
| 업무 연결 | 운영 환경·애플리케이션 연결 | Applications: environment; Infrastructure: application mapping | 선택 입력, 미입력은 미확인 |
| 플랫폼 | OS·아키텍처·OS 버전·소프트웨어/DB 제품·버전 | Infrastructure: operating system, product name; Applications: COTS product/version | 계산 지원 OS는 Linux/Windows. 제품 버전은 검토 정보 |
| 사양 | 논리 CPU·메모리·논리 디스크 사용량 | Infrastructure: configuration, utilization | 십진 문자열·단위 검증. 원시 RAID 용량과 분리 |
| 실측 | CPU/메모리 피크·IOPS·처리량·네트워크·측정일·근거 | Infrastructure: utilization, data transfer; Networks: link utilization | 측정 구간·통계량은 근거에 기록. 평균과 피크를 혼용하지 않음 |
| 라이선스 | 라이선스 조건 | Applications/Infrastructure: license | 자동 라이선스 판정·별도 비용 계산 없음 |
| 연계·복구 | 내부/외부 의존성·가용성/재해복구 요구 | Applications: dependencies, DR information | 공유 스토리지·외부 연결·RTO/RPO는 확인한 범위에서 기록. 누락을 자동 충족으로 간주하지 않음 |

후보 선정은 자산당 독립 계산이다. `asset_type=하이퍼바이저`라고 입력해도 게스트를 자동 식별·합산하거나 호스트를 제외하지 않는다. AWS 이전 대상 목록에 넣을 실제 산정 단위를 먼저 정리해야 한다.

## 견적서 확장 시 추가할 항목

| 항목 | 근거 | 현재 경계 |
| --- | --- | --- |
| 이전 대상 포함/제외·전략·우선순위·Wave | AWS portfolio baseline, Applications: migration strategy/criticality | 자동 대상 선별·의존성 그래프·Wave 편성 미구현 |
| 담당자·업무 중요도·규제 요구 | AWS Applications: owner, criticality, compliance | 현재 전용 구조화 입력 없음 |
| RTO/RPO·백업 보관·데이터 전송량·회선·지연 | AWS Applications/Networks/Infrastructure | 복구·의존성 설명 입력만 제공. 상세 비용/검증은 후속 |
| 이관 공수·단가·도구비·전환 기간·병행 운영비 | AWS Migration: effort/rates, tools, duration, parallel cost | 현재 EC2+EBS 소계에 포함하지 않음 |
| 데이터 저장소별 사용량·증가율·분할 볼륨 | AWS configuration/utilization 및 제품 사양 | 현재 노드당 단일 gp3 초안만 계산 |

## TTA 디스크 입력 표시

| 입력 | 의미 | 표시 단위 | 근거 |
| --- | --- | --- | --- |
| D1 | OS 영역 | MB(원문 표기) 또는 명시한 용량 단위 | §7.3, 표 7-14·§7.3.2.1 |
| D2 | 응용 프로그램 영역 | 동일 | §7.3.2.2 |
| D3 | SWAP 영역 | 동일 | §7.3.2.3 |
| D4 | 파일시스템 보정 | 배율 | 표 7-14·§7.3.2.4 |
| D5 | 디스크 여유율 | 배율 | 표 7-14·§7.3.2.5 |
| D8 | RAID 보정 | 배율 | 표 7-14·§7.3.2.8 |

본문 §7.3은 PDF p.35–37(인쇄 p.30–32)이다. 초기 숫자는 부록 Ⅰ 예제(PDF p.43–48)를 재현하는 값이며 현재 OS·업무의 권장 용량이 아니다. TTA의 RAID 계수를 AWS EBS에 자동 적용하지 않는다.

화면은 공식 문서명·표준번호·웹 링크·절/페이지로 출처를 표시한다. 내부 source ID, 해시, 로컬 파일 경로는 원문 보존·재현용으로 유지한다. `MB-as-labeled-in-source` → `MB(원문 표기)`, `factor` → `배율`은 표시 변경이며 JSON·산술 단위는 변경하지 않는다. 원문 MB를 MiB로 추정 변환하지 않는다. 입력 기준일, 표준 개정일, 웹 확인일은 각각 표시한다.

공식 링크가 확인되지 않은 참고 자료는 그 사실을 밝힌다. 비공식 강의·업무 파일을 공인 표준으로 격상하거나 공식 자료의 내용을 확인하지 않고 대체 출처를 붙이지 않는다.

[제품 기획](PRODUCT_PLAN.md) · [다수 자산 설계](MIGRATION_PORTFOLIO.md) · [사용 가이드](WEB_USAGE.md)
