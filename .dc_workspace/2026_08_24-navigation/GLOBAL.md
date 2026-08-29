<!-- dotclaude-config
working_directory: .dc_workspace
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-tracing
doc_dir: 2026_08_24-navigation
-->

# 페이지 구성과 화면 흐름 - 아키텍처 및 전역 설계

SPEC.md 의 FR-NAV-1~23 / NFR-NAV-1~5 / AD-NAV-1~10 을 구현하기 위한 전역 결정과 페이즈 분해.

**목표 버전**: 0.5.0 (마지막 스펙)
**대상 이슈**: #27 (진입점과 화면 흐름 재설계)

---

## 1. 기능 개요

두 가지를 한다.

1. **진입점을 나눈다.** 홈을 따로 두고, 기능 화면끼리는 서로를 보여주지 않는다.
2. **기능 화면의 구성·흐름을 통일한다.** 지금은 화면마다 `<h1>` 의 뜻도, 설정의 자리도, 진행 버튼의 이름도 다르다.

**두 가지의 산출물은 다섯 페이즈에 나뉜다.** 라우트를 옮기는 것이 먼저이고 (Phase 1), 그 위에서 화면 구성·흐름을 정리한 뒤 (Phase 2·3), 규약을 자동 검사로 못 박고 (Phase 4), 마지막에 정본 문서로 옮긴다 (Phase 5).

기존 기능(조회·기준공식·퀴즈·트레이싱)의 **동작은 유지된다.** 이번 작업은 자리와 규약을 정리하는 것이지 새 기능을 넣는 것이 아니다. 트레이싱은 이미 새 규약을 지키고 있어 대부분 손대지 않는다.

---

## 2. 아키텍처 결정

이 절은 SPEC 의 AD-NAV-1~10 을 **구현 관점에서** 다시 적는다. 왜 그렇게 결정했는가는 SPEC 에 있으므로 되풀이하지 않는다. 여기는 "그 결정을 코드에 어떻게 내리는가" 다.

### AD-NAV-A. 라우트가 정본이다. 카테고리 배열을 두지 않는다 (FR-NAV-23)

`+layout.svelte:63-68` 의 `const nav = [...]` 를 없앤다. 대신 두 자리에서 URL 을 읽어 결정한다.

- **묶음** (홈의 구분선): 종목 칸까지 같은 경로가 한 묶음. 지금은 `/3x3/bld/*` 하나 (3BLD)
- **형제** (하단 탭): 기능 칸만 다른 실재 화면들

이 둘은 **경로 접두사 분석** 하나로 나온다. 소속을 경로에서 읽으면 맞출 곳이 하나다.

구현: `src/lib/ui/nav.ts` 에 다음 두 함수를 둔다.

```ts
export function tabsFor(pathname: string): NavTab[]
export function isHome(pathname: string): boolean
```

`tabsFor` 는 route id 에서 동적 칸을 걷어낸 경로로 형제를 계산해 라벨 배열을 낸다. 형제가 하나(자기 자신)뿐이면 빈 배열을 낸다 — 그때 `+layout.svelte` 가 `<nav>` 를 그리지 않는다 (FR-NAV-5).

**작은 매핑 하나는 둔다.** 기능 코드 → 한국어 라벨:

```ts
const FEATURE_LABELS = { lookup: '조회', algs: '기준공식', quiz: '퀴즈', trace: '트레이싱' }
```

이것은 카테고리 배열이 아니다 — 순서·소속을 정하지 않고, 화면 이름 한 글자를 담을 뿐이다. 이슈 #15(i18n) 가 오면 이 자리가 번역표의 자리가 된다.

### AD-NAV-B. 상세 화면은 동적 칸을 걷어낸 경로로 탭을 계산한다 (FR-NAV-4)

`/3x3/bld/3style/corner/algs/[code]` 는 SvelteKit 의 `page.route.id` 로 `/3x3/bld/3style/corner/algs/[code]` 를 준다. `[…]` 세그먼트를 걷어내면 `/3x3/bld/3style/corner/algs` 이고, 그 부모의 형제 셋을 물려받는다.

이 규칙 하나가 결정 4(상세에서 퀴즈로 가는 길이 유지)를 코드로 옮긴다. 상세마다 예외 분기가 없다.

### AD-NAV-C. 홈은 라우트를 갖는다. 카테고리는 갖지 않는다 (FR-NAV-1, AD-NAV-1)

