# Capacity Agent의 하네스 적용

## HARNESS

현재는 Wiki·계산 엔진1.0.0 단계다. `.claude/harness-config.json`의 gate는 `make check`, smoke는 `make smoke-local`이다. 권한 경계는 Claude·Codex·OpenCode용 프로젝트 파일에 있으며 전역 설정은 변경하지 않았다. 명령 규칙은 보조 장치이며 모든 네트워크 접근을 차단하는 운영체제 sandbox라는 의미는 아니다.

## LOOP

이 워크스페이스는 `harness_root`를 Codex 설치의 1.6.0 경로로 고정했다. 자동 탐색 시 Claude 1.4.0과 Codex 1.6.0의 선택이 달라졌기 때문이다. 다른 기기로 옮기거나 플러그인을 갱신하면 이 프로젝트 설정의 경로를 확인한다.

runner와 bible은 설치된 플러그인의 `templates/`를 사용한다. `make overnight-where`로 위치를 확인한다. 이 저장소에 runner를 복제하지 않는다. 기본 engine은 Codex이며 모델 ID는 명시하지 않아 설치된 설정을 따른다. Claude용 모델 기본값은 플러그인 Makefile 템플릿에 남아 있으며 해당 engine 사용 전 별도 검증한다.

`docs/NEXT_PLAN.md`의 `[auto]`만 무인 실행 대상이다. 현재 0개이며 Git 저장소·기준 커밋도 없다. 이번에는 모델 호출·커밋을 수반하는 `overnight-once`를 실행하지 않는다. 초기화 스킬의 범위는 scaffolding/guidance이며 이후 작업 구현이나 커밋 자체가 아니다.

## VERIFICATION — 세 계층

- 기계 검증: `make check`. 원본/추출 해시, 참조 누락, Wiki 연결, 식·예제 출처/스키마와 검증기 회귀 테스트. 계산 엔진의 독립 기준값·단위·경계·오류·단조성·벤치마크 조건도 검사한다. 실제 장비 성능이나 표준 현행성을 검증하는 테스트는 아니다.
- 의미 검증: 이번 작업에서 원문식·단위·부록 예제를 직접 대조했다. 별도의 모델 critic 실행은 아직 없다. 향후 중요 불변식은 단위 혼합 금지, 원문 오류 보존, 벤치마크 범주 분리, 미확인값 보존이다.
- 사람 검토: 실제 업무 가정, 가용성 설계, 장비 구성 비교, 벤더 견적, 사용자 경험, 구축 증적 판단.

## AGENTIC

단일 에이전트로 진행한다. 사용자 지시 없이 하위 에이전트나 병렬 작업 레인을 만들지 않는다.

## CONTEXT

`AGENT_BRIEF` → `STATUS` → `NEXT_PLAN` → 최근 `PROGRESS_LOG` → `LESSONS`. brief 60줄, status/plan/log 120줄, lessons 40줄 예산을 사용한다. `LESSONS`에는 프로젝트에서 확인한 재발 방지 사항만 짧게 기록한다.

## PROMPT

별도 repo prompt override는 없다. 루프를 시작하면 플러그인 기본 prompt와 `AGENTS.md`, 이 저장소 상태 문서를 읽는다. 제품용 LLM prompt는 P3 이전이라 아직 없다.

[현재 상태](../../STATUS.md) · [다음 작업](../../NEXT_PLAN.md)
