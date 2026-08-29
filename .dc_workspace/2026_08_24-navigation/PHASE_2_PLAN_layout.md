# Phase 2 — 화면 공통 구성 (layout)

**담당**: FR-NAV-7~10; NFR-NAV-1
**의존**: Phase 1 완료 (라우트가 새 자리에 앉아 있어야 한다)
**병렬 불가**: 순차 (사용자 지시)

## 목표

이 페이즈가 끝나면:
- 각 기능 화면에 `<h1>` 이 하나이고 그 텍스트가 화면 이름이다
- 설정이 화면 이름과 본문 사이(7번 자리)에 있다
- 홈 `UpLink` 가 화면 맨 위에 있다 (기준 상세만 예외)
- `pwa.spec.ts:129` 의 `h1[data-case]` 셀렉터가 새 셀렉터로 옮겨진다
- 진행 버튼 이름·자리, `data-stage`, 판정 줄 규약은 페이즈 3 이 다룬다 (여기서는 안 건드림)

## 선행 조건

- Phase 1 완료 (`pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build` 통과 상태)
- Phase 1 이 이미 홈 `UpLink` 자리를 잡아 뒀다 — 여기서는 `<h1>` 을 세우고 설정 자리를 옮긴다

## 대응 SPEC

| FR | 내용 |
|---|---|
| FR-NAV-7 | 홈 UpLink (Phase 1 에서 자리는 잡음. 여기서 재확인) |
| FR-NAV-8 | 화면은 자리가 고정된 영역의 세로 나열 |
| FR-NAV-9 | `<h1>` 은 화면 이름이고 화면당 하나 |
| FR-NAV-10 | 설정은 화면 이름과 본문 사이 (7번 자리) |
| NFR-NAV-1 | SSR/CSR 요소 구성·개수 불변 |

## 커밋 단위 (권장)

1. `feat(quiz): h1 을 화면 이름으로 옮기고 케이스 코드는 본문으로 내린다` — pwa.spec.ts:129 셀렉터 변경 포함
2. `feat(lookup,trace): 화면 이름 h1 을 세운다`
3. `refactor(anchors): 설정 토글을 화면 이름 아래로 옮긴다`

## 수정할 파일

### 1. `src/routes/3x3/bld/3style/corner/quiz/+page.svelte`

**퀴즈의 `<h1>` 이 바뀌는 것이 이 페이즈의 가장 큰 항목이다.** 지금 케이스 코드가 `<h1 data-case={current.case}>` 로 실려 있고 (205줄), 그것은 화면 이름이 아니라 문제다 (SPEC FR-NAV-9).

- [ ] 현재 `<h1 data-case={current.case}>{current.case}</h1>` 을 본문 요소로 내림
  - 대체 요소: `<div class="case" data-case={current.case}>{current.case}</div>`
  - 스타일은 지금 h1 스타일(`font-family: var(--mono); font-size: 3rem; letter-spacing: 0.15em`)을 그대로 옮김
  - 뜻이 "이 문제의 케이스 코드" 이므로 이름을 `.case` 로 두는 것이 자연스럽다
- [ ] 화면 최상단(홈 `UpLink` 아래)에 `<h1>퀴즈</h1>` 세움
  - `<svelte:head><title>3-Style Corner — 퀴즈</title></svelte:head>` 는 그대로 (h1 과 title 은 다른 축)
  - h1 스타일은 다른 화면과 톤을 맞춤 (기준 목록의 `h1 { font-size: 1.3rem; margin: 1rem 0 0.8rem; }` 를 참고)
- [ ] 설정 자리 확인 (FR-NAV-10 — 화면 이름과 본문 사이)
  - 지금: `<div class="input-mode">` (177줄) + `<label class="memorized-only">` (187줄) 이 이미 문제 표시(케이스 코드) 위에 있음
  - `<h1>퀴즈</h1>` 를 새로 세운 뒤에도 `input-mode` · `memorized-only` 가 h1 과 케이스 코드 사이에 있으면 규약 통과 — 지금 순서가 이미 그렇다
  - 확인만: `<h1>퀴즈</h1>` → 설정 (`input-mode`, `memorized-only`) → 케이스 코드 → 입력·판정·정답 → 진행 버튼 → 자판. 지금 순서 유지

### 2. `tests/e2e/pwa.spec.ts` (수정)

- [ ] 129줄 `expect(page.locator('h1[data-case]')).toBeVisible()` → `expect(page.locator('.case[data-case], [data-case]:not(h1)')).toBeVisible()` 혹은 더 좁게 `expect(page.locator('[data-case]')).toBeVisible()`
  - 지금 이 검사는 "퀴즈에 케이스 코드가 뜬다" 를 본다. 셀렉터를 새 요소에 맞춘다
  - 이 셀렉터 변경은 위 quiz 수정과 **같은 커밋에** 들어간다