`/` 는 `src/routes/+page.svelte` 로 남되 **홈** 이 된다. 지금 있는 조회 화면은 `/3x3/bld/3style/corner/lookup/+page.svelte` 로 옮긴다.

`/3x3`, `/3x3/bld` 같은 중간 페이지를 만들지 않는다 — 홈에서 기능으로 바로 간다. 중간 경로는 이름 공간이지 화면이 아니다.

### AD-NAV-D. 화면은 자리가 고정된 영역의 세로 나열이다 (FR-NAV-8)

트레이싱 화면(`src/routes/trace/+page.svelte:607-891`)이 그 본이다. 다른 화면은 이것을 따라가되, 없는 영역은 건너뛴다.

| # | 영역 | 조회 | 기준공식 | 퀴즈 | 트레이싱 |
|---|---|---|---|---|---|
| 1 | 되돌아가기 (UpLink) | 홈 (from 있으면 기준으로) | 목록은 홈 · 상세는 목록 | 홈 | 홈 |
| 2 | `<h1>` 화면 이름 | 조회 | 기준공식 · `{code}` | 퀴즈 | 트레이싱 |
| 3 | 주 표시 (본문) | 결과 카드 | 목록 | 문제 표시 | 큐브 |
| 7 | 설정 | 없음 | 상세: 두 토글 | 입력 방식 · 암기한 것만 | 훈련 대상 · 모드 |
| 12 | 진행 버튼 | 없음 | 없음 | 제출 · 다음 문제 | 시작 · 채점 · 다음 문제 |

**설정은 언제나 7번 자리** (본문 위). **진행 버튼은 언제나 12번 자리** (본문 아래). 트레이싱은 이미 이 자리에 있고 (SPEC 의 표 12번), 지금 8번 자리(입력칸과 자판 사이)에 있는 것을 페이즈 3 이 12번으로 내린다.

### AD-NAV-E. 접기는 CSS, 잠금은 `disabled`. 둘은 따로 한다 (FR-NAV-11, 18)

- `{#if}` 로 화면 요소를 넣었다 뺐다 하지 않는다 — SSR/CSR 요소 개수가 갈린다 (NFR-NAV-1)
- 접기는 CSS `display: none` — 화면에서만 사라지고 DOM 에 남는다
- 잠그기는 `disabled` — 값을 지킨다. 확대·리더 모드에서 접기가 안 먹을 수 있고 그때 값을 지키는 것이 `disabled`

**잠그는 기준은 "측정하는가" 다.** 기록에 남는 판(트레이싱)만 잠근다. 퀴즈는 잠그지 않고 지금 동작을 유지한다 — 지금은 입력 방식을 바꾸면 문제는 유지한 채 입력만 비운다 (`quiz/+page.svelte:112-116`). 이것이 이미 맞는 동작이라 페이즈 3 이 손대지 않는다.

### AD-NAV-F. 판정 줄과 진행 버튼의 규약은 트레이싱과 같은 값을 쓴다 (FR-NAV-12, 13)

두 화면이 같은 것을 다르게 그리면 사용자가 판정을 두 번 배운다. 트레이싱 화면이 정본이다.

- **판정 줄**: `data-verdict` + `data-kind` + `data-result`(`ok`/`bad`/빈 문자열)
- **진행 버튼**: `data-{동작}` (`data-start` · `data-grade` · `data-next` · `data-memorized`)
- **자판 안 편집 버튼**: `data-action="…"` (`undo`·`clear`·`back`·`separator`) — 이것은 손대지 않는다

퀴즈의 `data-action="submit"` 을 `data-grade` 로, `data-action="next"` 를 `data-next` 로 옮긴다.

### AD-NAV-G. `data-stage` 로 단계를 낸다 (FR-NAV-14)

퀴즈는 단계가 셋이다 — `active` · `input` · `result`. **`idle` 은 만들지 않는다** (SPEC AD-NAV-5).

트레이싱은 이미 `data-stage` 를 낸다 (`trace/+page.svelte:609`). 퀴즈도 같은 이름의 속성을 낸다. 검사와 CSS 가 같은 신호를 본다.

### AD-NAV-H. 쿼리 파라미터와 서비스워커 설정은 그대로 둔다

- `/` → `/3x3/bld/3style/corner/lookup` 이동만 하고 **쿼리 규약(`?c=` · `?from=`)은 그대로다**. 조회 화면이 케이스 코드를 쿼리로 받는 것은 화면의 성질이지 경로의 성질이 아니다
- `vite.config.ts` 의 `start_url: '/'`, `navigateFallback: '/'` 는 **둘 다 그대로** (AD-NAV-3). 설치된 앱을 열면 홈이 뜬다
- `deploy/nginx/cube.conf` 의 `try_files … /index.html` 도 그대로 — 없는 주소는 홈으로 떨어진다 (결정 2)

