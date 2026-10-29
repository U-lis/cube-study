# Phase 3 — OP UI (`op-ui`)

GLOBAL AD-2, AD-6, AD-8, AD-9, AD-10. SPEC FR-OP-L, FR-OP-Q, FR-OP-S.

## 전제

- Phase 2 완료 (`op.ts`, `op.svelte.ts`, JSON 커밋됨, `pnpm check && pnpm test` 초록).

## 만들 것

### 1. `src/lib/ui/MoveKeypad.svelte` — `disabledTokens` prop 추가

- `disabledTokens?: readonly string[]` prop 을 추가한다. 기본값 `[]`.
- 버튼 disabled 조건: `moves.length >= MAX_MOVES || disabledTokens.includes(token)`.
  현재 코드(`src/lib/ui/MoveKeypad.svelte:35`)는 `moves.length >= MAX_MOVES` 만 본다.
  `disabledTokens` 조건을 OR 로 추가한다.
- 기존 호출부는 prop 을 넘기지 않아 변경 없다.

### 2. `src/lib/ui/nav.ts` — OP 코너 그룹 추가

- `SIBLING_GROUPS` 에 `'/3x3/bld/op/corner': ['lookup', 'quiz']` 를 추가한다.
- `MENU_3BLD` 에 `{ group: '/3x3/bld/op/corner', label: 'OP 코너' }` 를 추가한다.
  M2 엣지 그룹 뒤, 트레이싱 앞에 삽입한다.

### 3. 홈 `src/routes/+page.svelte` — FEATURES 추가

OP 조회·퀴즈 항목을 M2 퀴즈 뒤, 트레이싱 앞에 삽입한다.

- `{ path: '/3x3/bld/op/corner/lookup', name: 'OP 조회', desc: 'OP 코너 공식표와 암기 체크' }`
- `{ path: '/3x3/bld/op/corner/quiz', name: 'OP 퀴즈', desc: '문자를 보고 OP 코너 공식을 칩니다' }`

### 4. `src/lib/ui/About.svelte` — `op.clearAll()` 추가

"암기 전체 해제" 확인 핸들러에서 `memorize.clearAll()` · `m2.clearAll()` 과 함께
`op.clearAll()` 을 호출한다 (`About.svelte:30-32` 영역). 확인 흐름은 그대로 유지한다.

### 5. 라우트 디렉토리 생성

```
src/routes/3x3/bld/op/corner/lookup/+page.svelte
src/routes/3x3/bld/op/corner/quiz/+page.svelte
```

중간 경로(`/3x3/bld/op`, `/3x3/bld/op/corner`)에 `+page.svelte` 를 만들지 않는다.

### 6. 조회 페이지 (`lookup/+page.svelte`)

- `PageTitle` back → 홈, `<h1>` 텍스트: `조회`.
- 표 열: 문자(대문자) · 자리 · 공식(`Alg.svelte`, `displayPartsOf` 사용) · 암기.
  - Y 행이 표 맨 위. 15수 전체 공식을 보인다.
  - 암기 열: `<label>` 감싼 체크박스, 터치 타깃 ≥ 44px, `op.svelte.ts` 의 `checked` Set 에 바인딩.
- `<details>` (기본 접힘): GLOBAL AD-10 원리 설명. `<summary>` 텍스트: `원리`.

### 7. 퀴즈 페이지 (`quiz/+page.svelte`)

- `PageTitle` back → 홈, `<h1>` 텍스트: `퀴즈`.
- `data-stage`: `active` / `result`.
- **문제 영역**: 큰 대문자 문자 + 자리.
  - Y 행이 문제면 자리 텍스트 대신 `Y-perm` 으로 표시한다.
- **입력**: `MoveKeypad` 에 `extraRows={[['[Y]']]}` 를 넘긴다.
  - Y 행 문제에서 `disabledTokens={['[Y]']}` 를 넘긴다.
  - P 행 문제에서는 `[Y]` 를 잠그지 않는다 (P 행의 정답이 `[Y]` 단독).
- **채점**: `gradeOp` 결과를 `data-verdict` + `data-kind` + `data-result` 로 낸다.
  - correct → `data-result="ok"`, 문구 `정답`.
  - other → `data-kind="other"`, 문구 `X(…)의 공식입니다`.
  - identity → 문구 `공식을 입력하세요`.
  - wrong → `data-result="bad"`, 문구 `오답`.
  - invalid-move → 문구 `알 수 없는 무브: X`.
