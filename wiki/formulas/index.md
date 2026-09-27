# 계산 규칙 목록

아래 TTA·강의 식 11개와 추가 가이드 식 10개은 **계산 엔진 1.0.0에서 실행 가능**하다. [실행 방법](../../docs/ENGINE_USAGE.md)을 참고한다. 원문 수식과 적용 위치를 기록한 [기계 판독 목록](catalog.json)을 함께 관리한다.

| ID | 출력 | 식의 구조 | 근거 |
| --- | --- | --- | --- |
| TTA-WEB-CPU | max-jOPS | `S1*S2*S3*S4*S5*S6*S7*S8*S9/(S10*S11)` | R3 표 7-1, PDF p.19~20 |
| TTA-OLTP-CPU | tpmC | `O1*O2*O3*O4*O5*O6*O7*O8*O9/O10` | R3 표 7-8, p.26~27 |
| TTA-MEMORY | MB (원문 표기) | `(M1+M2*M3+M5)*M4*M6` | R3 표 7-13, p.33 |
| TTA-SYSTEM-DISK | 입력과 같은 용량 단위 | `(D1+D2+D3)*D4*D5*D8` | R3 표 7-14, p.35~36 |
| TTA-DATA-DISK | 입력과 같은 용량 단위 | `(D6+D7)*D4*D5*D8` | R3 표 7-14, p.35~36 |
| TTA-OLTP-IOPS | 추정 IOPS | `oltp_tpmC*0.03` | R3 표 7-16, p.38 |
| TTA-BATCH-IOPS | 추정 IOPS | `batch_tpmC*0.01` | R3 표 7-16, p.38 |
| NET-BANDWIDTH | bps | `traffic_bytes*8/transfer_seconds` | 강의 07 p.3의 정의를 정규화 |
| NET-DOWNLINK-PORTS | 포트 수 | `required_ports*expansion_factor*stability_factor` | 강의 07 p.5~6, 실제 포트 수는 제품 정책으로 올림 |
| NET-UPLINK | Gbps | `downlink_gbps*downlink_ports*role_factor` | 강의 07 p.6 |
| NET-SWITCHING | Gbps | `sum(all_port_gbps)*2` | 강의 07 p.6 |

첫 버전의 CPU 출력은 역할별 기본 산정치다. 참조 아키텍처 가중치는 별도 단계로 표시한다. 장비 대수나 코어 수 자동 추천은 이 목록의 범위를 넘어선다.

계산 뒤 장비 성능을 대조할 때는 [공식 TPC-C·SPC 벤치마크 링크와 사용 기준](../benchmarks.md)을 참고한다.

## 원문 예제의 독립 산술 확인

| 사례 | 원문 입력으로 다시 계산한 값 | 원문 표시값 | 사용 판단 |
| --- | ---: | ---: | --- |
| WEB/WAS CPU, p.43 | 2,801.8848 max-jOPS | 2,802 | 정수 반올림과 부합 |
| WEB/WAS 메모리, p.44 | 5,585.320 MB | 5,585 | 계산 결과만 사용. 같은 페이지의 1,024MB 선정은 제외 |
| WEB/WAS 시스템 디스크, p.44~45 | 57,108.480 MB | 57,108 | 계산 결과와 부합 |
| DB 시스템 디스크, p.47 | 64,722.944 MB | 표 64,723 / 설명 12,167 | 표와 부합, 설명과 불일치 |

[예제 입력 기록](examples.json)의 독립 산술 결과와 계산 코어의 회귀 테스트가 일치함을 확인했다. Excel 네이티브 재계산이나 웹 UI 검증은 포함하지 않는다. 메모리·디스크는 모호한 원문 MB 표기를 보존하며 명시적 물리 단위와 섞어 변환하지 않는다.

계수의 일반값을 자동 확정하지 않는다. 선택 이유, 적용 범위, 단위, 사용자 확인 여부를 저장한다. [계산 계약](../../docs/CALCULATION_CONTRACT.md)과 [불일치](../open-questions.md)를 함께 읽는다.

출처: [TTA R3](../sources/tta-r3.md), [강의 07](../sources/lecture-07.md).

[Wiki 처음으로](../index.md)

## 2021 네트워크 가이드 식 10개

`GUIDE-ACCESS-PORTS`, `GUIDE-ACCESS-UPLINK`, `GUIDE-UPLINK-PORTS`, `GUIDE-ACCESS-SWITCHING`, `GUIDE-ACCESS-PPS`, `GUIDE-BACKBONE-SWITCHING`, `GUIDE-BACKBONE-PPS`, `GUIDE-TARGET-SESSIONS`, `GUIDE-L47-THROUGHPUT`, `GUIDE-WDM-CAPACITY`를 구현했다. 식·단위·페이지는 [목록](catalog.json), 적용 정책과 예제는 [네트워크 엔진 계약](../../docs/NETWORK_ENGINE.md)을 참고한다.
