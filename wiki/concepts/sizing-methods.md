# 결정론적 계산이 보장하는 것

입력값과 규칙 버전이 같으면 결과가 같도록 만드는 것은 가능하다. 입력이 실제 부하를 대표하는지와 보정계수가 환경에 맞는지는 별도의 문제다.

| 방법 | 필요한 근거 | 유용한 시점 | 한계 |
| --- | --- | --- | --- |
| 수식 계산 | 부하 입력, 단위, 보정계수 | 초기 설계와 대안 비교 | 가정이 틀리면 결과도 달라짐 |
| 참조 | 유사 업무의 구성·실측 | 구축 사례를 활용할 때 | 비교 환경이 다르면 적용이 어려움 |
| 시뮬레이션·부하 시험 | 대표 업무, 데이터, 실행 환경 | 상세 설계·도입 검증 | 시간과 환경 준비가 필요 |

TTA R3는 CPU·메모리·디스크·스토리지의 계산 방법을 제공한다. 네트워크 장비의 식은 이 표준의 범위로 묶지 않는다. 강의 07의 네트워크 식은 별도 프로파일로 관리한다.

계산 규칙은 `tta-r3-2023`, `legacy-xls`, `lecture-network`처럼 출처에 따라 분리한다. 첫 구현은 TTA R3 본문을 우선하는 설계안이다. 이전 XLS와 같은 결과가 필요한 호환 모드는 나중에 별도 검증을 거쳐 추가한다.

TTA 공식 검색 결과에서 R3의 식별자와 2023-12-06 개정일을 확인했다. 공식 상세 페이지는 도구에서 열리지 않아 최신 유효본·정오표의 전수 확인은 남아 있다. “현재 최신 표준”으로 단정하지 않는다. [TTA 공식 표준 목록](https://committee.tta.or.kr/standard/standard.jsp?by=asc&commit_code=PG423&firstDepthCode=TC4&nowPage=10&order=t.standard_no&secondDepthCode=PG423&thirdDepthCode=null)

## 출처

[TTA R3](../sources/tta-r3.md) PDF p.9~12, §5.1~5.3. [강의 03](../sources/lecture-03.md) p.8~10. [알려진 불일치](../open-questions.md).

[계산식 목록](../formulas/index.md) · [요구사항](requirements.md) · [Wiki](../index.md)