### AD-NAV-I. 라우트 이름 공간을 만들되 라우트를 갖지 않는다 (FR-NAV-21, AD-NAV-6)

폴더는 판다:

```
src/routes/3x3/bld/3style/corner/lookup/+page.svelte
src/routes/3x3/bld/3style/corner/algs/+page.svelte
src/routes/3x3/bld/3style/corner/algs/[code]/+page.svelte
src/routes/3x3/bld/3style/corner/quiz/+page.svelte
src/routes/3x3/bld/trace/+page.svelte
```

**중간 경로에 `+page.svelte` 를 두지 않는다.** `/3x3`, `/3x3/bld` 같은 페이지가 생기면 이름 공간이 화면으로 승격되어 홈이 이미 낸 정보를 되풀이하게 된다.

**`+layout.ts` 는 루트 하나만** (`prerender = true`). 하위 폴더에 만들지 않는다 — 프리렌더는 이미 전부 켜져 있고 (SVELTE.md §0), 중간 layout 파일을 만들 이유가 없다.

### AD-NAV-J. `nav` 라벨 판정을 경로 정확 일치에서 접두사 일치로 바꾼다

`+layout.svelte:192` 는 지금 `page.url.pathname === item.href` 로 활성 탭을 판정한다. 상세 화면 `/3x3/bld/3style/corner/algs/[code]` 에서 이 조건은 부모(`.../algs`)의 탭을 켜지 않는다.

**활성 판정은 "이 탭의 기능 칸이 pathname 의 마지막 칸이거나 그 상위 경로 어딘가에 있는가" 로 바꾼다** — 즉 `pathname` 의 세그먼트 배열에서 그 탭의 기능 칸(`algs`)이 있는지 본다. 상세에서 목록 탭이 켜지고, 목록에서도 켜진다.

이 판정은 `tabsFor` 함수가 낸 결과 안에 함께 담아 낸다 — `{ feature, label, active }` 꼴로.

---

## 3. 전역 제약

### 3.1 라우트

| 지금 | 새 경로 | 옮기는 파일 |
|---|---|---|
| `/` (조회) | `/3x3/bld/3style/corner/lookup` | `+page.svelte` 내용 이동 |
| `/anchors` | `/3x3/bld/3style/corner/algs` | `anchors/+page.svelte`, `anchors/+page.ts` |
| `/anchors/[code]` | `/3x3/bld/3style/corner/algs/[code]` | `anchors/[code]/+page.svelte`, `anchors/[code]/+page.ts` |
| `/quiz` | `/3x3/bld/3style/corner/quiz` | `quiz/+page.svelte` |
| `/trace` | `/3x3/bld/trace` | `trace/+page.svelte` |

`/` 는 **홈**이 되고 새 파일을 쓴다.

### 3.2 URL 축의 정본은 `SVELTE.md`

라우트 축 규칙 다섯 가지, 방법 칸을 새로 팔지 필터로 둘지의 경계, 백로그 항목별 경로는 전부 `.dc_workspace/SVELTE.md` 의 "라우트 축" 절이다. 이 작업의 SPEC 과 GLOBAL 은 그 절을 가리키고 자기 화면 넷의 경로만 적는다 (SPEC FR-NAV-21).

### 3.3 프리렌더 · SSR/CSR 불변식 (NFR-NAV-1, 2)

- 모든 라우트가 프리렌더된다. `adapter-static` 의 `strict: true` 가 링크 안 된 라우트를 잡는다. 홈이 네 기능을 모두 링크하므로 크롤러가 전부 찾는다
- SSR 과 CSR 의 요소 구성·개수·크기가 같다 — 두 번 밟은 함정이다 (`SVELTE.md §5`)
- 하단 탭이 라우트마다 다른 것은 문제가 아니다 — 각 라우트가 자기 탭을 SSR 하고 같은 것으로 하이드레이션한다. 갈리는 것은 라우트 사이이지 한 라우트의 두 시점이 아니다

### 3.4 E2E 규약

