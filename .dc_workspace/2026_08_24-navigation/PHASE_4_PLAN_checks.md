# Phase 4 — 규약 검사 (checks)

**담당**: FR-NAV-17
**의존**: Phase 2·3 완료 (검사할 대상이 서 있어야 한다)
**병렬 불가**: 순차

## 목표

이 페이즈가 끝나면:
- `tests/e2e/conventions.spec.ts` 신설
- SPEC FR-NAV-17 의 표에서 "검사 가능" 으로 표시된 항목이 자동 검사로 서 있다
- 검사 안 되는 항목은 페이즈 5 의 `CONVENTIONS.md` 가 "검사 없음 — 리뷰에서 본다" 로 표시한다 (여기서는 목록만 확정)

**4 를 5 보다 먼저 두는 이유** (SPEC): 검사를 먼저 쓰면 규약이 실제로 성립하는지 그 자리에서 드러난다. 문서를 먼저 쓰면 구현이 못 따라오는 규약을 적어 놓고도 모른다.

## 선행 조건

- Phase 2·3 완료. `<h1>` 통일, 진행 버튼 이름, `data-stage`, 판정 줄 규약이 모두 자리에 있다

## 대응 SPEC

| FR | 내용 |
|---|---|
| FR-NAV-17 | 기계로 확인할 수 있는 규약은 검사로 못 박는다 |

## 커밋 단위 (권장)

한 커밋. 파일이 하나이고 검사 항목이 서로 관련되어 있어 부분 커밋의 값이 없다.

## 수정·생성할 파일

### 1. `tests/e2e/conventions.spec.ts` (신규)

모든 라우트를 돌며 규약을 확인한다. Playwright.

**라우트 목록의 정본**: 검사 파일 상단에 리터럴로 적는다.

```ts
const FEATURE_ROUTES = [
  { path: '/3x3/bld/3style/corner/lookup', name: '조회' },
  { path: '/3x3/bld/3style/corner/algs', name: '기준공식' },
  { path: '/3x3/bld/3style/corner/quiz', name: '퀴즈' },
  { path: '/3x3/bld/trace', name: '트레이싱' }
];
const HOME = '/';
const DETAIL_SAMPLE = '/3x3/bld/3style/corner/algs/GC';  // 데이터가 아는 기준 하나
```

**리터럴로 적는 이유** (SVELTE.md §2): "E2E 의 진입 주소는 언제나 리터럴이다. 검사가 앱과 같은 방식으로 URL 을 계산하면 URL 이 틀렸을 때 같이 틀린다."

검사 항목 (SPEC FR-NAV-17 표):

#### 1a. `<h1>` 이 화면당 하나이고 화면 이름이다

- [ ] `test('T4-1. 각 화면의 h1 은 정확히 하나다', ...)`
- [ ] `test('T4-2. 각 화면의 h1 텍스트가 화면 이름이다', ...)`
  - 홈 = "홈", 조회 = "조회", 기준공식 = "기준공식", 퀴즈 = "퀴즈", 트레이싱 = "트레이싱"
  - 기준 상세는 `{code}` 혹은 "기준 없음" — 별도 검사 (T4-3)
- [ ] `test('T4-3. 기준 상세의 h1 은 기준 코드나 "기준 없음" 이다', ...)` — DETAIL_SAMPLE 로 확인

#### 1b. 기능 화면에 홈 UpLink 가 있다

- [ ] `test('T4-4. 네 기능 화면에 홈으로 가는 UpLink 가 있다', ...)`
  - 각 라우트에서 `[data-up-link="/"]` (혹은 `href="/"` 인 UpLink) 존재
- [ ] `test('T4-5. 기준 상세는 기준공식으로 가는 UpLink 를 갖는다', ...)`
  - `[data-up-link="/3x3/bld/3style/corner/algs"]` 존재
- [ ] `test('T4-6. 홈에는 UpLink 가 없다', ...)`
  - `[data-up-link]` 부재

#### 1c. 공식 화면에 트레이싱 링크가 없다

- [ ] `test('T4-7. 조회·기준공식·퀴즈·기준 상세에서 트레이싱으로 가는 링크가 없다', ...)`
  - `a[href="/3x3/bld/trace"]` · `a[href^="/3x3/bld/trace"]` 부재
