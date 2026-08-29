# Phase 1 — 라우트 이동 (routes)

**담당**: FR-NAV-1~7, 21~23; AD-NAV-1~3, 6, 8; NFR-NAV-2
**병렬**: 불가 — 라우트가 흔들린다
**끝나는 순간**: 배포·미리보기로 만져볼 수 있다 (사용자 지시). 홈이 뜨고 네 기능이 새 경로에서 열린다

## 목표

이 페이즈가 끝나면:
- `/` 가 홈 — 기능 네 개를 카테고리(3BLD) 아래 이름과 한 줄 설명으로 나열
- 조회·기준공식·퀴즈·트레이싱이 새 경로에서 돈다
- 하단 탭은 형제만 담고, 트레이싱과 홈에는 안 뜬다
- `pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build` 전부 통과
- `<h1>` 통일과 규약 통일은 아직 하지 않는다 (페이즈 2·3 이 한다)

## 선행 조건

- `main` 브랜치 상태에서 시작 (현재 워크트리 `../cube-study-feature-tracing`, 브랜치 `feat/0.5.0`)
- `pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build` 가 지금 통과 상태

## 대응 SPEC

| FR | 내용 |
|---|---|
| FR-NAV-1 | `/` 는 홈. 진도·통계 없음. 환영 문구·카드·일러스트 없음 |
| FR-NAV-2 | 홈은 기능 넷을 이름·경로로 나열 |
| FR-NAV-3 | 이름 + 한 줄 설명. 잘하는 법·권유 금지 |
| FR-NAV-4 | 하단 탭은 형제만 (기능 칸만 다른 실재 화면). 상세는 부모의 탭을 물려받음 |
| FR-NAV-5 | 형제가 하나뿐이면 탭바를 안 그림 (트레이싱) |
| FR-NAV-6 | 홈에는 탭바가 없음 |
| FR-NAV-7 | 모든 기능 화면 맨 위에 홈 UpLink. 기준 상세만 `기준공식` 으로 |
| FR-NAV-21 | 라우트가 `/{퍼즐}/{종목}/{방법}/{세트}/{기능}` 축을 따름 |
| FR-NAV-22 | 버퍼는 경로에 안 넣음 (이번엔 걸리지 않음 — 트레이싱 세션 설정) |
| FR-NAV-23 | 묶음과 형제는 경로에서 읽음. 손으로 적는 배열 없음 |
| AD-NAV-8 | 기준공식 화면의 기능 칸은 `algs` |

## 커밋 단위 (권장)

1. `chore(routes): 화면 넷을 새 경로로 옮긴다` — `git mv` 로 폴더 이동만. import 경로가 흔들리지 않는지 확인
2. `feat(routes): 홈을 세우고 nav 를 경로에서 계산한다` — 새 홈 신설, `nav.ts`, `+layout.svelte` 정리
3. `test(e2e): goto URL 을 새 경로로 옮긴다` — E2E 파일들 정리

## 수정·생성할 파일

### 1. 폴더 이동 (`git mv`)

**이동만 한다. 파일 내용은 이 단계에서 안 바꾼다.** 각 파일 안의 내부 링크·`svelte:head` 문구는 다음 단계가 손댄다.

```bash
mkdir -p src/routes/3x3/bld/3style/corner/lookup
mkdir -p src/routes/3x3/bld/3style/corner/algs
mkdir -p src/routes/3x3/bld/3style/corner/quiz
mkdir -p src/routes/3x3/bld/trace

git mv src/routes/+page.svelte src/routes/3x3/bld/3style/corner/lookup/+page.svelte
git mv src/routes/anchors/+page.svelte src/routes/3x3/bld/3style/corner/algs/+page.svelte
git mv src/routes/anchors/+page.ts src/routes/3x3/bld/3style/corner/algs/+page.ts
git mv src/routes/anchors/[code]/+page.svelte src/routes/3x3/bld/3style/corner/algs/[code]/+page.svelte
git mv src/routes/anchors/[code]/+page.ts src/routes/3x3/bld/3style/corner/algs/[code]/+page.ts
git mv src/routes/quiz/+page.svelte src/routes/3x3/bld/3style/corner/quiz/+page.svelte
git mv src/routes/trace/+page.svelte src/routes/3x3/bld/trace/+page.svelte

rmdir src/routes/anchors/[code] src/routes/anchors src/routes/quiz src/routes/trace
```

