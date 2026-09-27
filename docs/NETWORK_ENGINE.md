# 네트워크 계산 엔진 계약

`network-guide-2021`은 사용자 제공 [네트워크장비 규모산정시스템 사용 가이드라인](../wiki/sources/pdf-b07aabe8f7d6.md)의 본문 식을 구현한다. 문서는 TTAK.KO-01.0103/R1(2017-06-28)을 인용하지만, 이 프로파일은 2021년 가이드의 확인한 식과 명시한 제품 정책에 고정한다. 현행 표준 준수 인증이나 실제 장비 시험 결과는 아니다.

공통 입력·오류·단위·반올림 계약은 [계산 계약](CALCULATION_CONTRACT.md)을 따른다. 실행 예제는 [network-guide.json](../examples/network-guide.json)이다.

```sh
python3 -m capacity_engine calculate examples/network-guide.json
```

## 식과 단위

| ID | 식 | 출력 | PDF 물리 페이지 |
| --- | --- | --- | ---: |
| GUIDE-ACCESS-PORTS | 필요 포트 × 확장 × 안정성 | ports | 8 |
| GUIDE-ACCESS-UPLINK | 포트당 Gbps × 정수 다운링크 포트 × 역할계수 | Gbps | 8 |
| GUIDE-UPLINK-PORTS | ceil(요구 Gbps / 선택한 포트 Gbps) × 경로 수 | ports | 8·14, F(x)를 구체화한 제품 정책 |
| GUIDE-ACCESS-SWITCHING | 실제 선택한 포트별 Gbps 합 × 2 | Gbps | 8 |
| GUIDE-ACCESS-PPS | 실제 선택한 포트별 Gbps 합 × 1,488,095 | theoretical-pps | 8 |
| GUIDE-BACKBONE-SWITCHING | 포트별 Gbps 합 × 확장 × 안정성 × 2 | Gbps | 9 |
| GUIDE-BACKBONE-PPS | 포트별 Gbps 합 × 확장 × 안정성 × 1,488,095 | theoretical-pps | 9 |
| GUIDE-TARGET-SESSIONS | 최근 최대 세션 수 × (1 + 평균 증가율) | sessions | 9 |
| GUIDE-L47-THROUGHPUT | 정수 목표 세션 × 세션당 bytes × 8 / 평균 유지시간 s × 확장 | bps | 9·14, bytes→bits 정규화 |
| GUIDE-WDM-CAPACITY | WDM Line 포트별 Gbps 합 × (1 + 트래픽 증가율) × 확장 | Gbps | 10 |

포트별 용량 배열은 **물리 포트마다 한 값**을 넣는다. 예를 들어 10Gbps 포트 4개는 `["10", "10", "10", "10"]`이다. 이로써 인터페이스 종류별 `최대 용량 × 포트 수`의 합을 표현한다. 접속형 스위칭/PPS는 이미 선정한 전체 포트를 사용하고, 백본형 식은 입력 포트 합에 확장·안정성을 적용한다. 어느 단계에 성장과 여유가 반영됐는지 근거에 기록해 중복 적용을 피한다.

## 입력 정책

- 확장 계수: 접속형·백본형 1~2. 안정성 계수: 본문 표 기준 1~1.5. p.14의 UI 설명 1~2와 다름을 명시한다.
- 역할 계수: 0~1의 `factor`. 실제 접속 포트의 서비스 특성을 분석해 입력한다. 입력을 생략하면 일반값 0.1을 자동 확정하지 않는다.
- 성장률: 0 이상, `ratio` 또는 `percent`. 20% 성장=`0.2 ratio` 또는 `20 percent`. 3개년 평균 증가율을 이미 계산한 값이며, 이를 다시 3제곱하지 않는다. 성장 없음은 0이다.
- 포트·세션 수: 0 이상의 정수. 수요가 0이면 필요량도 0이 될 수 있다.
- 포트 용량: 단위 Gbps. 업링크 선정에 사용할 포트 용량은 반드시 0 초과다.
- `redundancy_factor`: 1 또는 2의 정수 `factor`. **각 경로가 요구량 전체를 처리하도록 포트 수를 복제**하는 이 버전의 명시적 정책이다. 서로 다른 이중화 기술의 성능·장애 동작을 일반화하지 않는다.
- L4/L7 데이터량: `B/session`, 평균 유지시간: 0 초과 `s`. 데이터량을 대역폭처럼 취급하거나 평균 유지시간을 1초로 가정하지 않는다.
- 시스템 확장 계수는 L4/L7·WDM에서 1 이상이다. 가이드의 일반값 1.2를 자동 입력하지 않는다.