- [ ] `test('T4-8. 트레이싱에서 공식 화면으로 가는 링크가 없다', ...)`
  - `/3x3/bld/trace` 에서 `a[href^="/3x3/bld/3style"]` 부재
  - (홈 링크는 예외 — 홈에서 갈 수 있으므로 이 검사와 상관없음)

#### 1d. `/3x3/bld/trace` 에 탭바가 없다

- [ ] `test('T4-9. 트레이싱에는 하단 탭바가 없다', ...)`
  - `nav` 요소 부재
- [ ] `test('T4-10. 홈에는 하단 탭바가 없다', ...)`
  - `nav` 요소 부재
- [ ] `test('T4-11. 조회·기준공식·퀴즈에 하단 탭바가 있고 셋을 담는다', ...)`
  - `nav a` 개수 3
  - `nav` 안의 링크가 `.../lookup` · `.../algs` · `.../quiz` 셋
- [ ] `test('T4-12. 기준 상세의 하단 탭바는 목록의 것을 물려받는다', ...)`
  - `nav a` 개수 3, "기준공식" 이 활성

#### 1e. 라우트가 축을 따른다

- [ ] `test('T4-13. 라우트 목록이 축을 따른다 — 홈 말고 한 칸짜리 라우트가 없다', ...)`
  - 파일시스템 검사 (정적). `src/routes/` 아래의 `+page.svelte` 파일 목록을 읽어 홈(`+page.svelte`) 하나 외에는 모두 축을 따르는 경로에 있는지 확인
  - Playwright 가 아니라 **단위 테스트** 로 옮길 수도 있다 — `tests/unit/routes.test.ts` 신설. 파일 이름 정적 검사이므로 단위 테스트가 값이 싸다
  - **결정**: 단위 테스트로 낸다. Playwright 는 화면을 열지만 이 검사는 파일시스템만 본다. `tests/unit/routes.test.ts` 신설
  - 검사 대상: `src/routes/**/+page.svelte` 목록 → 각 경로가 `/` 이거나 `/3x3/bld/...` 로 시작해야 함

#### 1f. 설정이 제목과 본문 사이에 있다

- [ ] `test('T4-14. 퀴즈의 설정이 h1 아래·본문 위에 있다', ...)`
  - `<h1>` 요소의 `boundingBox.y` < 설정 요소의 `boundingBox.y` < 본문 첫 요소의 `boundingBox.y`
  - **`@viewport` 태그 필수** (boundingBox 를 씀)
- [ ] **예외**: 기준 상세, 트레이싱은 검사에서 제외 (GLOBAL 이 예외로 못 박음, Phase 2 결정)

#### 1g. 영역이 자기 단계에서만 선다 (트레이싱)

- [ ] `test('T4-15. 트레이싱 idle 에서 진행 버튼은 시작뿐이다', ...)`
  - `[data-stage="idle"]` 상태에서 `[data-start]` visible, `[data-grade]`/`[data-next]`/`[data-memorized]` hidden
- [ ] 트레이싱 각 단계마다 visible/hidden 을 확인 — trace-session.spec.ts 에 이미 있을 수 있음. 중복이면 안 만든다
- [ ] `test('T4-16. 퀴즈 result 에서만 다음 문제 버튼이 뜬다', ...)`
  - `[data-stage="result"]` 에서 `[data-next]` visible
  - `[data-stage="active"]` 에서 `[data-next]` 부재 (혹은 hidden — DOM 에는 있는지 규약 확인)
  - **주의**: 퀴즈는 `{#if verdict}` 로 진행 버튼을 바꿔 그리고 있음 (`quiz/+page.svelte:251-267`). 이것이 FR-NAV-18 "접기는 CSS" 규약과 부딪힌다
    - **판단**: SPEC FR-NAV-18 의 예외 기준은 "표시 여부가 localStorage 나 브라우저 상태에서 오는가" 다. `verdict` 는 사용자 입력에서 오는 값이지 브라우저 상태가 아니다 → 접기 대상. 그러나 진행 버튼은 단계마다 다른 버튼이 뜨는 것이 자연스럽고, 두 버튼 중 하나만 렌더하는 것과 CSS 로 접는 것의 차이가 크지 않음
    - **완화된 검사**: `active` 상태에서 `[data-next]` 는 렌더되지 않아도 검사 통과. `result` 상태에서 `[data-next]` 가 클릭 가능해야 함
    - 이 결정을 CONVENTIONS.md 에 예외로 적음 (페이즈 5)