이 단계 후에는 `pnpm build` 가 깨진다 — 홈이 없어졌고, `+layout.svelte` 의 링크가 옛 경로다. 정상이다.

### 2. `src/routes/+page.svelte` (신규 — 홈)

**전체를 새로 쓴다.** 조회 화면 코드는 위 단계에서 이미 옮겨졌다.

- [ ] 카테고리 이름 "3BLD" 하나. 그 아래 네 항목
- [ ] 각 항목: 이름 + 한 줄 설명 + 링크. 아이콘·일러스트 없음
- [ ] 링크는 리터럴 `href` (SVELTE.md §2, "href 는 리터럴로 적는다")
- [ ] `<h1>홈</h1>` — FR-NAV-9 가 화면당 하나를 요구. 이름은 "홈" 이다 (탭 라벨과는 별개)
- [ ] `<svelte:head><title>CubeStudy — 홈</title></svelte:head>` — 다른 화면의 `3-Style Corner — X` 와 톤을 맞추되 이 화면은 "홈" 하나로 끝난다
- [ ] `UpLink` 를 쓰지 않는다 — 홈이 상위다 (FR-NAV-7 는 기능 화면 얘기)
- [ ] 진도·통계 숫자 없음 (FR-NAV-1). 데이터셋을 로드하지 않는다 (NFR-NAV-3)
- [ ] `data-home` 속성을 루트 요소에 붙인다 — 페이즈 4 의 검사가 이것으로 홈을 알아본다

SPEC FR-NAV-3 의 문구 예시:

```
3BLD
  조회        스티커 2글자로 알고리즘을 찾습니다
  기준공식     기준공식별 케이스 목록과 암기 진도
  퀴즈        케이스를 보고 알고리즘을 칩니다
  트레이싱     스크램블에서 타깃 열을 뽑습니다
```

경로:

| 이름 | 경로 |
|---|---|
| 조회 | `/3x3/bld/3style/corner/lookup` |
| 기준공식 | `/3x3/bld/3style/corner/algs` |
| 퀴즈 | `/3x3/bld/3style/corner/quiz` |
| 트레이싱 | `/3x3/bld/trace` |

주석에 다음을 남긴다 — 왜 카테고리 배열이 아니라 손으로 적었는가 (묶음이 하나뿐이라 배열의 값이 없다), 묶음이 둘 이상 되는 날 무엇을 바꾸는가 (구분선을 하나 더 긋는다, SPEC "3번 — 홈의 계층을 언제 접을 것인가").

### 3. `src/lib/ui/nav.ts` (신규)

경로에서 형제·활성 탭을 계산하는 순수 함수. `+layout.svelte` 가 이것 하나만 부른다.

- [ ] `FEATURE_LABELS`: `{ lookup: '조회', algs: '기준공식', quiz: '퀴즈', trace: '트레이싱' }`
- [ ] `SIBLING_GROUPS`: `{ '/3x3/bld/3style/corner': ['lookup', 'algs', 'quiz'] }` — 트레이싱은 형제가 없으니 안 넣음
- [ ] `tabsFor(pathname: string, routeId: string | null): NavTab[]`
  - 반환: `Array<{ href: string, label: string, active: boolean, feature: string }>` — 형제가 하나뿐이면 빈 배열
  - `routeId` 에서 동적 세그먼트(`[code]` 같은)를 걷어낸 경로로 부모 접두사를 계산 (AD-NAV-B). 예: `/3x3/bld/3style/corner/algs/[code]` → 부모 `/3x3/bld/3style/corner`, 자기 기능 `algs`
  - 부모가 `SIBLING_GROUPS` 에 있으면 그 형제들을 반환 (자기 기능이 형제에 포함되어야 함)
  - 없으면 빈 배열
  - 활성 판정: `pathname` 의 세그먼트 배열에 그 탭의 `feature` 가 있으면 활성 (AD-NAV-J)
