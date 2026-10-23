# Phase 2 TEST

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `routes.test.ts`: `/3x3/bld/m2/edge/lookup`·`/3x3/bld/m2/edge/quiz` 가 라우트 목록에 있다 | unit | [x] PASS |
| `routes.test.ts`: `/3x3/bld/m2`·`/3x3/bld/m2/edge` 는 라우트 목록에 없다 (네임스페이스) | unit | [x] PASS |
| `nav.test.ts`: `SIBLING_GROUPS['/3x3/bld/m2/edge']` = `['lookup','quiz']` | unit | [x] PASS |
| `nav.test.ts`: MENU_3BLD 에 `M2 엣지` 그룹이 있다 | unit | [x] PASS |
| `conventions.spec.ts` FEATURES: path `/3x3/bld/m2/edge/lookup` → h1 `조회` | e2e | [x] PASS |
| `conventions.spec.ts` FEATURES: path `/3x3/bld/m2/edge/quiz` → h1 `퀴즈` | e2e | [x] PASS |
| `drawer.spec.ts`: `M2 엣지` 그룹이 서랍에 있다 (열거 시) | e2e | [x] PASS |
| `about.spec.ts`: "암기 전체 해제" 가 m2 체크도 비운다 | e2e | [x] PASS |
| `m2-lookup.spec.ts`: 표에 27행이 있다 | e2e | [x] PASS |
| `m2-lookup.spec.ts`: 암기 체크박스가 리로드 후에도 유지된다 | e2e | [x] PASS |
| `m2-lookup.spec.ts`: `<details>` 가 기본 닫힌 상태다 | e2e | [x] PASS |
| `m2-quiz.spec.ts`: 자판에 M, l, r 키가 있다 | e2e | [x] PASS |
| `m2-quiz.spec.ts`: 정답 공식 입력 → `data-result ok`, 문구 `정답` | e2e | [x] PASS |
| `m2-quiz.spec.ts`: 다른 행의 공식 입력 → `data-kind other` | e2e | [x] PASS |
| `m2-quiz.spec.ts`: `암기한 것만 출제` 켜고 아무것도 체크 없으면 빈 풀 안내 | e2e | [x] PASS |
| `m2-quiz.spec.ts`: 진행 버튼이 화면 최하단에 있다 @viewport | e2e | [x] PASS |

## 이 Phase 에서 실제로 해당하는 경계 케이스

- 홈 FEATURES 이름: `M2 조회` / `M2 퀴즈` (h1 과 다름 — conventions.spec 는 h1 을 검사한다).
- 빈 풀 상태에서 전체로 자동 전환하지 않는다.
- `active` 단계에서 결과 공식이 보이지 않는다.
- 테스트 파일 이름: `tests/e2e/m2-lookup.spec.ts`, `tests/e2e/m2-quiz.spec.ts`.
- E2E 테스트 제목은 문자열 리터럴만 쓴다 (템플릿 리터럴 금지).
- viewport 를 쓰는 테스트(`진행 버튼이 화면 최하단에 있다`)는 제목 끝에 ` @viewport` 를 붙인다.
