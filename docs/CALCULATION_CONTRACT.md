# 결정론적 계산 계약 1.0.0

상태: 구현 완료. [계산 엔진](../capacity_engine/__init__.py), [실행 예제](../examples/tta-appendix.json), [사용법](ENGINE_USAGE.md). HTTP API·웹 UI는 다음 단계다.

## 범위와 규칙 버전

`tta-r3-2023`은 TTAK.KO-10.0292/R3의 WEB/WAS·OLTP CPU, 메모리, 시스템/데이터 디스크, OLTP/Batch 추정 IOPS 7개 식을 실행한다. `lecture-network`는 강의 07의 대역폭·포트·업링크·스위칭 4개 식을 별도로 실행한다. 추가 `network-guide-2021`은 [2021 네트워크 가이드 식 10개](NETWORK_ENGINE.md)를 실행한다. 같은 요청에서 프로파일을 혼합하지 않는다.

[계산식 목록](../wiki/formulas/catalog.json)의 `rule_version`과 엔진 버전은 `1.0.0`이다. 레거시 XLS 재현, GPU·인메모리 특화 산정, AWS 실측 정규화·EC2 후보·gp3·비용 계산은 이 버전에 포함하지 않는다. AWS 엑셀과 가이드는 별도 모델의 출처로 보존했다.

## 요청 구조

기계 판독 스키마는 [calculate.schema.json](../schemas/calculate.schema.json)이다. JSON Schema는 구조를, 런타임 검증은 수치 범위·단위·날짜·계수 조합·출처·참조 관계를 검사한다.

| 필드 | 계약 |
| --- | --- |
| `schema_version` | 정수 1 |
| `profile_id`, `rule_version` | 위 프로파일 중 하나와 `1.0.0` |
| `scenario_id` | 1~80자 식별자. 영문·숫자로 시작, 영문·숫자·`_ . -` 사용 |
| `as_of` | 명시적 시나리오 기준일 `YYYY-MM-DD`. 시스템 시계에 의존하지 않음 |
| `assumptions`, `source_refs` | 가정과 입력 출처를 적는 문자열 목록. 내용이 없으면 빈 배열 |
| `calculations` | 계산 요청 1~100개 |

각 계산은 `id`, `system_id`, `formula_id`, `inputs`, `options`를 갖는다. 계산 ID는 요청 안에서 유일하다. 같은 시스템에 같은 식을 두 번 요청하거나 서로 다른 CPU 모델을 동시에 적용하지 않는다. 대안은 별도 시나리오로 계산한다.

입력 예:

```json
{
  "value": "70",
  "unit": "percent",
  "origin": "estimated",
  "evidence": "검토한 CPU 목표 활용률",
  "as_of": "2026-09-27"
}
```

수치는 **십진 문자열**만 받는다. JSON 숫자·boolean·지수 표기·공백·쉼표·`NaN`·`Infinity`·문자열 안의 `%`는 거부한다. 부호와 소수점을 제외한 최대 30자리다. `origin`은 `measured`, `estimated`, `source-default` 중 하나다. 비어 있지 않은 근거와 유효한 날짜가 필요하며, 근거 날짜는 시나리오 기준일 이후일 수 없다. 근거 문자열의 사실 여부를 자동 인증하지는 않는다.

필수 변수 누락, 입력 항목 자체의 `null`, 항목 안 `value: null`은 `incomplete`다. 0은 별도의 실제 값이다. 구조·형식·범위 오류는 `invalid`다. 알 수 없는 입력/옵션은 거부해 오타나 추가 가중치를 조용히 무시하지 않는다.

## 변수·단위·범위

| 식 | 변수와 입력 단위 |
| --- | --- |
| WEB/WAS | S1 `users`, S2 `ops/user/s`, S3~S9·S11 `factor`, S10 `ratio` 또는 `percent` |
| OLTP | O1 `transactions/min`, O2~O9 `factor`, O10 `ratio` 또는 `percent` |
| 메모리 | M1·M5 용량, M2 용량`/user`, M3 `users`, M4·M6 `factor` |
| 디스크 | D1·D2·D3·D6·D7 용량, D4·D5·D8 `factor` |
| IOPS | `oltp_tpmC` 또는 `batch_tpmC`의 `tpmC` |
| 네트워크 | 트래픽 `B`, 전송 시간 `s`, 포트 `ports`, 속도 `Gbps`, 보정계수 `factor` |