- [ ] `isHome(pathname: string): boolean` — `pathname === '/'` 하나. 다른 경로가 홈이 될 일이 이번 범위에는 없다

이 파일은 **모듈·룬을 안 쓰는 순수 TypeScript** 다 (`.ts`, `.svelte.ts` 아님). 단위 테스트가 붙기 좋게 함수 계약이 단순하다.

주석에 다음을 남긴다 — 왜 SIBLING_GROUPS 를 손으로 두는가 (라벨은 어차피 어딘가에 있어야 하고, i18n 이 오는 날 이 자리가 번역표의 자리가 된다). "손으로 적는 카테고리 배열을 두지 않는다" (FR-NAV-23) 의 원래 비판은 소속·순서를 손으로 적는 것이었고, 여기서 하는 것은 라벨 매핑 하나다.

### 4. `src/routes/+layout.svelte` (수정)

- [ ] `import { tabsFor, isHome } from '$lib/ui/nav.js'` 추가
- [ ] `const nav = [...]` 배열 (63~68 줄) 제거
- [ ] `let tabs = $derived(tabsFor(page.url.pathname, page.route.id))` 신설
- [ ] `let showTabs = $derived(!isHome(page.url.pathname) && tabs.length > 0)` — 홈과 형제 없는 화면에서 안 그림 (FR-NAV-5, 6)
- [ ] `<nav>` 를 `{#if showTabs}<nav>...</nav>{/if}` 로 감싼다 — **탭바는 하이드레이션 시점에 갈리지 않는다** (각 라우트가 자기 SSR 결과로 시작하고 하이드레이션에서 같은 것으로 붙는다. NFR-NAV-1 을 침해하지 않는다)
- [ ] `<a>` 순회를 `tabs` 로 교체. `class:on={tab.active}` 사용
- [ ] `href` 는 `tab.href` (전체 경로. `tabsFor` 가 부모 접두사 + 기능 칸으로 만들어 반환)
- [ ] `nav` 스타일(`nav`, `nav a`, `nav a.on`) 은 그대로 유지 — 시각적 규약은 안 바꿈

주석: `page.url.pathname === item.href` 비교(AD-NAV-J 의 옛 판정)를 왜 없앴는가 — 상세에서 목록 탭이 켜져야 하고, 정확 일치로는 그것을 낼 수 없다.

### 5. 옮긴 화면 4곳의 내부 링크 접두사 교체

**이 페이즈에서는 링크 접두사만 옮긴다.** `<h1>` 통일·판정 줄 통일 등은 페이즈 2·3 이 한다.

#### 5a. `src/routes/3x3/bld/3style/corner/lookup/+page.svelte`

- [ ] `<UpLink href="/anchors/{from}" ...>` (74줄) → `<UpLink href="/3x3/bld/3style/corner/algs/{from}" ...>`
- [ ] 다른 링크 없음 (조회 화면의 케이스 → 케이스 링크는 `CaseView.svelte` 안)

#### 5b. `src/routes/3x3/bld/3style/corner/algs/+page.svelte`

- [ ] `<a href="/anchors/{r.name}" ...>` (73줄) → `<a href="/3x3/bld/3style/corner/algs/{r.name}" ...>`
- [ ] `<a href="/anchors/direct" ...>` (99줄) → `<a href="/3x3/bld/3style/corner/algs/direct" ...>`

#### 5c. `src/routes/3x3/bld/3style/corner/algs/[code]/+page.svelte`

- [ ] `<UpLink href="/anchors" label="기준공식" />` (65줄) → `<UpLink href="/3x3/bld/3style/corner/algs" label="기준공식" />`
- [ ] `<a href="/?c={c.case}&from={data.code}">` (234줄) → `<a href="/3x3/bld/3style/corner/lookup?c={c.case}&from={data.code}">`