- **테스트 제목에 템플릿 리터럴 금지** — `tests/unit/e2e-tags.test.ts` 파서가 문자열 리터럴만 읽는다. 새 검사 파일(`conventions.spec.ts`)도 이 규칙을 지킨다
- **뷰포트 신호를 쓰는 테스트에는 `@viewport` 태그** — 파서가 검사한다. 새 검사가 `boundingBox` 등을 쓰면 태그 필수
- **`goto` URL 은 리터럴로 적는다** — 앱과 같은 방식으로 URL 을 계산하면 URL 이 틀렸을 때 같이 틀린다 (SVELTE.md §2)

### 3.5 데이터

- `[data-anchor]` · `anchorNames` 등 선택자·변수 이름은 안 바꾼다. 화면이 다루는 개념은 여전히 기준이다 (SPEC "이관 비용")
- 데이터의 `setup.anchor` 필드와 앱 어휘(기준·역공식·기준 케이스)는 안 건드린다 (AD-NAV-8). 데이터를 건드리면 스키마 버전이 올라가고, `memorize.ts` 의 `parseStored` 가 저장을 통째로 버려 진도가 날아간다
- `.claude/CLAUDE.md` 를 새로 만들지 않는다. 그 폴더는 `.gitignore` 에 걸려 있어 커밋되지 않는다. 저장소 루트 `CLAUDE.md` 가 정답이다 (FR-NAV-16)

### 3.6 배포

프리캐시 목록이 바뀐다. 라우트가 하나 늘고 네 개가 옮겨가므로 `sw.js` 의 프리캐시 항목이 달라진다. 배포 후 `deploy.sh` 의 프리캐시 전수 대조가 확인한다. 배포 자체는 이 페이즈의 범위가 아니다 — 이 작업이 끝나고 사용자가 배포한다.

---

## 4. 페이즈 분해

### 4.1 개요

| Phase | 범위 | 담당 FR | 병렬 |
|---|---|---|---|
| **1** | 라우트 이동 — 네 화면을 축 위로, 홈 신설, `nav` 를 경로에서 읽게. E2E 경로 정리 | FR-NAV-1~7, 21~23; NFR-NAV-2 | 불가 (라우트가 흔들린다) |
| **2** | 화면 공통 구성 — `<h1>` 통일, 설정 자리 통일, `UpLink` 배치 | FR-NAV-7~10; NFR-NAV-1 | 순차 |
| **3** | 규약 통일 — 판정 줄 · 진행 버튼 이름·자리 · `data-stage` · 접기 | FR-NAV-11~14, 18~20 | 순차 |
| **4** | 규약 검사 — `tests/e2e/conventions.spec.ts` 신설 | FR-NAV-17 | 순차 (2·3 이 끝나야 검사할 대상이 선다) |
| **5** | 문서화 — `.dc_workspace/CONVENTIONS.md` · 루트 `CLAUDE.md` · `README.md:111` · `CHANGELOG.md ## [0.5.0]` | FR-NAV-15, 16 | 순차 |

**총 5 페이즈. 병렬 없음.**

**한 사람이 순차로 간다** (사용자 지시). 라우트가 흔들리는 페이즈 1 뒤에는 저장소가 두 상태(옛 라우트 · 새 라우트)를 동시에 갖지 않는다. 페이즈 2·3 은 화면 단위로 쪼갤 수 있지만 이번에는 나누지 않는다.

### 4.2 페이즈 1 이 끝나는 순간의 상태

**배포·미리보기로 만져볼 수 있어야 한다** (사용자 지시).

- `pnpm check` · `pnpm test` · `pnpm test:e2e` 전부 통과
- `pnpm build` · `pnpm preview` 로 새 경로가 뜬다
- 홈이 네 기능을 링크한다
- 하단 탭이 형제만 담고, 트레이싱에서는 안 뜬다
- `<h1>` 통일과 판정 줄 통일은 아직 안 됐다 (페이즈 2·3 이 한다) — 지금 화면 각자의 문구·규약은 유지된다

### 4.3 의존 관계

**파일 수준.**

| Phase | 신규 | 수정 | 이동 |
|---|---|---|---|
| 1 | `src/routes/+page.svelte` (새 홈), `src/lib/ui/nav.ts` | `src/routes/+layout.svelte`, `src/lib/ui/CaseView.svelte`, E2E 파일 18개 | `src/routes/{+page,anchors/*,quiz/*,trace/*}` → `src/routes/3x3/bld/...` |
| 2 | — | 옮긴 화면 4곳 (조회·목록·상세·퀴즈), `tests/e2e/pwa.spec.ts` | — |
| 3 | — | 퀴즈 · (필요 시) 기준 상세 | — |
| 4 | `tests/e2e/conventions.spec.ts` | (검사 실패로 드러나면) 그 자리를 고친다 | — |
| 5 | `.dc_workspace/CONVENTIONS.md`, `CLAUDE.md` | `README.md`, `CHANGELOG.md` | — |