사용량은 0 이상, 사용자·포트 수는 정수다. 목표 활용률은 `0 < u <= 1`, 전송 시간은 0 초과다. 네트워크 역할 계수는 0 이상이며 가이드 프로파일에서는 1 이하로 제한한다. 일반 증폭 계수는 1 이상이다. WEB 업무용도 0.7은 별도 허용한다. 구조·숫자 한도는 제품 입력 정책이다.

`70 percent`는 `0.7 ratio`로 정규화한다. 가중치 1.3은 `factor`이며 30%와 혼용하지 않는다. 명시적 입력만 적용하고 성장·피크·여유·포맷 15%를 숨겨 추가하지 않는다. 가입자 수를 동시 사용자로 바꾸거나 미래 사용자 수를 자동 추정하지 않는다. 계산에 넣을 정수 인원과 업무량은 호출자가 근거와 함께 확정한다.

용량 단위는 `B, KB, MB, GB, TB, KiB, MiB, GiB, TiB`다. 십진/이진 단위를 정확한 배수로 변환한다. `options.capacity_unit`이 정규화·출력 단위를 정하며 M2는 해당 단위에 `/user`를 붙인다.

**`MB-as-labeled-in-source`는 물리 MB와 다르다.** TTA 원문에서 이진/십진이 불명확한 MB 표기를 보존하는 토큰이다. 모든 관련 입력이 이 토큰일 때 원 단위 계산만 허용하며 다른 용량 단위로 변환하거나 섞지 않는다. AWS 엑셀의 MiB 해석을 사용하려면 호출자가 각 입력을 명시적 MiB로 선언해야 한다.

강의 스위칭 식 `all_port_gbps`는 `unit: "Gbps"`, 포트별 속도 문자열 배열이다. 1~1,000개를 허용한다. 실제 선정한 다운링크와 업링크 포트를 모두 넣는다. 강의 프로파일에는 PPS 계산을 넣지 않는다. 추가 가이드 프로파일의 PPS는 문서가 명시한 이론적 상수와 한계를 함께 반환한다.

## 계수·아키텍처·중복 방지

S3=3, O2=5는 R3의 고정 계수다. WEB S4=0.7, WAS·WEB_WAS S4=2를 검증한다. WEB 연계 S7=1을 검증한다. WEB/WAS는 `benchmark_category`와 `server_class`가 필수다.

| 범주 | x86 | general | unix |
| --- | ---: | ---: | ---: |
| Composite | 29 | 30 | 31 |
| MultiJVM | 24 | 25 | 26 |

S11은 해당 표와 같아야 한다. 일반값·권고 범위에서 벗어난 피크·연계·클러스터·여유·활용률 등은 경고에 기록한다. 유효한 대체 계수의 근거를 숨기지 않기 위해 모든 일반값을 고정 상수로 잠그지는 않는다.

CPU 요청은 아키텍처·역할을 명시하고, 기본식 계산 후 다음 계층 가중치를 **엔진이 한 번만** 적용한다. 사용자 지정 계층 가중치 입력은 받지 않는다. 근거: R3 PDF p.19 표 6-7.

| architecture | role | CPU 식 | 가중치 |
| --- | --- | --- | ---: |
| `role-only` | WEB / WAS / DB | WEB·WAS / OLTP | 1 |
| `single-tier` | WEB_WAS_DB | OLTP | 2.1 |
| `two-tier-webwas-db` | WEB_WAS / DB | WEB·WAS / OLTP | 1.6 / 1 |
| `two-tier-web-wasdb` | WEB / WAS_DB | WEB·WAS / OLTP | 1 / 1.7 |
| `three-tier` | WEB / WAS / DB | WEB·WAS / WEB·WAS / OLTP | 1 / 1 / 1 |

`role-only`는 가중치 전 역할별 검토를 위한 제품 모드다. CPU 기본값과 최종값을 둘 다 반환한다. 메모리·디스크에 CPU 계층 가중치를 다시 곱하지 않는다. 같은 시스템의 WEB/WAS CPU S1과 메모리 M3가 다르면 거부한다. 서로 다른 시스템의 요구량이나 단위가 다른 CPU 결과를 합산하지 않는다.

디스크의 `options.raid`와 D8이 일치해야 한다. none=1, RAID1/RAID10/RAID01=2, RAID5=1.3, RAID6=1.4다. 이는 원문 일반계수이며 실제 디스크 개수·패리티·스페어 계산이나 백업 정책을 대체하지 않는다.

