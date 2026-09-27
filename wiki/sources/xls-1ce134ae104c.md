# 정보시스템 용량산정 계산도구 (05차시)

- 출처 ID: `xls-1ce134ae104c`
- 종류: 레거시 계산표
- 원본: [정보시스템 용량산정 계산도구.xls](../../reference/05/%EC%A0%95%EB%B3%B4%EC%8B%9C%EC%8A%A4%ED%85%9C%20%EC%9A%A9%EB%9F%89%EC%82%B0%EC%A0%95%20%EA%B3%84%EC%82%B0%EB%8F%84%EA%B5%AC.xls)
- 위치: WEB_WAS산정!F16, 메모리용량산정!F20, 디스크용량산정!F20/F22, OLTP서버CPU용량산정!F46
- SHA-256: `1ce134ae104cb5d30609fa40f5f03a09d0fc99e419907351fd13a8599c0074f8`
- 읽기 보조: [구조화 추출본](extracted/xls-1ce134ae104c.json)

## 핵심 내용

5개 시트에서 OLTP·WEB/WAS·메모리·디스크·기초자료를 다룬다. 원본의 저장된 값과 BIFF 수식을 추출했으며 재계산은 수행하지 않았다. 각 파일 OLTP 시트 F14/F18/F22/F34의 수식은 추출 미해결이다. 03·05의 두 XLS는 바이너리 해시는 다르지만 이번 추출 범위의 셀 값·수식은 동일하다. TTA R3와 다른 계산 모델이므로 회귀 비교용으로 보존한다.

## 사용 범위와 한계

Cached values and BIFF formula text only; no recalculation, macros, controls, or visual verification.

[관련 지식](../concepts/sizing-methods.md) · [불일치와 미확인 사항](../open-questions.md) · [출처 목록](index.md)

## 동일 원본 경로

추가 동일 경로 없음.

## 시트 목록

| 시트 | 사용 범위 행 수 | 열 수 |
| --- | ---: | ---: |
| OLTP서버CPU용량산정 | 63 | 41 |
| WEB_WAS산정 | 16 | 13 |
| 메모리용량산정 | 22 | 13 |
| 디스크용량산정 | 22 | 16 |
| 기초데이터 | 59 | 14 |
