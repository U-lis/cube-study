# Phase 3 — 규약 통일 (conventions)

**담당**: FR-NAV-11~14, 18~20
**의존**: Phase 2 완료
**병렬 불가**: 순차 (사용자 지시)

## 목표

이 페이즈가 끝나면:
- 진행 버튼 이름이 `data-{동작}` 하나의 규약을 지킨다 (퀴즈의 `data-action="submit"`·`"next"` 제거)
- 화면 루트에 `data-stage` 가 실리고 검사·CSS 가 같은 신호를 본다
- 판정 줄이 `data-verdict` + `data-kind` + `data-result` 를 쓴다 (퀴즈는 이미 부분적으로 있음. 완성)
- 진행 버튼 자리가 본문 최하단이다 (트레이싱의 옛 8번 자리를 12번으로 이동)
- 설정 잠금은 **트레이싱만**. 퀴즈는 지금 동작을 유지한다 (사용자 지시)
- 접기 규칙 · 스크롤 원점 되돌리기가 필요한 자리에 적용된다

## 선행 조건

- Phase 2 완료. `<h1>` 과 홈 링크가 자리에 있다

## 대응 SPEC

| FR | 내용 |
|---|---|
| FR-NAV-11 | 측정하는 판이 도는 동안 설정을 접고 잠금. **트레이싱만 해당** |
| FR-NAV-12 | 판정 줄 `data-verdict` · `data-kind` · `data-result` |
| FR-NAV-13 | 진행 버튼 이름 `data-{동작}`. 단계마다 하나만. 자리는 본문 최하단 |
| FR-NAV-14 | 단계 이름 통일. 화면 루트에 `data-stage` |
| FR-NAV-18 | 접기 기본, 자리 예약은 하이드레이션 흔들리는 자리에만 |
| FR-NAV-19 | 세로 예산은 가변 영역 하나가 흡수 (트레이싱은 이미 함) |
| FR-NAV-20 | 단계가 바뀌어 화면이 짧아지면 스크롤 원점 |

## 커밋 단위 (권장)

1. `feat(quiz): 진행 버튼 이름을 data-grade · data-next 로 옮긴다` — pwa.spec.ts:131 셀렉터 갱신 포함
2. `feat(quiz): 화면 루트에 data-stage 를 낸다` — active·input·result
3. `feat(quiz): 판정 줄에 data-result 를 추가한다` — 이미 있는 것 재확인

## 수정할 파일

### 1. `src/routes/3x3/bld/3style/corner/quiz/+page.svelte`

이 페이즈의 대부분이 퀴즈다. 트레이싱은 이미 규약을 지키고 있다.

#### 1a. 진행 버튼 이름 (FR-NAV-13)

- [ ] `data-action="submit"` (263줄) → `data-grade`
- [ ] `data-action="next"` (253줄) → `data-next`
- [ ] 두 속성만 바뀐다. `class`·`disabled`·`onclick` 은 그대로

**자판 안 편집 버튼(`MoveKeypad.svelte` 의 `data-action="undo"` 등)은 손대지 않는다.** SPEC FR-NAV-13 표가 명시.

#### 1b. `data-stage` (FR-NAV-14)

- [ ] `<section class="quiz">` (176줄) 에 `data-stage` 를 낸다
- [ ] 값: `active`(문제 표시 · 아직 판정 없음) → `input`(입력 중 · 아직 제출 안 함) → `result`(판정 있음)
  - 실제로 퀴즈는 화면에 문제가 뜨는 순간 입력도 열린다. `active` 와 `input` 이 겹친다 — SPEC FR-NAV-14 표가 그렇게 예상하고 있음
  - **구현 방침**: 정말 필요한 구분은 `result` 유무다. 그것을 낸다.
    - `verdict === null && current === null` → 미로딩. `data-stage` 를 안 낸다 (자리 예약이 필요하지 않다 — 데이터셋이 아직 없음)
    - `verdict === null && current !== null` → `active` (문제 있음, 답 대기)
    - `verdict !== null` → `result`
  - SPEC AD-NAV-5 "단계 이름은 공유하되 단계를 강제하지 않는다" — 퀴즈에 `idle` 을 만들지 않는다. `input` 도 굳이 낼 필요가 없다면 안 낸다
  - `let stage = $derived(...)` 로 파생 → `data-stage={stage}`