원문의 F(x)는 가능한 인터페이스 집합·개수 제한·비용 최적화 순서를 정의하지 않는다. 따라서 엔진은 명시적으로 선택한 포트 속도에서 필요 개수를 구한다. 인터페이스 속도 선택·라인카드 수·슬롯·광모듈·제조사 카탈로그 매칭은 후속 장비 선정 기능이다.

## 단계 간 연결

참조는 같은 `system_id` 안에서 다음 경로만 허용한다.

| 대상 입력 | 참조 가능한 식 | 가져오는 값 |
| --- | --- | --- |
| GUIDE-ACCESS-UPLINK.downlink_ports | GUIDE-ACCESS-PORTS | 정확값을 정수 올림한 포트 수 |
| GUIDE-UPLINK-PORTS.required_uplink_gbps | GUIDE-ACCESS-UPLINK | 반올림 전 정확한 Gbps |
| GUIDE-L47-THROUGHPUT.target_sessions | GUIDE-TARGET-SESSIONS | 정확값을 정수 올림한 세션 수 |

참조 예: `{"result_ref": "access-ports", "unit": "ports"}`. 기본식의 소수 결과는 그대로 반환하고, 다음 단계가 실제 개수를 요구할 때만 올림한다. trace의 정규화 입력과 정확값으로 이 차이를 확인할 수 있다. 최종 스위칭·PPS에 넣을 실제 포트 구성은 사용자가 명시하며, 추가 포트·이중화 포트를 빠뜨리지 않았는지 설계 검토가 필요하다.

## 재현 예제

[실행 예제](../examples/network-guide.json)는 가상 입력이며 장비 추천이 아니다.

| 단계 | 결과 |
| --- | --- |
| 접속 포트 21개 × 1.2 × 1.2 | 30.24 → 다음 단계에는 31포트 |
| 1Gbps × 31포트 × 역할 0.1 | 업링크 요구 3.1Gbps |
| 선택 10Gbps, 전체 용량 경로 2개 | ceil(3.1/10) × 2 = 2포트 |
| 실제 1Gbps 31개 + 10Gbps 2개 | 스위칭 102Gbps, 이론적 75,892,845pps |
| 백본 10Gbps 8개 + 40Gbps 2개, 확장/안정성 각각1.2 | 460.8Gbps, 이론적 342,857,088pps |
| 1,001세션, 증가율20% | 1,201.2 → 처리량 계산에는 1,202세션 |
| 세션당1,000,000bytes, 유지10초, 확장1.2 | 1,153,920,000bps |
| WDM Line 100Gbps 2개, 증가율20%, 확장1.2 | 288Gbps |

이론적 PPS에는 원문의 1GE 상수를 적용한다. 프레임 크기·기능 활성화·실제 장비 처리능력은 별도 측정 대상이다. 이 결과를 SPC IOPS나 TCP bps로 변환하지 않는다. MSPP·캐리어이더넷은 첨부 가이드에 재현 가능한 상세 식이 없어 구현 범위에 넣지 않았다.

[전체 식 목록](../wiki/formulas/index.md) · [불일치 목록](../wiki/open-questions.md) · [검증 근거](ENGINE_VERIFICATION.md)
