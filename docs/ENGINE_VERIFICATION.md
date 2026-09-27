# 계산 엔진 완료 검증

목표: `계산 엔진 완료시까지 수행`. 기준 범위는 NEXT_PLAN의 P1 다섯 항목과 작업 중 추가된 네트워크 가이드다. 코드·실행 예제·계약·테스트를 함께 확인한다.

## 요구사항과 증거

| 요구사항 | 구현·검증 증거 |
| --- | --- |
| 입력 스키마·단위·범위·반올림 정책 | [계산 계약](CALCULATION_CONTRACT.md), [JSON Schema](../schemas/calculate.schema.json), [숫자·단위 코어](../capacity_engine/numeric.py). 누락/0/숫자 형식/비율/단위/반올림/입력 한도 테스트 |
| WEB/WAS·OLTP CPU 및 메모리 | [엔진](../capacity_engine/engine.py), [규칙](../capacity_engine/rules.py), TTA 독립 Decimal 예제 4개와 OLTP Fraction 기준, 단조성·0·경계 테스트 |
| 시스템/데이터 디스크와 추정 IOPS | RAID 선택과 계수 일치, 포맷15% 미가산, 원문 단위 보존, CPU 최종 정확값→IOPS 참조 테스트 |
| 아키텍처 가중치·역할별 결과 | 역할별·1계층·두 가지2계층·3계층의 모든 허용 조합 테스트. 잘못된 모델/역할, 임의 추가 가중치, 같은 시스템의 이중 CPU 모델 거부 |
| 벤치마크 스키마·비교 조건 | [벤치마크 모듈](../capacity_engine/benchmarks.py), [스키마](../schemas/benchmark.schema.json). TPC-C/SPC-1/SPC-1C/SPEC 종류·버전·상태·범주·범위·만료·구성·공식 URL 검사 |
| 기존 강의 네트워크 4개 식 | [network.json](../examples/network.json)의 bandwidth·ports·uplink·switching 전부 실행. 포트 올림과 구매 단위 올림 구분 |
| 추가 가이드 네트워크 10개 식 | [네트워크 계약](NETWORK_ENGINE.md), [예제](../examples/network-guide.json). 각 식의 독립 예상값, 포트·세션 단계 올림, 참조 순서, 0 나눗셈·누락·범위·프로파일 혼합 테스트 |
| 결정론·추적 가능성 | 입력 불변, 반복 실행 동일, 외부 Decimal context 독립, exact 분자/분모, source/catalog/engine hash와 입력 snapshot 검증 |
| 실제 실행 | Python API와 `python3 -m capacity_engine` CLI. 유효 JSON, stdin, 실패 종료 코드, 중복 JSON 키 검사 |
| 원본 보존·문서 연결 | `make check`의 해시·재고·로컬 링크·식 출처·문서 도달 가능성 검사 |

테스트 구현: [test_engine.py](../tests/test_engine.py), [test_wiki_checks.py](../tests/test_wiki_checks.py). 엔진 테스트는 고정 표시 문자열만 확인하지 않고 독립 산술, 수요/활용률 변화 불변식, 오류 입력, 비교 거부 조건을 검증한다. 여러 잘못된 JSON 자료형을 넣는 210개 하위 사례도 포함한다.

## 실행 기록

2026-09-27 `make check`의 테스트51개가 Python3.9.6과 별도 Python3.13 환경에서 통과했다. `make engine-smoke`의 CLI3개 예제, Draft2020-12 스키마 및 모든 예제, Ruff F/E9·포맷 검사도 통과했다. 상세 결과는 [진행 기록](PROGRESS_LOG.md)에 기록했다. 표준 라이브러리 런타임과 프로젝트 파일을 사용하며 외부 LLM·AWS·벤치마크 사이트 호출 없이 검증한다.

## 검증 범위의 한계

- 원문에 근거한 산식 재현과 제품 입력 정책을 검증했다. 실제 서비스 처리량·장비 성능·가용성·현행 법규의 적합성 검증은 아니다.
- 네트워크 가이드 p.8~9의 표는 렌더 화면에서도 대조했다. 문서의 F(x) 미명세와 안정성 범위 충돌, L4/L7 유지시간 누락은 [정책](NETWORK_ENGINE.md)과 [불일치 목록](../wiki/open-questions.md)에 남겼다.
- AWS 엑셀·가이드의 해시가 달라 동일 버전으로 취급하지 않았다. Excel 네이티브 재계산과 AWS 사양 전수 검증을 이번 엔진 테스트로 대체하지 않는다.
- 웹 UI·HTTP API·인쇄 산정서·LLM 연결과 AWS 전용 계산·장비 선정은 후속 단계다. P1 완료를 이 기능들의 완료로 표현하지 않는다.

[현재 상태](STATUS.md) · [다음 작업](NEXT_PLAN.md) · [실행 방법](ENGINE_USAGE.md)