#### 5d. `src/routes/3x3/bld/3style/corner/quiz/+page.svelte`

- [ ] `<a href="/?c={current.case}" ...>` (247줄) → `<a href="/3x3/bld/3style/corner/lookup?c={current.case}" ...>`

### 6. `src/lib/ui/CaseView.svelte` (수정)

- [ ] `<a href="/?c={entry.inverse}{from ? ...}" ...>` (218줄) → `<a href="/3x3/bld/3style/corner/lookup?c={entry.inverse}{from ? ...}" ...>`

이 컴포넌트는 조회 화면에서만 쓰인다. 링크 접두사만 바꾼다.

### 7. 옮긴 화면 4곳에 홈 `UpLink` 추가 (FR-NAV-7)

**이 페이즈에서 홈 링크 자리만 확보한다.** `<h1>` 자체는 페이즈 2 가 세운다.

- [ ] 조회: 상단에 `<UpLink href="/" label="홈" />` — 지금은 `{#if from}` 안에만 UpLink 가 있다. `from` 이 없어도 홈 링크가 뜨도록 한다
- [ ] 기준공식 목록 (`algs/+page.svelte`): 상단에 `<UpLink href="/" label="홈" />` 추가
- [ ] 기준공식 상세 (`algs/[code]/+page.svelte`): 이미 `<UpLink href="/3x3/bld/3style/corner/algs" label="기준공식" />` 있음. 그대로 (FR-NAV-7 예외)
- [ ] 퀴즈 (`quiz/+page.svelte`): 상단에 `<UpLink href="/" label="홈" />` 추가
- [ ] 트레이싱 (`trace/+page.svelte`): 상단에 `<UpLink href="/" label="홈" />` 추가

조회에서 기존 `{#if from}<UpLink href="..." label={upLabel ?? ''} />{/if}` 는 유지하되, from 이 없을 때 홈 링크가 뜨도록 `{:else}<UpLink href="/" label="홈" />{/if}` 를 붙인다 — DOM 순서·개수가 SSR/CSR 에서 갈리지 않도록 반드시 else 로 하나만 뜨는 구조.

### 8. E2E — `goto` URL 을 새 경로로

**실제 파일을 다시 세어 확인** (사용자 지시). 아래는 SPEC "이관 비용" 을 실측으로 확인한 값. `pnpm test:e2e` 가 통과할 때까지 반복한다.

`goto` 호출을 세면 이렇다 (2026-08-26 기준):

| 파일 | 옛 경로 접두사 | 개수 | 새 접두사 |
|---|---|---|---|
| `about.spec.ts` | `/` (loop 하나 포함) | 9 (그 중 8 은 `/`, 1 은 loop 안 `/anchors` `/quiz`) | **그대로 둔다** — 레이아웃(상단 바)만 본다. 홈에서도 상단 바가 그대로 뜬다 (T1-3) |
| `alt-routes.spec.ts` | `/?c=` | 6 | `/3x3/bld/3style/corner/lookup?c=` |
| `anchor-hide-inverse.spec.ts` | `/anchors/` | 2 | `/3x3/bld/3style/corner/algs/` |
| `anchor-sticky.spec.ts` | `/anchors/` | 3 | `/3x3/bld/3style/corner/algs/` |
| `lookup.spec.ts` | `/` · `/?c=` · `/anchors/` | 45 | `/3x3/bld/3style/corner/{lookup,algs}` |
| `memorize-checkbox.spec.ts` | `/` · `/anchors/` · `/?c=` | 11 | 각 접두사 교체 |
| `memorize-clear.spec.ts` | `/` · `/anchors/` | 7 | 각 접두사 교체 |
| `memorize-hide.spec.ts` | `/anchors/` | 7 | `/3x3/bld/3style/corner/algs/` |
| `memorize-progress.spec.ts` | `/anchors/` | 9 | `/3x3/bld/3style/corner/algs/` |
| `memorize-quiz.spec.ts` | `/quiz` | 9 | `/3x3/bld/3style/corner/quiz` |
| `notation.spec.ts` | `/?c=` | 6 | `/3x3/bld/3style/corner/lookup?c=` |
| `pwa.spec.ts` | `/` · `/anchors` · `/quiz` · `/?c=` | 25 | 각 접두사 교체 |
| `quiz.spec.ts` | `/quiz` | 24 | `/3x3/bld/3style/corner/quiz` |
| `quiz-feedback.spec.ts` | `/quiz` | 3 | `/3x3/bld/3style/corner/quiz` |
| `smoke.spec.ts` | `/` · `/?c=` | 2 | `/3x3/bld/3style/corner/lookup` · `.../lookup?c=` (378 케이스 전수) |
| `trace-input.spec.ts` | `/trace` | 1 | `/3x3/bld/trace` |
| `trace-noleak.spec.ts` | `/trace` | 1 | `/3x3/bld/trace` |
| `trace-session.spec.ts` | `/trace` · `/quiz` | 7 | `/3x3/bld/trace` · `/3x3/bld/3style/corner/quiz` |