**모듈 수준.**

- Phase 1 이 만드는 `src/lib/ui/nav.ts` 를 Phase 2·3 이 그대로 쓴다. import 방향이 한쪽이다
- Phase 4 의 검사는 Phase 2·3 이 세운 규약을 본다 — 검사와 규약이 같은 신호(`data-stage`, `data-verdict` 등)를 본다
- Phase 5 는 앞 넷의 결과를 문서로 옮긴다. 코드 의존이 없다

**테스트 수준.**

- Phase 1 이 E2E 의 `goto` URL 을 옮긴다. Phase 2·3 이 셀렉터를 바꿔야 하는 곳(퀴즈 `<h1>`, 진행 버튼 이름)이 있다
- Phase 4 가 신설 검사를 넣는다. 이때 페이즈 2·3 이 세운 규약이 실제로 성립하는지 그 자리에서 드러난다

### 4.4 커밋 전략

각 페이즈가 하나의 커밋 세트를 낸다. 페이즈 간 커밋이 섞이면 페이즈 하나만 되돌리기가 어려워진다. 각 페이즈 안에서 논리 단위로 여러 커밋을 쓴다.

- Phase 1: (a) 폴더 이동 (`git mv`, 순수 이동), (b) 새 홈 신설과 `nav` 계산 바꾸기, (c) 내부 링크와 E2E 정리
- Phase 2~5: 각자 한 커밋으로도 충분한 분량

---

## 5. 파일 목록

### 신규 생성

| 파일 | 역할 | Phase |
|---|---|---|
| `src/routes/+page.svelte` | 홈. 기능 넷을 카테고리(3BLD) 아래 나열 | 1 |
| `src/lib/ui/nav.ts` | 경로 접두사에서 형제·활성 탭을 계산하는 순수 함수 | 1 |
| `tests/e2e/conventions.spec.ts` | 규약 자동 검사 | 4 |
| `.dc_workspace/CONVENTIONS.md` | 화면 규약의 정본 | 5 |
| `CLAUDE.md` | 저장소 규칙 요약과 문서 지도 | 5 |

### 이동 (내용 최소 수정)

| 지금 | 이동 후 | Phase |
|---|---|---|
| `src/routes/+page.svelte` (조회) | `src/routes/3x3/bld/3style/corner/lookup/+page.svelte` | 1 |
| `src/routes/anchors/+page.svelte` | `src/routes/3x3/bld/3style/corner/algs/+page.svelte` | 1 |
| `src/routes/anchors/+page.ts` | `src/routes/3x3/bld/3style/corner/algs/+page.ts` | 1 |
| `src/routes/anchors/[code]/+page.svelte` | `src/routes/3x3/bld/3style/corner/algs/[code]/+page.svelte` | 1 |
| `src/routes/anchors/[code]/+page.ts` | `src/routes/3x3/bld/3style/corner/algs/[code]/+page.ts` | 1 |
| `src/routes/quiz/+page.svelte` | `src/routes/3x3/bld/3style/corner/quiz/+page.svelte` | 1 |
| `src/routes/trace/+page.svelte` | `src/routes/3x3/bld/trace/+page.svelte` | 1 |

### 수정

| 파일 | 변경 | Phase |
|---|---|---|
| `src/routes/+layout.svelte` | `nav` 배열 제거, `tabsFor(pathname)` 로 교체, 홈일 때 `<nav>` 안 그림 | 1 |
| `src/lib/ui/CaseView.svelte` | `href="/?c=..."` 접두사 교체 (역케이스 링크) | 1 |
| 옮긴 조회 화면 | 케이스 링크 접두사 · UpLink href 교체 · `<h1>조회</h1>` 신설 | 1 (경로) / 2 (h1) |
| 옮긴 기준 상세 | `UpLink href="/anchors"` → 새 경로, 케이스 링크 접두사 교체 | 1 |
| 옮긴 기준 목록 | `href="/anchors/{r.name}"` 접두사 교체 | 1 |
| 옮긴 퀴즈 | `<a href="/?c=...">` 접두사 교체 · `<h1 data-case>` → 본문으로 내리고 `<h1>퀴즈</h1>` · `data-action="submit"` → `data-grade` · `data-action="next"` → `data-next` · `data-stage` 신설 | 1 (링크) / 2 (h1) / 3 (버튼·stage) |
| 옮긴 트레이싱 | (경로 이동만. 이미 규약을 지키고 있어 손댈 곳이 거의 없다) | 1 |
| `tests/e2e/*.spec.ts` (18개 중 관련) | `goto` URL 교체. `pwa.spec.ts:129,131` 은 셀렉터도 함께 (페이즈 2·3) | 1 / 2 / 3 |
| `README.md:111` | `.dc_workspace/CONVENTIONS.md` 링크 추가 | 5 |
| `CHANGELOG.md` | `## [0.5.0]` 항목 신설 | 5 |