#### 1h. 접은 영역이 DOM 에는 남아 있다

- [ ] `test('T4-17. 트레이싱 tracing 단계에서 설정 요소가 DOM 에 남아 있다', ...)`
  - `[data-stage="tracing"]` 상태에서 `.settings` 는 `toHaveCount(1)` 이고 `toBeHidden()`
  - trace-session.spec.ts 에 이미 있을 수 있음. 중복이면 안 만든다

#### 1i. 단계가 바뀌면 스크롤이 원점이다

- [ ] `test('T4-18. 트레이싱 시작 후 스크롤이 원점이다 @viewport', ...)`
  - 시작 전 페이지를 밑으로 스크롤 → 시작 클릭 → `window.scrollY === 0`
  - trace-session.spec.ts 에 이미 있을 수 있음

#### 1j. 진행 버튼 이름이 `data-{동작}` 이다

- [ ] `test('T4-19. 어느 화면에서도 data-action="submit" · "next" 가 없다', ...)`
  - 정적 검사. `src/routes/**/+page.svelte` 파일 텍스트 검사 — `data-action="submit"` · `data-action="next"` 부재
  - **단위 테스트로**. `tests/unit/routes.test.ts` (T4-13 과 같은 파일) 에 추가
  - 자판 편집 버튼의 `data-action="undo"` 등은 허용 (다른 규약)

#### 1k. 판정 줄이 `data-verdict` + `data-result` 를 쓴다

- [ ] `test('T4-20. 퀴즈와 트레이싱의 판정 줄이 규약 속성을 갖는다', ...)`
  - 퀴즈에서 오답을 하나 내고 `.verdict[data-verdict][data-result="bad"]` 확인
  - 트레이싱은 trace-session.spec.ts 에 이미 있을 수 있음

### 2. `tests/unit/routes.test.ts` (신규)

정적 검사 (Vitest). 파일시스템만 본다.

- [ ] `it('라우트 목록이 축을 따른다', ...)` — T4-13
  - `src/routes/**/+page.svelte` 목록을 읽어 각 경로가 홈(`+page.svelte`) 이거나 `3x3/bld/...` 로 시작
- [ ] `it('진행 버튼 이름 규약을 지킨다', ...)` — T4-19
  - `src/routes/**/+page.svelte` 파일 텍스트 검사. `data-action="submit"` · `data-action="next"` 부재
  - `data-action="undo"` · `"clear"` · `"back"` · `"separator"` 는 허용

## 검사 안 되는 규약 (문서로만)

SPEC FR-NAV-17 표에서 "불가" 로 표시된 것:

| 규약 | 왜 불가 |
|---|---|
| UI 문구가 사실만 적는가 (NFR-9) | 사람이 읽어야 한다 |
| 카테고리 이름이 하는 일을 가리키는가 | 사람이 읽어야 한다 |
| 아이콘이 상태와 함께 색으로도 알리는가 (#26) | 색과 아이콘을 함께 봐야 하고, 접근성 판정은 사람이 낸다 |

페이즈 5 의 `CONVENTIONS.md` 가 이 항목들에 "검사 없음 — 리뷰에서 본다" 로 표시한다.

## 검증

- [ ] `pnpm check` 통과
- [ ] `pnpm test` 통과 (신규 단위 테스트 포함)
- [ ] `pnpm test:e2e` 통과 (신규 conventions.spec.ts 포함)
- [ ] `pnpm build` 통과
- [ ] `tests/unit/e2e-tags.test.ts` 가 신규 E2E 를 파싱해 `@viewport` 태그 규약을 확인 — 신규 테스트 제목에 뷰포트 신호(boundingBox 등)가 있으면 `@viewport` 태그 붙였는가

## 남기지 않을 것

- **신규 규약을 이 페이즈에서 추가하지 않는다** — 검사만 씀. 코드에 새 신호를 넣지 않음
- **트레이싱의 기존 검사(`trace-session.spec.ts` 등)를 중복 재작성하지 않는다** — 대신 문서에 "이 규약은 trace-session.spec.ts:XX 가 이미 검사한다" 로 표시
- **정적 검사(파일 텍스트) 를 E2E 로 넣지 않음** — 단위 테스트로 함. E2E 는 프리뷰 서버 기동 · 페이지 로드로 값이 비쌈