- **결과 공식**: `result` 단계에서만 `Alg.svelte` 로 표시. `active` 에서는 보이지 않는다.
- **진행 버튼** (화면 최하단, 단계마다 하나만):
  - `active`: `data-grade` `제출` — 입력이 있어야 활성.
  - `result`: `data-next` `다음 문제`.
- **설정**: `암기한 것만 출제` 체크박스, `op.memorizedOnly` 에 바인딩.
  측정 중(active) CSS 로 접는다. DOM 에서 제거하지 않는다.
  풀이 비면 `암기 표시한 공식이 없습니다` 안내. 전체로 물러나지 않는다.
- 출제: `pickNext` 최근 20 제외.
- 제출 시 `push.noteQuiz()` 호출 — M2 퀴즈(`src/routes/3x3/bld/m2/edge/quiz/+page.svelte:91`)
  와 같은 위치에서 호출한다. 결정 번복 없이 한 번만 기술한다.

## 순서

1. `MoveKeypad.svelte` `disabledTokens` 추가 → `pnpm check`.
2. `nav.ts` OP 그룹 추가 → `pnpm check`.
3. 홈 FEATURES 추가 → `pnpm check`.
4. `About.svelte` `op.clearAll()` 추가 → `pnpm check`.
5. 조회 페이지 작성 → `pnpm check`.
6. 퀴즈 페이지 작성 → `pnpm check`.
7. `pnpm check && pnpm test && pnpm test:e2e` 전체 통과.

## 완료 체크리스트

- [ ] `MoveKeypad` 에 `disabledTokens` prop 추가, 기존 화면 영향 없음
- [ ] `nav.ts` `SIBLING_GROUPS` · `MENU_3BLD` 에 OP 코너 추가
- [ ] 홈 FEATURES 에 OP 조회·퀴즈 추가
- [ ] `About.svelte` 에서 `op.clearAll()` 호출
- [ ] 조회 페이지: `<h1>조회</h1>`, 22행 표, Y 행 맨 위, 암기 체크박스, `<details>` 기본 접힘
- [ ] 퀴즈 페이지: `<h1>퀴즈</h1>`, `[Y]` 키 존재, Y 행 문제 시 `[Y]` 비활성화, `data-stage` 전환
- [ ] 퀴즈 페이지: 제출 시 `push.noteQuiz()` 호출
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 초록

## 테스트 파일

### `tests/unit/nav.test.ts` 갱신

- `SIBLING_GROUPS['/3x3/bld/op/corner']` = `['lookup','quiz']` 검사 추가.
- `MENU_3BLD` 에 `OP 코너` 그룹이 있는지 검사 추가.

### `tests/e2e/op-lookup.spec.ts` (신규)

- 표에 22행이 있다.
- Y 행이 표 맨 위에 있다.
- `<details>` 가 기본 닫혀 있다.
- 암기 체크박스가 리로드 후에도 유지된다 (`op.checked` 라운드트립).

### `tests/e2e/op-quiz.spec.ts` (신규)

- 자판에 `[Y]` 키가 있다.
- Y 행 문제에서 `[Y]` 키가 비활성화된다.
- 올바른 입력(`setup [Y] setup'`) → `data-result="ok"`, 문구 `정답`.
- 틀린 입력 → `data-result="bad"` 또는 `data-kind="other"`.
- `암기한 것만 출제` 켜고 아무것도 체크 없으면 빈 풀 안내.
- 빈 풀에서 전체로 자동 전환하지 않는다.

### `tests/e2e/drawer.spec.ts` 갱신

서랍에 `OP 코너` 그룹이 표시된다.

### `tests/e2e/about.spec.ts` 갱신

"암기 전체 해제" 가 `op.checked` 도 비운다.

### `tests/e2e/conventions.spec.ts` 갱신

FEATURES 에 OP 조회(`/3x3/bld/op/corner/lookup`) · OP 퀴즈(`/3x3/bld/op/corner/quiz`) 경로가 포함되고 각각 `<h1>조회</h1>`, `<h1>퀴즈</h1>` 를 낸다.

## 주의사항

- `<h1>` 은 화면 이름이다. 문제 내용을 `<h1>` 에 넣지 않는다.
- 접기는 CSS 로 한다 (`{#if}` 로 DOM 에서 제거하지 않는다).
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다.
- `@viewport` 는 `boundingBox` / `44` 등 뷰포트 신호를 쓰는 테스트 제목에만 붙인다.
- 색만으로 알리지 않는다. 같은 자리에 문구가 함께 있어야 한다.
- 터치 타깃 ≥ 44px (암기 체크박스 레이블 포함).