## 계산 결과 참조

IOPS 입력은 숫자 또는 다음 참조를 받는다.

```json
{"result_ref": "db-cpu", "unit": "tpmC"}
```

동일 시스템의 `TTA-OLTP-CPU` 결과만 참조한다. 요청 순서와 무관하게 CPU의 **최종 정확값**에 0.03 또는 0.01을 적용한다. 표시 반올림 값으로 계산하지 않는다. 없는 ID, 다른 시스템·식·단위, 잘못된 의존 결과는 거부한다. 참조한 CPU 입력이 누락됐다면 해당 IOPS도 `incomplete`다. 다른 CPU 식에 계산 결과를 다시 입력하는 참조는 허용하지 않는다. 추가 네트워크 프로파일의 포트·세션 참조와 올림 단계는 [별도 계약](NETWORK_ENGINE.md)을 따른다.

## 정확도·반올림·출력

입력은 Decimal로 파싱하고, 중간 곱셈·나눗셈은 정확한 유리수로 처리한다. 반복소수가 생겨도 아키텍처 가중치·IOPS 참조에서 중간 반올림하지 않는다.

| 결과 필드 | 의미 |
| --- | --- |
| `base_value` | 계층 가중치 전 기본식 결과 |
| `raw_value` | 최종값. 유한소수는 정확히, 반복소수는 유효숫자 50자리 HALF_EVEN으로 직렬화 |
| `exact_value` | 최종값의 정수 분자·분모 문자열. 정확한 계산 기준 |
| `display_value` | `display_places` 0~12자리, 기본 0자리 HALF_UP 표시 |
| `minimum_whole_value` | 정확값을 1단위로 올림한 값. 코어 수나 장비 추천이 아님 |
| `allocated_value` | 선택한 양수 `allocation_increment` 배수로 정확값을 CEILING한 값. 단위는 출력과 같음 |
| `trace` | 식, 원 입력, 정규화 값·단위, 중간 정확값, 계층 가중치, 반올림·할당 정책 |
| `source_refs` | 원문 출처 ID·SHA-256·PDF 물리 페이지 |

요청 스냅샷, 엔진·규칙 버전, 엔진 코드와 계산식 목록의 SHA-256을 반환한다. 같은 버전·코드·출처·입력은 같은 결과를 반환하며 생성 시각이나 무작위값은 넣지 않는다. 비교 시 raw 문자열의 반올림 근사를 새 계산의 정확값으로 재사용하지 않는다.

결과는 자원별 `calculated`/`incomplete`/`invalid` 상태를 유지한다. 전체 상태는 invalid가 최우선, 다음 incomplete, 모두 성공하면 calculated다. 한 자원의 누락으로 독립 자원의 유효 결과를 지우지 않는다. 요청 자체의 구조·프로파일·중복 식별자 오류는 전체 계산을 거부한다.

## 벤치마크 비교 계약

[benchmark.schema.json](../schemas/benchmark.schema.json)과 `compare_benchmark()`를 제공한다. 공식 레코드로 기록된 값만 받으며 출처를 온라인으로 검증하는 기능은 아니다. TPC-C, SPC-1, SPC-1C, SPECjbb2015는 각각 별도 종류·단위·실행 범주다.

종류·버전·범주·시험 범위·단위가 모두 같고, 기록 상태가 accepted이며 만료 전이고, 구성 대조 결과와 근거가 명시돼야 `compared`를 반환한다. 검토일은 비교 기준일 이후일 수 없다. 검토중·역사 자료·철회·만료·구성 미확인·다른 버전은 `incomparable`로 반환하며 성능 비율을 표시하지 않는다. 잘못된 단위·양수가 아닌 성능·비공식 도메인·구성 정보 누락은 invalid다.

`requirement_from_result()`는 최종 계산 결과를 보수적인 정수 올림 요구량으로 연결한다. tpmC→TPC-C, max-jOPS→동일 SPEC 범주, 추정 IOPS→SPC-1만 지원한다. 버전·시험 범위는 호출자가 명시한다. tpmC↔vCPU, SPC-1↔SPC-1C 변환은 제공하지 않는다. 정수 올림과 결과에서 후보를 비교하는 일은 실제 업무 성능 보증과 구분한다.

[검증 근거](ENGINE_VERIFICATION.md) · [전체 제품 계획](PRODUCT_PLAN.md) · [원문 불일치](../wiki/open-questions.md)
