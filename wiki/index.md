# 인프라 용량산정 LLM Wiki

이 Wiki는 LLM이 **온프레미스 인프라 자료를 근거와 함께 검색·해석하기 위한 지식 기반**이다. 여기서 LLM은 Wiki를 사용하는 주체이며, 현재 자료는 LLM 추론 서버나 GPU 용량산정 전용 자료가 아니다.

2026-09-27 기준 원본 56개, SHA-256 기준 고유 출처 36개를 등록했다. 원본의 경로와 내용은 보존했다. 결정론적 계산 엔진 1.0.0을 구현했으며 웹 계산기와 에이전트 연결은 다음 단계다. 추가된 TTA·AWS 계산 엑셀과 사용 가이드, 네트워크 규모산정 가이드, 2024.06 클라우드 취약점 점검 가이드도 출처에 포함했다.

## 질문으로 읽기

| 알고 싶은 것 | 읽을 문서 |
| --- | --- |
| 업무 요구를 어떤 입력값으로 바꿀까? | [요구사항과 산정 입력](concepts/requirements.md) |
| 수식 계산을 어느 정도 믿을 수 있을까? | [규모산정 방법과 적용 범위](concepts/sizing-methods.md) |
| CPU를 코어 수로 바로 산출할 수 있을까? | [CPU와 벤치마크](concepts/cpu-sizing.md) |
| 메모리·디스크·IOPS를 어떻게 나눌까? | [메모리와 스토리지](concepts/memory-storage.md) |
| 트래픽·포트·스위칭 용량은 어떻게 다를까? | [네트워크 산정](concepts/network-sizing.md) |
| 계산 결과를 실제 구성으로 어떻게 옮길까? | [아키텍처와 장비 선정](concepts/architecture.md) |
| 산출물을 무엇으로 검수할까? | [보안·구축·인수인계](concepts/security-handover.md) |
| 클라우드 설정 점검을 설계와 어떻게 연결할까? | [클라우드 보안 검토](concepts/cloud-security.md) |
| 산정값을 어느 장비 성능과 비교할까? | [TPC-C·SPC-1·SPC-1C 공식 벤치마크](benchmarks.md) |

추가 참고: [TTA·AWS 계산 엑셀 분석](sources/xlsx-d6bfd84a3ce8.md) — 실측 자원 산정, 후보 필터, TTA와 단위 해석의 차이.

## 계산기와 에이전트로 연결하기

[계산 엔진 사용법](../docs/ENGINE_USAGE.md) · [계산식 목록](formulas/index.md) → [계산 계약](../docs/CALCULATION_CONTRACT.md) → [제품 계획](../docs/PRODUCT_PLAN.md) 순으로 읽는다.

```mermaid
flowchart LR
  R[원본 reference] --> S[출처 카드와 추출본]
  S --> W[개념과 업무 흐름]
  S --> F[버전별 계산 규칙]
  W --> A[요구사항 해석과 추가 질문]
  A --> I[사용자가 확인한 입력]
  I --> C[결정론적 계산 엔진]
  F --> C
  C --> O[산정서와 구성 비교]
  O --> H[설계 검토와 실측 검증]
```

## 자료를 읽을 때 지켜야 할 경계

- 수학적으로 같은 결과를 재현하는 것과 실제 업무 부하를 정확히 예측하는 것은 별개다.
- TTA R3 본문, 강의 슬라이드, 기존 XLS는 서로 다른 근거다. 식이나 계수를 섞지 않는다.
- 기본 계수도 가정이다. 사용자에게 적용 이유와 값의 출처를 보인다.
- `tpmC`, `max-jOPS`, 업무 `TPS`, 코어 수는 같은 단위가 아니다.
- 계산서·설계서·실제 구축 증적은 서로 다른 상태의 산출물이다.

[전체 출처](sources/index.md) · [불일치와 미확인 사항](open-questions.md) · [갱신 규칙](CONTRIBUTING.md) · [용어](glossary.md)
