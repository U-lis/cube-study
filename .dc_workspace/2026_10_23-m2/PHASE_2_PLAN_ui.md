# Phase 2 — UI (`MoveKeypad` · 네비게이션 · 조회 · 퀴즈)

GLOBAL AD-3~AD-10. SPEC FR-M2-L, FR-M2-Q.

## 전제

- Phase 1 완료 (`faceletsOf`, `m2.ts`, `m2.svelte.ts` 커밋됨).

## 만들 것

### 1. `src/lib/components/MoveKeypad.svelte` — `extraRows` prop 추가

- `extraRows?: readonly (readonly string[])[]` prop 을 추가한다. 기본값 `[]`.
- 기존 면 버튼 행 아래에, `extraRows` 의 각 배열을 `repeat(len, 1fr)` 그리드로 렌더한다.
- 각 버튼: `data-move={token}`, 기존 버튼과 같은 스타일.
- 기존 호출부(`MoveKeypad` 를 사용하는 모든 화면)는 prop 을 넘기지 않아 변경 없다.

### 2. `src/lib/nav.ts` — M2 엣지 그룹 추가

- `SIBLING_GROUPS` 에 `'/3x3/bld/m2/edge': ['lookup', 'quiz']` 를 추가한다.
- `MENU_3BLD` 에 `{ group: '/3x3/bld/m2/edge', label: 'M2 엣지' }` 를 추가한다.
  3-style 코너 항목 뒤, 트레이싱 항목 앞에 삽입한다.

### 3. 홈 `src/routes/+page.svelte` — FEATURES 추가

- M2 조회 항목: `{ path: '/3x3/bld/m2/edge/lookup', name: 'M2 조회', desc: 'M2 엣지 공식표와 암기 체크' }`.
- M2 퀴즈 항목: `{ path: '/3x3/bld/m2/edge/quiz', name: 'M2 퀴즈', desc: '타깃을 보고 M2 공식을 칩니다' }`.
- 매일 퀴즈 항목 뒤, 트레이싱 항목 앞에 삽입한다.

### 4. `src/routes/about/+page.svelte` — `m2.clearAll()` 추가

- "암기 전체 해제" 버튼의 확인 핸들러에서 `memorize.clearAll()` 과 함께 `m2.clearAll()` 을 호출한다.
- 두 단계 확인 흐름(버튼 → 확인 버튼 → 실행)은 그대로 유지한다.

### 5. 라우트 디렉토리 생성

```
src/routes/3x3/bld/m2/edge/lookup/+page.svelte
src/routes/3x3/bld/m2/edge/quiz/+page.svelte
```

중간 경로에 `+page.svelte` 를 만들지 않는다.

### 6. 조회 페이지 (`+page.svelte` — lookup)

- `PageTitle` back → 홈, `<h1>` 텍스트: `조회`.
- 표: 열 — 문자(대문자) · 자리(`placeText`) · 순번(`홀수 번째` / `짝수 번째` / `패리티`) · 공식(`Alg.svelte`) · 암기.
  - 암기 열: `<label>` 감싼 체크박스, 터치 타깃 ≥ 44px, `m2.svelte.ts` 의 `checked` Set 에 바인딩.
  - M 슬라이스(C·W·I·S) 는 홀수·짝수 두 줄로 표시한다.
  - 패리티 행은 표 맨 아래, 순번 셀에 `패리티` 표시, `meta.parityNote` 참조.
- `<details>` (기본 닫힘): GLOBAL AD-10 의 원리 설명 7개 항목. `<summary>` 텍스트: `원리`.
- `prefers-reduced-motion` 을 존중한다.

### 7. 퀴즈 페이지 (`+page.svelte` — quiz)

- `PageTitle` back → 홈, `<h1>` 텍스트: `퀴즈`.
- `data-stage` : `active` / `result`.
- **문제 영역**: 큰 대문자 문자 + `placeText` + 순번 문구(`홀수 번째` / `짝수 번째` / `패리티`). M 슬라이스·패리티 아닌 경우 순번 문구 없음.
- **입력**: `MoveKeypad` 에 `extraRows={[["M","M'","M2"],["l","l'","r","r'"]]}` 를 넘긴다.
- **채점**: `data-verdict` + `data-kind` + `data-result` (`ok` / `bad`). 색은 `data-result` 만 보고 칠한다.
  - 정답 → 문구 `정답`.
  - `other` → 문구 `X(…)의 공식입니다`.
  - `identity` → 문구 `공식을 입력하세요`.
  - `wrong` → 문구 `오답`.
  - `invalid-move` → 문구 `알 수 없는 무브: X`.
- **결과 공식**: `result` 단계에서만 `Alg.svelte` 로 공식을 표시한다. `active` 에서는 보이지 않는다.
- **진행 버튼** (화면 최하단, 단계마다 하나만):
  - `active`: `data-grade` `제출` — 입력이 있어야 활성.
  - `result`: `data-next` `다음 문제`.
- **설정**: `암기한 것만 출제` 체크박스, `m2.memorizedOnly` 에 바인딩.
  - 풀(pool)이 비면 `암기 표시한 공식이 없습니다` 안내. 전체로 물러나지 않는다.
- 조회 화면 링크 (쿼리 없이).
- `pickNext` 로 출제, 세션 내 최근 20 제외.
- `prefers-reduced-motion` 을 존중한다.
- 측정 중(active)에는 설정을 CSS 로 접는다 (DOM 에서 제거하지 않는다). 잠금(`disabled`)은 별도.

## 순서

1. `MoveKeypad.svelte` 수정 → `pnpm check`.
2. `nav.ts` 수정 → `pnpm check`.
3. 홈 수정 → `pnpm check`.
4. About 수정 → `pnpm check`.
5. 조회 페이지 작성 → `pnpm check`.
6. 퀴즈 페이지 작성 → `pnpm check`.
7. `pnpm check && pnpm test && pnpm test:e2e` 전체 통과.

## 완료 체크리스트

- [ ] `MoveKeypad` 에 `extraRows` prop 추가, 기존 화면 영향 없음
- [ ] `nav.ts` SIBLING_GROUPS·MENU_3BLD 갱신
- [ ] 홈 FEATURES 에 M2 조회·퀴즈 추가
- [ ] About 에서 `m2.clearAll()` 호출
- [ ] 조회 페이지 `<h1>조회</h1>`, 27행 표, 암기 체크박스
- [ ] 조회 페이지 `<details>` 원리 기본 닫힘
- [ ] 퀴즈 페이지 `<h1>퀴즈</h1>`, M/l/r 키 존재
- [ ] 퀴즈 페이지 `data-stage` active/result 전환
- [ ] 퀴즈 페이지 진행 버튼 화면 최하단 @viewport
- [ ] 퀴즈 페이지 `암기한 것만 출제` 비어 있을 때 안내
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 초록

## 주의사항

- `<h1>` 은 화면 이름이다. 문제 내용을 `<h1>` 에 넣지 않는다.
- 접기는 CSS 로 한다. `{#if}` 로 DOM 에서 제거하지 않는다.
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다.
- `@viewport` 는 `boundingBox` / viewport 를 쓰는 E2E 테스트 제목 끝에 붙인다.
- 색만으로 알리지 않는다. 같은 자리에 문구가 함께 있어야 한다.
- 터치 타깃 ≥ 44px (암기 체크박스 레이블 포함).
