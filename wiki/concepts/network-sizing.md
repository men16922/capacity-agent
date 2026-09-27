# 네트워크는 전송량과 장비 성능을 나누어 본다

강의 07 p.3은 트래픽을 데이터 양으로, 대역폭을 단위 시간당 전송량으로 구분한다. 데이터 크기와 사용자 수만 있고 시간이 없으면 bps를 계산할 수 없다.

```text
traffic_bytes = object_bytes × users × objects_per_user
bandwidth_bps = traffic_bytes × 8 / transfer_seconds
```

두 식을 연결한 표현이며 원문의 전송량·대역폭 정의를 바탕으로 정리했다. 요청/응답, 복제·백업 트래픽과 암호화·프로토콜 오버헤드의 포함 범위는 입력에서 정한다.

## 포트와 스위칭 용량

강의 07 p.5~6의 절차는 다운링크 수 → 업링크 용량 → 이중화 → 실제 포트 구성 → 스위칭 성능 순서다.

```text
downlink_ports_raw = required_ports × expansion_factor × stability_factor
uplink_gbps = downlink_gbps × downlink_ports × role_factor
switching_gbps = sum(all_port_gbps) × 2
```

웹 구현에서는 포트 수를 올림하고, 실제 구매 가능한 포트 구성으로 올린 뒤 성능을 다시 계산하도록 제안한다. 이 올림 정책은 제품 설계 선택으로 기록한다.

강의의 `1,488,095` 패킷 처리 상수는 패킷 크기 등 측정 조건을 함께 확인해야 한다. 현재 자료만으로 임의 업무의 실효 처리량으로 일반화하지 않는다. 강의에 적힌 “TTA 기준”의 정확한 네트워크 표준번호·버전은 미확인이다. CPU·메모리용 TTA R3의 식으로 표시하지 않는다.

## 출처

[강의 07](../sources/lecture-07.md) p.3~6. [강의 08](../sources/lecture-08.md). [미확인 사항](../open-questions.md).

[아키텍처](architecture.md) · [계산식](../formulas/index.md) · [Wiki](../index.md)

## 추가된 네트워크 가이드와 실행 엔진

2021년 [규모산정시스템 사용 가이드라인](../sources/pdf-b07aabe8f7d6.md)에 TTAK.KO-01.0103/R1 기준과 장비별 식이 명시되어 있다. [별도 엔진 프로파일](../../docs/NETWORK_ENGINE.md)에서 접속형·백본형·L4/L7·WDM 식을 실행한다. 패킷 처리량은 가이드의 이론적 상수를 사용하는 요구량이며 실측 장비 성능과 구분한다. 강의 프로파일을 이 가이드 버전으로 자동 교체하지 않는다.
