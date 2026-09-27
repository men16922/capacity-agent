# 용량산정에 참고할 공식 벤치마크

조사일: **2026-09-27**. 공식 TPC·SPC·SPEC 자료를 확인했다. 아래 링크는 요구 성능을 계산한 다음 후보 장비의 **시험 구성과 성능 근거**를 검토하는 데 사용한다. 순위표의 숫자를 실제 업무 처리량으로 보장하지 않는다.

## 바로가기

| 목적 | 공식 링크 | 확인할 정보 |
| --- | --- | --- |
| TPC-C 의미 | [TPC-C 소개](https://www.tpc.org/tpcc/) · [FAQ](https://www.tpc.org/tpcc/faq5.asp) | tpmC와 시험 범위 |
| TPC-C 전체 결과 | [성능순 전체 결과](https://www.tpc.org/tpcc/results/tpcc_results5.asp?version=2) | 시스템명, tpmC, DBMS, OS, 제출일 |
| 단일 서버 후보 조사 | [비클러스터 결과](https://www.tpc.org/tpcc/results/tpcc_perf_results5.asp?resulttype=noncluster) | 클러스터 대형 결과와 구분 |
| TPC 결과 수집 | [공식 다운로드](https://www.tpc.org/information/results_spreadsheet5.asp) | XLSX·TXT 목록. 필요할 때 날짜를 기록해 수집 |
| SPC 시험 종류 | [SPC 벤치마크 설명](https://storageperformance.org/benchmarks) | SPC-1·1C·2·2C 구분 |
| 스토리지 시스템 | [SPC-1·SPC-1/E 결과](https://storageperformance.org/benchmarks/results/spc1-spc1e) | IOPS, 규격 버전, ES/FDR, 제출·승인 상태 |
| 스토리지 구성요소 | [SPC-1C·SPC-1C/E 결과](https://www.storageperformance.org/benchmarks/results/spc1c-spc1ce) | 목록 분류 문제에 유의. 보고서의 시험명을 직접 확인 |
| SPC 규격·가격 정의 | [공식 규격 목록](https://storageperformance.org/specifications) | 버전, 적용일, 시험 조건, Pricing Guide |
| WEB/WAS 성능 지표 | [SPECjbb2015 실행·보고 규칙](https://www.spec.org/jbb2015/docs/runrules.pdf) | max-jOPS·critical-jOPS, 실행 범주와 비교 규칙 |

기계가 읽을 링크 목록은 [외부 출처 목록](sources/external-links.json)에 있다. 전체 결과표를 복제하거나 자동 수집하는 기능은 아직 없다.

## CPU 산정에서 TPC-C를 사용하는 방법

정식 벤치마크 이름은 **TPC-C**, 단위는 **tpmC**다. tpmC는 정해진 혼합 트랜잭션을 수행하는 동안의 분당 New-Order 처리량이다. CPU 이름만으로 결정되는 값이 아니며 서버·DBMS·메모리·스토리지 구성까지 함께 읽어야 한다. TPC도 특정 고객 업무의 정확한 용량 예측보다 시스템 비교의 기준으로 설명한다. [TPC-C FAQ](https://www.tpc.org/tpcc/faq5.asp)

산정 tpmC와 비교할 후보를 찾은 다음 상세 결과와 Full Disclosure Report(FDR)를 열어 CPU 모델·소켓·코어·메모리·DBMS·OS·스토리지·클러스터 여부를 대조한다. 현재 판매 중인 다른 구성으로 점수를 옮기거나 코어 수에 비례해 공식 점수를 만들어서는 안 된다. 추정치는 공식 측정값과 구분한다.

읽기 예시: [LtechKorea LKG2312 상세 결과](https://www.tpc.org/tpcc/results/tpcc_result_detail5.asp?id=123092901&lang=)에는 279,185 tpmC, Xeon Gold 6354, 프로세서 2개·총 36코어, DB2 11.5.8, 비클러스터 구성과 결과 상태가 함께 제시된다. 제출일은 2023-09-29이며, 조회한 상세 페이지의 Active Expiration Date는 2026-10-02다. 장비 추천이 아니라 **점수와 구성을 함께 읽는 사례**다. 구매·사용 시 상태를 다시 확인한다.

TPC의 가격/성능은 해당 시험 구성의 가격 기준이다. CPU 가격이나 현재 국내 견적과 동일하지 않다. 다른 통화의 가격/성능을 단순 순위 비교하지 않는다. [TPC 비클러스터 결과 안내](https://www.tpc.org/tpcc/results/tpcc_perf_results5.asp?resulttype=noncluster)

## SPC-1과 SPC-1C를 구분하기

| 기준 | SPC-1 | SPC-1C |
| --- | --- | --- |
| 대상 | 스토리지 서브시스템 | 드라이브·HBA·컨트롤러·소규모 구성 등 구성요소 |
| 중심 부하 | 조회·갱신을 포함하는 랜덤 I/O | 구성요소에 대한 같은 계열의 랜덤 I/O |
| 활용 | 스토리지 어레이·시스템 후보 검토 | 디스크·컨트롤러 등 구성요소의 시험 근거 확인 |
| 산정 연결 | TTA R3 §7.4가 참조하는 기준 | SPC-1 시스템 결과를 대체하지 않음 |

시험 대상 구분은 [SPC 공식 설명](https://storageperformance.org/benchmarks), TTA 연결은 [첨부 R3](sources/tta-r3.md) PDF p.38을 근거로 한다. SPC-2 계열은 순차 데이터 이동 중심이므로 랜덤 IOPS와 별도 지표로 다룬다.

SPC-1 공식 결과 페이지는 version 3의 active publication 목록이며 version 1은 2017년 종료 후 역사 자료로 남아 있다고 설명한다. v1과 v3 결과는 직접 비교하지 않는다. 조사 시 규격 목록에는 SPC-1 v3.10(2021-01-01), SPC-1C v1.5(2013-05-12)가 게시되어 있다. [SPC-1 결과 안내](https://storageperformance.org/benchmarks/results/spc1-spc1e), [SPC 규격 목록](https://storageperformance.org/specifications)

## 결과표에서 상세 보고서로 내려가기

SPC-1 목록의 예시 A32028(Gluesys AnyStor 700-EK)은 800,010 SPC-1 IOPS와 규격 3.10을 표시한다. 같은 행의 상태는 조회 자료에서 `Submitted for Review`였으므로 승인 완료로 바꾸어 기록하지 않는다. 가격/성능 열은 **KIOPS당** 단위다. 다른 자료의 IOPS당 가격과 혼동하면 1,000배 차이가 난다. [공식 결과 행](https://storageperformance.org/benchmarks/results/spc1-spc1e)

- [A32028 Executive Summary](https://storageperformance.org/sites/default/files/files/executive_summary/A32028_ES.pdf): 1페이지 요약. IOPS 응답시간 0.117ms, 물리 61,440GB, ASU 22,441GB를 각각 구분해 표시한다. ASU는 시험 중 접근하는 데이터 영역이며 일반적인 판매 용량과 동일시하지 않는다.
- [A32028 Full Disclosure Report](https://storageperformance.org/sites/default/files/files/full_disclosure_report/A32028_FDR.pdf): p.7 요약, p.10 구성, p.11 연결, p.12 용량·보호 방식. 8개 NVMe SSD, 단일 컨트롤러, 100Gbps IB 연결 및 RAID 1+0 구성이다. 같은 제품명이어도 구성이 달라지면 이 측정값을 그대로 적용할 수 없다.
- [SPC-1C 보고서 예시 C00019](https://www.storageperformance.org/sites/default/files/results/C00019/c00019_Seagate_ST600MP0065_Enterprise-Performance_SPC-1C_full-disclosure-report.pdf): p.10~11과 p.17을 확인했다. 2014-11-03 제출, SPC-1C v1.5, 4,700.46 SPC-1C IOPS이며 **Seagate 600GB HDD 24개와 RAID 컨트롤러**를 포함한다. 제품명이 디스크라고 해서 이 수치를 디스크 1개 성능으로 읽으면 안 된다. 과거 시험의 읽기 사례이며 현재 구매 후보 추천은 아니다.

위 PDF들은 웹 열기 도구에서 실패한 뒤 공식 URL 직접 읽기로 복구해 관련 페이지를 확인했다. [예시 레코드](sources/benchmark-samples.json)에 값·구성·검토 페이지를, [링크 목록](sources/external-links.json)에 다운로드 SHA-256과 확인 범위를 남겼다. 전체 보고서의 모든 시험 조건을 감사한 것은 아니다.

조사 시 SPC-1C 결과 페이지의 제목 아래에 SPC-1·SPC-2 행이 함께 나타났다. 페이지 제목만 보고 전체 행을 SPC-1C로 분류하면 안 된다. **제출 ID, 개별 보고서 제목, 규격 버전, 실제 metric**을 함께 확인한다. 이 관찰은 사이트의 내부 오류 원인을 확정한 것은 아니다. [조회한 SPC-1C 결과 페이지](https://www.storageperformance.org/benchmarks/results/spc1c-spc1ce)

## 산정 결과와 연결할 필드

다음은 향후 웹·에이전트에 적용할 설계안이다.

| 필드 | 내용 |
| --- | --- |
| 식별·출처 | benchmark 종류·버전·결과 ID, 공식 상세 URL·FDR URL, 확인일 |
| 상태·시점 | Accepted/In Review/Historical/Withdrawn 등 원문 상태, 제출일·가용일·만료일 |
| 비교 단위 | tpmC, SPC-1 IOPS, SPC-1C IOPS, max-jOPS와 실행 범주 |
| 시험 구성 | CPU·소켓·코어·메모리·DBMS·OS 또는 컨트롤러·매체·RAID·연결 구성 |
| 성능 조건 | 처리량, 지연 특성, 부하 조건, 데이터 보호·압축·중복제거 조건 |
| 공간·가격 | 물리·사용 가능·시험 데이터 용량, 가격 통화·기준일·포함 범위 |
| 사용 판단 | 산정 모델과 비교 가능한지, 구성 차이, 미확인 필드, 후속 실측 |

흐름은 **요구 성능 계산 → 동일 지표·범주의 후보 조회 → FDR 구성 확인 → 요구량과 후보 성능의 관계 표시 → 실제 업무 검증**으로 제안한다. 비교 조건이 맞아야 비율을 표시하며 그 비율은 서비스 보증이나 실제 이용률이 아니다. 이미 목표 활용률과 여유율을 넣은 산정값에 같은 계수를 다시 적용하지 않는다.

벤더 추정 tpmC, 다른 SPEC 지표, PassMark CPU 점수, 제조사의 최대 IOPS를 공식 TPC-C/SPC 점수로 변환하는 범용 계수는 두지 않는다. 공식 시험 자료가 없으면 “미등록/추가 검증 필요”로 남긴다.

[CPU 산정](concepts/cpu-sizing.md) · [메모리·스토리지](concepts/memory-storage.md) · [계산식](formulas/index.md) · [Wiki 처음으로](index.md)