- [ ] `pool` 이 비어 안내가 뜨는 상태(`poolEmpty`)에서도 `data-stage` 를 낼지 결정
  - 이 상태는 문제 자체가 없는 상태 (`current === null`). `data-stage` 를 낼 필요 없음 — 안 낸다
  - `<section class="quiz" data-stage={stage ?? ''}>` 로 빈 문자열 처리

#### 1c. 판정 줄 (FR-NAV-12)

퀴즈의 판정 줄(231줄)이 이미 `data-verdict={verdict.kind}` 를 낸다. `data-result` 를 함께 낸다.

- [ ] `<div class="verdict" data-verdict={verdict.kind}>` → `<div class="verdict" data-verdict data-kind={verdict.kind} data-result={verdict.kind === 'correct' ? 'ok' : 'bad'}>`
  - **트레이싱과 같은 규약**. 트레이싱 판정 줄(`trace/+page.svelte:775-783`)이 정본
  - 지금 CSS 는 `.verdict[data-verdict='correct']` 등으로 붙어 있다 (381~392줄). 이것을 `.verdict[data-result='ok']` · `.verdict[data-result='bad']` 로 바꾼다 — 트레이싱과 같은 CSS 토큰
  - `.entry[data-result='ok']` · `.entry[data-result='bad']` 는 이미 있다. 그것과 판정 줄 색이 나뉘어 있었는데, 이제 같은 토큰 하나
- [ ] `verdictText(verdict)` 반환값의 톤 그대로 (Phase 3 에서 문구를 바꾸지 않음)

주석: 왜 두 곳이 같은 토큰을 쓰는가 — SPEC FR-NAV-12 · 트레이싱 화면 주석과 같은 논리 ("두 화면이 같은 것을 다르게 그리면 사용자가 판정을 두 번 배운다")

### 2. `tests/e2e/pwa.spec.ts` (수정)

- [ ] 131줄 `page.locator('[data-action="submit"]').click()` → `page.locator('[data-grade]').click()`
- [ ] 이 셀렉터 변경은 위 quiz 수정과 **같은 커밋에**

### 3. `tests/e2e/quiz.spec.ts`, `tests/e2e/quiz-feedback.spec.ts`, `tests/e2e/memorize-quiz.spec.ts` — 셀렉터 검색

- [ ] `data-action="submit"` · `data-action="next"` 를 참조하는 곳을 찾아 `[data-grade]` · `[data-next]` 로 바꾼다

```bash
grep -n 'data-action="submit\|data-action="next\|data-action=submit\|data-action=next' tests/e2e/*.spec.ts
```

- [ ] `data-verdict='correct'` 등 값 매치하는 곳도 확인 — 위 판정 줄 변경으로 `data-verdict` 는 존재만 가리키고 값은 `data-kind` 로 옮겨진다면 셀렉터를 옮긴다. 지금 값이 켜져 있으면 `[data-verdict]` 로 존재만 확인하는 곳은 그대로

### 4. `src/routes/3x3/bld/trace/+page.svelte`

트레이싱은 이미 대부분 규약을 지킨다. 두 곳만 확인한다.

- [ ] 진행 버튼 자리 확인 (FR-NAV-13 · SPEC 결정 8 · AD-NAV-9): 현재 트레이싱은 진행 버튼(`.controls`)이 큐브·계기·상태줄·설정 아래이고 입력 · 자판 · 판정 · 결과 위다. SPEC 표 12번은 **본문 최하단** 을 요구한다 — 자판·판정·결과 다음
  - **사용자 지시**: "지금 트레이싱은 8번 자리에 있으므로 페이즈 3 이 내린다"
  - 지금 트레이싱의 `.controls` 는 `.settings` 다음, `.entry` (입력·판정·결과) 앞에 있다. 이것을 **결과 다음, 기록 진입 앞** 으로 옮긴다
  - 새 순서 (SPEC 표): 되돌아가기 → h1 → 큐브 → (focus row) → 계기 → 상태줄 → 설정 → **입력칸 → 자판 → 판정 → 결과 상세 → 진행 버튼** → 기록 진입
  - 지금 순서: 되돌아가기(Phase 2에서 세움) → h1(Phase 2) → 큐브 → focus → 계기 → 상태줄 → 설정 → **진행 버튼 → 입력칸/자판 → 판정 → 결과** → 기록 진입
  - **바꾸는 것**: `<div class="controls">...</div>` (692~706줄) 을 `<div class="result">...</div>` 다음, `<div class="records-row">` 앞으로 옮긴다
  - CSS 는 조정 필요:
    - 지금 `.trace[data-stage='idle'] .entry { display: none }` (1028~1030) — `idle` 에서 입력 자리가 사라진다. 진행 버튼을 최하단으로 옮기면 `idle` 에서 시작 버튼이 결과·판정·입력이 다 접힌 자리에 뜬다 (SPEC "결정된 것 8번"). 이 접기 규칙은 그대로 유효
    - `[data-stage='result'] :global([data-pad='entry']) { display: none }` — 결과 단계에서 패드 접힘. 유효
    - 진행 버튼 자체는 접힘 규칙(단계별 하나만) 그대로 (1063~1071줄)
    - 순서만 바뀐다 — CSS 접기 규칙은 안 건드림

