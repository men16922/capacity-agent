# 계산 엔진 실행하기

Python 3.9 이상과 이 프로젝트 폴더만 있으면 된다. 엔진 런타임은 표준 라이브러리만 사용하며 패키지 설치·네트워크·모델 키가 필요 없다. 원문을 다시 추출할 때 필요한 라이브러리는 별도다.

## CLI

프로젝트 루트에서 실행한다.

```sh
python3 -m capacity_engine calculate examples/tta-appendix.json
python3 -m capacity_engine calculate examples/network.json
python3 -m capacity_engine calculate examples/network-guide.json
python3 -m capacity_engine compare examples/benchmark-review.json
```

첫 예제는 TTA 부록의 WEB/WAS·DB 입력을 재현한다. WEB/WAS 기본값 2,801.8848 max-jOPS에 통합 계층 가중치 1.6을 적용한 최종값은 **4,483.01568 max-jOPS**다. 메모리는 **5,585.32 원문 MB**, DB CPU는 약 **344,086.240457 tpmC**다. 원문 MB는 MiB로 자동 해석하지 않는다.

`benchmark-review.json`은 조사한 실제 결과의 읽기 예시다. FDR와 배포 구성을 대조하지 않았으므로 **incomparable과 종료 코드 2가 정상**이다. 이 파일을 검증 완료 후보로 바꾸지 않았다. 양성 비교 테스트는 가상 데이터임을 표시한 오프라인 fixture를 사용한다.

JSON은 stdout으로 출력한다. stdin은 파일명 대신 `-`를 사용한다. CLI 종료 코드는 계산/비교 성공 시 0, invalid/incomplete/incomparable 또는 입력 파일 오류 시 2다. `meets_requirement: false`도 유효한 비교 결과이므로 종료 코드는 0이다.

결과 저장 예:

```sh
python3 -m capacity_engine calculate examples/tta-appendix.json > /tmp/capacity-result.json
```

입력은 UTF-8 JSON이다. 최대 2MB, 계산 요청 최대 100개, 중복 JSON 키는 거부한다. 모든 산정 수치는 십진 문자열로 넣고 단위·근거·기준일을 함께 기록한다. `30%` 문자열 대신 `value: "30", unit: "percent"`를 사용한다. UI에서 입력받는 숫자나 비율 표기는 이후 웹 계층에서 이 계약으로 변환한다.

## Python API

프로젝트 루트에서 Python을 실행하거나 프로젝트 루트를 모듈 경로로 설정한다. 배포 시 `capacity_engine/`과 `wiki/formulas/`, `wiki/sources/manifest.json`을 함께 유지해야 한다.

```python
import json
from pathlib import Path
from capacity_engine import calculate, requirement_from_result, compare_benchmark

request = json.loads(Path("examples/tta-appendix.json").read_text())
response = calculate(request)
db = next(r for r in response["results"] if r["id"] == "db-cpu")
requirement = requirement_from_result(
    db, version="5.11.0", scope="single-system"
)
# requirement는 보수적으로 올림한 TPC-C 요구량이다.
# 후보 구성·출처·상태를 검토한 뒤 compare_benchmark()에 전달한다.
```

함수는 입력 객체를 변경하지 않는다. 오류가 있으면 상태·필드 경로·오류 코드를 반환하므로 사용자에게 필요한 수정 항목을 보여줄 수 있다. 원문·규칙 파일이 누락되거나 손상된 배포는 정상 계산 환경이 아니며 별도 설정 오류로 처리해야 한다.

## 검증과 다음 연결

```sh
make check
make engine-smoke
```

`make check`는 Wiki 원본/추출 해시·링크 검사와 계산 엔진·벤치마크 회귀 테스트를 수행한다. `make engine-smoke`는 TTA·강의 네트워크·추가 가이드 JSON을 실제 CLI로 실행한다. 실행 중 AWS API나 외부 LLM을 호출하지 않는다.

현재 API는 수치를 계산하고 근거를 반환한다. 다음 단계인 웹은 이 함수를 호출해 입력 양식·시나리오 비교·인쇄 산정서를 제공한다. AWS 실측 정규화·EC2/gp3·비용은 [제공 엑셀](../wiki/sources/xlsx-d6bfd84a3ce8.md)과 [사용 가이드](../wiki/sources/pdf-39cde3f5bf44.md)를 토대로 별도 프로파일에서 구현할 후속 항목이다.

[계산 계약](CALCULATION_CONTRACT.md) · [검증 근거](ENGINE_VERIFICATION.md) · [Wiki](../wiki/index.md)