이 파일의 다른 테스트도 훑는다:
- `pwa.spec.ts:120` `getByLabel('케이스 코드')` — 조회 화면의 입력. 그대로
- `pwa.spec.ts:123` `page.locator('section.case')` — 조회의 결과 카드. 그대로

### 3. `src/routes/3x3/bld/3style/corner/lookup/+page.svelte`

- [ ] 화면 최상단(홈 UpLink 아래)에 `<h1>조회</h1>` 세움
  - `<svelte:head><title>3-Style Corner — 조회</title></svelte:head>` 그대로
  - 지금 이 화면은 `<h1>` 자체가 없다 (FR-NAV-9 요구가 채워지지 않은 상태)
- [ ] 설정 자리 확인 — 이 화면은 설정이 없음 (SPEC "지금 구조" 표). h1 바로 아래에 `<div class="top">` (입력) 이 오는 지금 순서 유지

지금 파일의 `.top` (sticky 입력) 이 h1 아래로 내려간다. sticky 로 화면 상단에 붙는 것은 유지되지만, 스크롤 원점에서는 h1 아래에 위치한다.

### 4. `src/routes/3x3/bld/3style/corner/algs/+page.svelte` (기준 목록)

- [ ] 지금 있는 `<h1>기준공식</h1>` (62줄) 유지 — 화면 이름이 이미 h1 이다
- [ ] 홈 `UpLink` 를 h1 위에 배치 (Phase 1 에서 자리 잡음)
- [ ] 설정 자리 — 이 화면은 설정이 없음. 그대로

### 5. `src/routes/3x3/bld/3style/corner/algs/[code]/+page.svelte` (기준 상세)

- [ ] `<h1>{data.isDirect ? '기준 없음' : data.code}</h1>` (67줄) 유지 — 기준의 이름/코드가 화면 이름이다
- [ ] 상단 `UpLink href=".../algs" label="기준공식"` 유지 (Phase 1 에서 이미 그대로)
- [ ] **설정 토글을 이동**: 지금 `.toggles` (암기 숨김 · 역공식 숨김) 가 목록 머리(`list-head` 안, `[code]/+page.svelte:112-201`) 에 있다. 이 자리는 목록 바로 위이지 화면 이름 아래가 아니다.
  - **h1(및 기준 정보 카드) 아래, 목록 머리(`list-head`) 위로 올림.**
  - 목록 진도 표시(`{checkedCount}/{data.cases.length}`) 는 목록의 머리이므로 그대로 목록 위에 남긴다
  - `list-head` 는 진도만 담고, 토글은 그 위의 새 자리로

  구조 변경:
  ```
  <h1>{code}</h1>
  <div class="anchor">...</div>       <!-- 기준 알고리즘 카드. 본문의 일부 -->
  <div class="toggles">...</div>      <!-- 신설 자리. 설정 (7번) -->
  <div class="list-head">...</div>    <!-- 목록 머리. 진도만 남음 -->
  <p class="col-head">암기</p>
  <ul>...</ul>
  ```

  주의: SPEC FR-NAV-10 은 "설정은 화면 이름과 본문 사이" 다. 이 화면의 본문이 무엇인가는 해석 여지가 있는데, **기준 알고리즘 카드(`<div class="anchor">`)는 본문의 일부다** — 화면의 주요 콘텐츠. 그렇다면 설정은 그 위여야 하지만, 이 화면은 특별하다 — 기준 알고리즘을 위에서 보고 아래 목록을 훑는 구조라 알고리즘 카드가 화면 이름과 붙어 있어야 한다 (지금 sticky 로 만든 이유).

  대안 해석: `list-head` 안의 진도는 목록의 머리이지 "설정" 이 아니고, 정말 설정은 두 토글(암기 숨김 · 역공식 숨김) 이다. 그 둘은 목록을 어떻게 보일지 정하는 것이므로 **목록의 머리에 있는 지금 자리가 자연스럽다**.

  **결론**: 이 화면의 두 토글은 `.dc_workspace/CONVENTIONS.md` 의 예외로 두고 그대로 남긴다. SPEC FR-NAV-11 이 "기준 상세의 두 토글도 해당하지 않는다 — 표시 방식이지 판의 조건이 아니고, 보는 도중에 바꾸는 것이 정상 사용" 이라 잠금 규칙에서 뺐다. **설정 자리 규칙에서도 같은 논리로 뺀다** — 이 두 토글은 판의 설정이 아니라 목록 표시 필터라, 목록 옆이 자연스러운 자리다.

  **이 결정을 GLOBAL 이 못 박고 여기 반영한다.** 아래 "이 페이즈 안에서 결정" 을 볼 것.