- [ ] 스크롤 원점 되돌리기 (FR-NAV-20): `start()` 함수(435~467줄)에 이미 `window.scrollTo({ top: 0 })` 있음. 유지. `next()` 함수(586~596줄) 에도 필요한지 확인 — `idle` 로 돌아올 때 설정이 다시 펴지면서 화면이 길어지므로 스크롤을 조정할 필요는 없음 (짧아지지 않음)

- [ ] `<h1>트레이싱</h1>` (Phase 2 에서 세운다) 아래에 UpLink 자리 (Phase 1 에서 세운다) 가 있어야 한다 — 이 페이즈에서 확인만

### 5. 다른 파일의 규약 확인

- [ ] 조회 (`.../lookup/+page.svelte`) — 진행 버튼도 판정 줄도 없음. 그대로
- [ ] 기준 목록 (`.../algs/+page.svelte`) — 진행 버튼도 판정 줄도 없음. 그대로
- [ ] 기준 상세 (`.../algs/[code]/+page.svelte`) — 진행 버튼도 판정 줄도 없음. 목록 표시 필터 두 개는 예외 (FR-NAV-11)
- [ ] 홈 (`+page.svelte`) — 진행 버튼도 판정 줄도 없음. 그대로

## 이 페이즈 안에서 결정 (설정 잠금)

**퀴즈에 잠금을 도입하지 않는다** (사용자 지시 · SPEC AD-NAV-10 · FR-NAV-11).

- 퀴즈는 시간을 재지 않고 기록도 남기지 않는다
- 지금 동작이 이미 맞다 — 입력 방식을 바꾸면 문제는 유지한 채 입력만 비운다 (`quiz/+page.svelte:112-116`)
- 이 자리에 `disabled` 를 붙이는 것이 아니라 붙이지 않는 것이 결정

**트레이싱은 이미 잠금이 있음.** `settingsLocked = $derived(stage !== 'idle')` (`trace/+page.svelte:336`) 이 두 `SegToggle` 에 `disabled={settingsLocked}` 로 전달됨. 손대지 않음.

**기준 상세의 두 토글도 잠그지 않음** — 표시 방식이지 판의 조건이 아님 (FR-NAV-11).

## 검증

- [ ] `pnpm check` 통과
- [ ] `pnpm test` 통과
- [ ] `pnpm test:e2e` 통과 (셀렉터 갱신 반영됨)
- [ ] `pnpm build` 통과
- [ ] `pnpm preview` — 사람 확인 항목 (T3 참조)

## 남기지 않을 것

- **판정 문구 자체를 안 바꾼다** — `verdictText` 함수 반환값. Phase 3 는 속성 규약만 옮긴다
- **트레이싱의 판정 규약을 안 바꾼다** — 이미 정본이다. 옮기는 것은 퀴즈만
- **퀴즈에 `idle` 을 만들지 않는다** — SPEC AD-NAV-5
- **퀴즈 잠금 도입 안 함** — SPEC AD-NAV-10, 사용자 지시
- **자판 편집 버튼 이름 안 건드림** — `data-action` 은 그 카테고리의 이름이다 (SPEC FR-NAV-13 표)
- **스크롤 원점 되돌리기를 새로 넣지 않음** — 필요한 곳(트레이싱 시작)에 이미 있다. 다른 화면은 단계가 바뀌어도 화면이 짧아지지 않음
