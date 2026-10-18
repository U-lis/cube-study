# Phase 4 — 퀴즈 화면

GLOBAL AD-LT-4~7, 9, 13. SPEC FR-LT-12~22.

## `src/routes/3x3/bld/letters/quiz/+page.svelte`

- 세로 순서: UpLink → `<h1>퀴즈</h1>` → 설정(종류 · 단계 · 다른 큐비 SegToggle) → 큐브 → 안내 줄 → 입력칸 → StickerPad → 판정 → 결과(오답 시 정답) → 진행 버튼 → 탭
- 상태: `cubie`(현재 문제), `facelets`(문제마다), `entered: string[]`, `verdict`, `recent: string[]`
- 새 문제 `next()`:
  1. `cubie = pickNext(cubiesOf(kind), recent, undefined, Math.random)`
  2. `facelets = stage === 'scrambled' ? Cube.random().asString() : SOLVED`
  3. `entered = []`, `verdict = null`
  4. `cube.resetView(Math.floor(Math.random() * ORIENTATION_COUNT))` (AD-LT-9)
- 설정 변경 `$effect` → `next()` (FR-LT-20). 처음 진입도 같은 경로
- 칠: `paintQuiz`, 외곽선: `marksQuiz(…, MARK_PALETTE.current)`, 글자: 없음
- 채점: `data-grade` disabled = `entered.length < answerOf(kind,cubie).length`
- SSR: 문제는 클라이언트에서만 뽑는다. SSR 은 회색 큐브 + 비활성 패드 (요소 개수는 같게 — `{#if}` 금지)
- `<title>스티커 문자 — 퀴즈</title>`
