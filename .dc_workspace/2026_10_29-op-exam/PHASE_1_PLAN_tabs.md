# Phase 1 — 탭바 제거 (`tabs`)

GLOBAL AD-11. SPEC FR-TB-1~5, #46.

## 전제

없음 (첫 번째 단계).

## 만들 것

### 1. `src/routes/+layout.svelte` — 탭바 블록 제거

- `<nav>` 탭바 마크업 전체를 제거한다. 탭바 sticky 영역은 `min-height: 52px` +
  `border-top: 1px` = 53px 다.
- 탭바 관련 CSS 스타일 전체를 제거한다.
- `showTabs` / `tabs` 파생값 선언과 `tabsFor` import 를 제거한다.
- `.shell { min-height: 100dvh }` 는 그대로 둔다.

### 2. `src/lib/ui/nav.ts` — `tabsFor` 제거

- `tabsFor` 함수 및 `NavTab` 타입, `staticSegments` 헬퍼를 제거한다
  (`nav.ts:63-108` 영역). 제거 전에 `grep -r tabsFor src/` 로 다른 호출처가 없음을
  확인한다.
- `labelFor` (`nav.ts:57`) · `siblingGroups` · `menuFor` · `MENU_3BLD` ·
  `SIBLING_GROUPS` 는 서랍이 쓰므로 남긴다.

### 3. `min-height` calc 수정

두 파일에서 `min-height: calc(100dvh - 52px - 40px - 1rem)` 을 찾아
`min-height: calc(100dvh - 40px - 1rem)` 으로 교체한다.

- `src/routes/3x3/bld/m2/edge/quiz/+page.svelte:215`
- `src/routes/3x3/bld/3style/corner/quiz/+page.svelte:347`

수정 후 두 화면에서 세로 공간을 실측한다. 기준 (2026-10-29, 제거 전):
375×667 — 코너 퀴즈 740px, M2 퀴즈 717px. 390×844 — 둘 다 894px.
실측 결과를 `PHASE_1_TEST.md` 에 기록한다.

### 4. `.dc_workspace/CONVENTIONS.md` 갱신

- 1.4 절 "하단 탭은 형제만 담는다" 전체 삭제.
- 1.1 절 화면 세로 순서 끝 칸 "→ 형제 탭" 삭제.

### 5. `CLAUDE.md` 갱신

- 화면 세로 순서 항목 끝 "→ 형제 탭" 삭제.
- "하단 탭은 기능 칸만 다른 화면끼리다" 항목 삭제.

### 6. `.dc_workspace/SVELTE.md` 갱신

라우트 축 절에서 탭 관련 언급("하단 탭의 형제" 등)을 점검하고 삭제 또는 수정한다.

### 7. `.dc_workspace/2026_10_18-drawer-push/SPEC.md:139` 주석 추가

D-10 항목 "하단 형제 탭은 그대로" 뒤에 `→ #46 에서 대체됨` 을 추가한다.

### 8. `tests/unit/nav.test.ts` 갱신

- `tabsFor` 관련 `describe` 블록을 제거한다.
- 메뉴·서랍 관련 테스트는 그대로 유지한다.

### 9. `tests/e2e/conventions.spec.ts` 갱신

아래 세 테스트를 제거한다.

- `'공식 화면 넷은 형제 탭 넷을 단다'`
- `'스티커 문자 화면 둘은 서로의 형제 탭을 단다 (#19)'`
- `'트레이싱에는 탭바가 없다'` (있다면)

대신 아래 테스트를 하나 추가한다.

```
'어느 화면에도 탭바가 없다'
```

검사 방법: FEATURES 전체 경로 + 상세 페이지(`/…/algs/GC`)를 순회하며 탭바 전용
선택자(예: `nav[data-tabs]` 또는 탭바 `<nav>` 의 실제 클래스)로 요소가 없음을 단언한다.
`<nav>` 전체로 단언하지 않는다 — 서랍 자체에 `<nav>` 가 있다. 탭바 마크업의 실제
선택자를 코드에서 확인하고 그것으로 단언한다.

이 테스트는 `boundingBox` 등 뷰포트 신호를 쓰지 않으므로 `@viewport` 를 붙이지 않는다
(e2e-tags.test.ts 파서 규칙 — 신호 없으면 태그 없음).

## 순서

1. `nav.ts` `tabsFor` 제거 → `pnpm check`.
2. `+layout.svelte` 탭바 마크업·스타일·import 제거 → `pnpm check`.
3. calc 두 곳 수정 → `pnpm check`.
4. 문서 4종 갱신 (CONVENTIONS, CLAUDE.md, SVELTE.md, drawer SPEC).
5. `nav.test.ts` 갱신 → `pnpm test`.
6. `conventions.spec.ts` 갱신 → `pnpm test:e2e`.
7. 실측 후 `PHASE_1_TEST.md` 기록.
8. `pnpm check && pnpm test && pnpm test:e2e` 전체 통과.

## 완료 체크리스트

- [x] `+layout.svelte` 에 `<nav>` 탭바 마크업이 없다
- [x] `+layout.svelte` 에 `tabsFor` import 가 없다
- [x] `nav.ts` 에 `tabsFor` 함수가 없다
- [x] `grep -r tabsFor src/` 결과 없음 확인
- [x] 두 quiz 페이지 calc 에서 `52px` 항이 제거됐다 (flex fill 방식으로 교체 — `main { display:flex; flex-direction:column }` + `.quiz { flex:1 }`)
- [x] `CONVENTIONS.md` 1.4 절 삭제, 1.1 절 "형제 탭" 삭제
- [x] `CLAUDE.md` 탭 관련 두 줄 삭제
- [x] `SVELTE.md` 탭 언급 정리
- [x] `drawer-push/SPEC.md:139` D-10 주석 추가
- [x] `nav.test.ts` `tabsFor` describe 없음
- [x] `conventions.spec.ts` 탭 검사 3개 제거, "어느 화면에도 탭바가 없다" 추가
- [x] 실측 결과 `PHASE_1_TEST.md` 기록 (제출 아래끝 기준, 375×667/390×844 양 화면)
- [x] `pnpm check && pnpm test && pnpm test:e2e` 초록 (696/696 unit, 430/430 e2e, 1 skipped)

## 주의사항

- 서랍(`Drawer.svelte`)의 `<nav>` 와 탭바의 `<nav>` 를 혼동하지 않는다. 탭바의 실제
  선택자를 확인한 뒤 제거하고 테스트 단언에 쓴다.
- `tabsFor` 외에 남기는 함수(`labelFor`, `menuFor`, `siblingGroups`)는 서랍이 쓴다.
  제거 목록에 넣지 않는다.
- 접기는 CSS 로 한다 (`{#if}` 로 DOM 에서 제거하지 않는다).