- [ ] 위 결정에 따라 **기준 상세의 토글은 지금 자리를 유지한다.** 페이즈 4 의 규약 검사가 이 예외를 알아야 한다 (검사표에 "기준 상세 제외" 로 표시)

### 6. `src/routes/3x3/bld/trace/+page.svelte`

- [ ] 홈 UpLink 를 화면 최상단에 배치 (Phase 1 에서 자리 잡음)
- [ ] 화면 최상단(홈 UpLink 아래)에 `<h1>트레이싱</h1>` 세움
  - `<svelte:head><title>트레이싱 훈련</title></svelte:head>` 그대로
  - 지금은 `<h1>` 이 없다 (SPEC "지금 구조" 표)
- [ ] 설정 자리 확인 — 지금 트레이싱은 설정(`.settings`, 675줄)이 시작 버튼 위에 있다. 화면 이름과 본문 사이가 아니다.
  - **판단**: 트레이싱의 설정은 `idle` 에서만 뜨고 판이 도는 동안 접힌다 (FR-NAV-18). h1 바로 아래로 올리면 설정이 뜨는 순간 큐브가 밀린다 — 이 화면은 큐브가 h1 바로 아래 서는 것이 훈련의 성립 조건이다 (뷰포트가 짧으면 스크롤 없이 안 보인다)
  - **결정**: 트레이싱의 설정도 `idle` 에서 큐브·계기·상태줄·본문 아래에 뜬다. **이것도 예외**. 판이 도는 동안 접히면 시작 버튼이 큐브 바로 아래로 붙는 구조라 h1 아래에 두면 큐브 위에 큰 빈 자리가 생겼다 사라진다
  - **판단의 근거**: FR-NAV-8 이 "영역 순서는 고정" 이라 했지만, 이 화면의 설정은 **큐브를 본 뒤에 조절하는 값** (대상·모드) 이라 아래에 있는 것이 흐름에 맞다. SPEC 표 12번(진행 버튼 자리)의 근거와 같다 — 그 단계에 보여줄 것을 다 보여준 다음에 선다
  - **이 예외도 GLOBAL 이 못 박는다.** 아래 "이 페이즈 안에서 결정" 을 볼 것

## 이 페이즈 안에서 결정 (설정 자리 예외)

SPEC FR-NAV-10 은 "설정은 화면 이름과 본문 사이" 라고 못 박았지만 실제로 두 화면이 예외가 된다.

- **기준 상세의 두 토글** — 판의 설정이 아니라 목록 표시 필터. 잠금 규칙(FR-NAV-11)도 이미 이것을 예외로 뺐다
- **트레이싱의 세션 설정** — 큐브·계기·상태줄 아래에 서서, 판이 도는 동안 접힌다. 큐브가 h1 바로 아래에 서는 것이 훈련 흐름의 조건이라 설정을 그 사이에 넣을 수 없다

두 예외를 페이즈 4 의 규약 검사가 알아야 한다. `conventions.spec.ts` 의 "설정이 제목과 본문 사이" 검사에서 이 두 화면을 제외한다.

**이 결정은 SPEC 을 상신하지 않는다.** SPEC 이 이미 FR-NAV-11 에서 기준 상세 토글의 성격이 다르다고 밝혀 뒀고, 트레이싱은 SPEC 표 12번의 논리(그 단계에 보여줄 것을 다 보여준 다음)가 그대로 설정에도 적용되는 것이라 SPEC 의 의도와 어긋나지 않는다.

**페이즈 5 의 `CONVENTIONS.md` 규칙 1.3 에 이 예외를 함께 적는다** — 규약과 예외가 같은 자리에 있어야 사람이 지킨다.

## 검증

- [ ] `pnpm check` 통과
- [ ] `pnpm test` 통과 (신규 없음)
- [ ] `pnpm test:e2e` 통과 (`pwa.spec.ts` 셀렉터 갱신 포함)
- [ ] `pnpm build` 통과
- [ ] `pnpm preview` 로 네 화면의 최상단에 `<h1>` 이 화면 이름으로 뜨는지 사람 눈으로 확인
- [ ] 퀴즈에서 케이스 코드가 여전히 크게 뜨는지 (본문 요소로 내렸지만 크기·자리는 그대로)

## 남기지 않을 것

- 판정 줄 규약 (`data-verdict`, `data-result`) — 페이즈 3
- 진행 버튼 이름 (`data-grade`, `data-next`, `data-action` 제거) — 페이즈 3
- `data-stage` 신설 — 페이즈 3
- 접기 규칙 (FR-NAV-18) 을 지금 안 지키는 자리 — 페이즈 3
- 스크롤 원점 되돌리기 (FR-NAV-20) — 페이즈 3