### 변경하지 않는다

| 파일 | 이유 |
|---|---|
| `vite.config.ts` | `start_url: '/'` · `navigateFallback: '/'` 그대로 (AD-NAV-3) |
| `deploy/nginx/cube.conf` | `try_files` 규칙 그대로. 옛 북마크가 홈으로 떨어지는 것이 이 규칙 덕이다 |
| `src/lib/domain/*`, `src/lib/cube/*`, `src/lib/data/*` | 도메인·엔진·데이터. 화면 경로 변경과 무관 |
| `src/routes/+layout.ts` | `prerender = true` 한 줄. 그대로 |
| `src/routes/trace/+page.svelte` 의 화면 규약 코드 | 이미 정본이다. 옮기기만 하고 내용은 안 건드림 |
| 기존 화면들의 `<h1>` 이 있는 `<svelte:head><title>` | 그대로 유지 (제목과 h1 은 다른 축). 페이즈 2 가 h1 만 손댐 |
| `src/lib/domain/memorize.ts` 의 스키마 | 데이터 위치나 키를 안 건드림 |

---

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| E2E 131 곳의 `goto` URL 을 놓쳐 검사가 조용히 홈으로 떨어짐 | 페이즈 1 완료 조건에 `pnpm test:e2e` 통과를 넣는다. `nginx try_files` 가 없는 주소를 홈으로 보내므로 실패가 "다른 화면" 형태로 나타난다 — 이 특성을 T1-2 가 이용한다 |
| `pwa.spec.ts:129` 의 `h1[data-case]` 셀렉터가 놓쳐 페이즈 2 이후 실패 | 페이즈 2 체크리스트에 명시. 셀렉터 변경과 h1 변경이 같은 커밋에 들어간다 |
| 폴더 이동만 하고 링크를 안 옮겨 홈이 옛 경로를 가리켜 `strict: true` 로 빌드 깨짐 | 페이즈 1 완료 조건에 `pnpm build` 통과를 넣는다. `adapter-static` 검사가 이것을 잡는다 — 그것이 이 검사의 존재 이유다 (SVELTE.md §0) |
| 데이터 스키마를 손대 진도가 날아감 | `memorize.ts` · `tracing.ts` · 데이터 파일을 이 작업에서 손대지 않는다. 페이즈 계획에 "수정 안 함" 표로 못 박음 |
| 하단 탭이 `localStorage` 를 읽어 SSR/CSR 이 어긋남 | `tabsFor` 는 pathname 만 받는 순수 함수. `localStorage` 를 안 읽음 (NFR-NAV-1) |
| 진행 버튼 이름이 갈린 채 남아 규약 검사가 두 이름을 다 허용해야 함 | 페이즈 3 가 `data-action="submit"`·`"next"` 를 전부 옮긴다. 페이즈 4 검사는 부재만 확인 (`toHaveCount(0)`) |
| 잠금 규칙을 퀴즈에 잘못 도입 | 페이즈 3 계획에 "퀴즈는 잠그지 않는다 — 지금 동작을 유지한다" 를 명시. 사용자 지시 |
| 페이즈 5 가 규약 문서를 정본으로 박은 뒤 실제 구현이 못 따라가는 것이 드러남 | 4 를 5 보다 먼저 둔다. 검사가 통과한 규약만 정본이 된다 (SPEC "4 를 5 보다 먼저 둔 이유") |
| `.dc_workspace/CONVENTIONS.md` 를 새로 쓰다가 흩어져 있는 규약을 놓침 | SPEC 부록의 목차를 그대로 씀. 옮겨오는 것이지 새로 쓰는 것이 아니다 (FR-NAV-15) |
| `CLAUDE.md` 를 사용자 홈의 `~/.claude/CLAUDE.md` 와 착각 | 저장소 루트에 둔다. `.claude/CLAUDE.md` 는 `.gitignore` 에 걸려 있어 만들지 않음 (FR-NAV-16) |