작업 방식:

- [ ] 각 파일에서 URL 접두사를 정확히 옮긴다. `/'` → `'/3x3/bld/3style/corner/lookup'`, `/?c=` → `/3x3/bld/3style/corner/lookup?c=`, `/anchors` → `/3x3/bld/3style/corner/algs`, `/anchors/${...}` → `/3x3/bld/3style/corner/algs/${...}`, `/quiz` → `/3x3/bld/3style/corner/quiz`, `/trace` → `/3x3/bld/trace`
- [ ] `about.spec.ts` 는 **손대지 않는다**. 그 파일의 검사(상단 바·정보 모달)는 홈에서도 그대로 돈다. 옛 `/anchors` `/quiz` 를 loop 안에서 여는 자리 하나(42~44줄)는 새 경로로 옮긴다
- [ ] `pwa.spec.ts:129` 의 `h1[data-case]` 셀렉터는 **여기서 안 옮긴다** — 페이즈 2 가 h1 을 옮길 때 함께 옮긴다 (같은 커밋)
- [ ] `pwa.spec.ts:131` 의 `[data-action="submit"]` 셀렉터도 **여기서 안 옮긴다** — 페이즈 3 가 진행 버튼 이름을 옮길 때 함께 옮긴다
- [ ] 링크로 이동하는 검사(`click` 다음 pathname 확인 등)의 기대값도 함께 교체

### 9. 검증

- [ ] `pnpm check` 통과 (타입)
- [ ] `pnpm test` 통과 (단위 · 472개 + `tests/unit/e2e-tags.test.ts` 도 여전히 파싱 가능)
- [ ] `pnpm test:e2e` 통과 (304개)
- [ ] `pnpm build` 통과 — `adapter-static strict: true` 가 링크 안 된 라우트를 잡는다. 홈이 네 기능을 모두 링크하므로 크롤러가 전부 찾는다
- [ ] `pnpm preview` 로 홈이 뜨고 각 기능이 열린다. 트레이싱에서 하단 탭이 안 뜬다

## 남기지 않을 것

- **중간 페이지 만들지 않기** (`/3x3/+page.svelte`, `/3x3/bld/+page.svelte` 등). 이름 공간이지 화면이 아니다 (AD-NAV-1)
- **`+layout.ts` 를 하위 폴더에 만들지 않기**. 프리렌더는 루트 하나로 켜져 있다 (SVELTE.md §0)
- **리다이렉트를 넣지 않기** (`/` → 홈은 지금 조회가 뜨는 것이 아니라 새 홈이 뜨는 것이라 리다이렉트가 아니다. 옛 `/anchors` 로 오는 요청은 nginx `try_files` 가 홈으로 떨어뜨림 — 결정 2)
- **`start_url` · `navigateFallback` 안 건드리기** (AD-NAV-3)
- **h1 / 판정 줄 / 진행 버튼 이름 안 건드리기** — 페이즈 2·3 의 일이다. 이 페이즈에서 손대면 롤백 단위가 흐려진다
