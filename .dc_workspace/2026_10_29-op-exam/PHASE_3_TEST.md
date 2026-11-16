# Phase 3 TEST — OP UI

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `nav.test.ts`: `SIBLING_GROUPS['/3x3/bld/op/corner']` = `['lookup','quiz']` | unit | [x] |
| `nav.test.ts`: `MENU_3BLD` 에 `OP 코너` 그룹이 있다 | unit | [x] |
| `conventions.spec.ts` FEATURES: `/3x3/bld/op/corner/lookup` → h1 `조회` | e2e | [x] |
| `conventions.spec.ts` FEATURES: `/3x3/bld/op/corner/quiz` → h1 `퀴즈` | e2e | [x] |
| `drawer.spec.ts`: 서랍에 `OP 코너` 그룹이 있다 | e2e | [x] |
| `memorize-clear.spec.ts`: "암기 전체 해제" 가 `op.checked` 도 비운다 (PLAN 당초 `about.spec.ts`) | e2e | [x] |
| `op-lookup.spec.ts`: 표에 22행이 있다 | e2e | [x] |
| `op-lookup.spec.ts`: Y 행이 표 맨 위에 있다 | e2e | [x] |
| `op-lookup.spec.ts`: `<details>` 가 기본 닫혀 있다 | e2e | [x] |
| `op-lookup.spec.ts`: 암기 체크박스가 리로드 후에도 유지된다 | e2e | [x] |
| `op-quiz.spec.ts`: 자판에 `[Y]` 키가 있다 | e2e | [x] |
| `op-quiz.spec.ts`: Y 행 문제에서 `[Y]` 키가 비활성화된다 | e2e | [x] |
| `op-quiz.spec.ts`: 올바른 입력 → `data-result="ok"`, 문구 `정답` | e2e | [x] |
| `op-quiz.spec.ts`: 틀린 입력 → `data-result="bad"` 또는 `data-kind="other"` | e2e | [x] |
| `op-quiz.spec.ts`: `암기한 것만 출제` + 체크 없음 → 빈 풀 안내 | e2e | [x] |
| `op-quiz.spec.ts`: 빈 풀에서 전체로 자동 전환하지 않는다 | e2e | [x] |

## 이 Phase 에서 실제로 해당하는 경계 케이스

- Y 행 문제: `[Y]` 키 비활성화. P 행 문제: `[Y]` 키 활성 (정답이 `[Y]` 단독).
- `active` 단계에서 결과 공식이 보이지 않는다.
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다.
- 뷰포트 신호(`boundingBox`, `44` 등)를 쓰는 테스트에만 `@viewport` 를 붙인다.
  빈 풀 안내, 22행 확인 등은 뷰포트 신호 없이 단언 가능하므로 `@viewport` 없음.
