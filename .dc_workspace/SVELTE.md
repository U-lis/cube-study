# Svelte 5 / SvelteKit 2 사용 규약

이 저장소가 프레임워크의 어느 부분을 쓰고 어느 부분을 안 쓰는지, 그리고 왜 그런지.

**정본은 공식 문서다.** 이 문서는 공식 문서를 요약하지 않는다 — 공식 문서에 여러
선택지가 있을 때 **우리가 무엇을 골랐고 그 근거가 무엇인지** 만 적는다. 문법 설명이
필요하면 [svelte.dev/docs](https://svelte.dev/docs) 를 본다 (LLM 용 전문은
`https://svelte.dev/docs/svelte/llms.txt`, `https://svelte.dev/docs/kit/llms.txt`).

`.dc_workspace/CONVENTIONS.md` 와 축이 다르다. 저기는 **화면**이 어떻게 생겨야 하는가
(영역 순서, 단계, 판정 줄), 여기는 **어떤 API 로** 만드는가다.

작성 2026-08-26. 그때 설치돼 있던 버전:

| | |
|---|---|
| `svelte` | 5.56.8 |
| `@sveltejs/kit` | 2.70.2 |
| `@sveltejs/adapter-static` | 3.0.10 |
| `@vite-pwa/sveltekit` | 1.1.0 (Workbox) |
| `vite` · `vitest` | 8.2.0 · 4.1.10 |

버전은 `package.json` 과 `pnpm ls` 가 정본이다. 아래 "버전을 올릴 때" 참고.

---

## 0. 이 앱의 형태가 규약의 절반을 정한다

**서버가 없다.** `adapter-static` 으로 전부 프리렌더한 정적 파일을 nginx 가 그냥
내려준다 (`deploy/README.md`). 런타임 서버가 없다는 것이 이 저장소의 불변식이고,
프레임워크 기능의 절반이 여기서 잘려 나간다.

**쓸 수 없는 것** — 이유가 "안 좋아서" 가 아니라 **돌 데가 없어서**다.

| 기능 | 왜 |
|---|---|
| `+page.server.ts` · `+layout.server.ts` | 서버 `load` 는 요청 시점에 돈다. 요청을 받을 것이 없다 |
| `+server.ts` (API 라우트) | 〃 |
| form actions (`export const actions`) | POST 를 받을 서버가 없다. 문서도 "actions 가 있는 페이지는 프리렌더 불가" 라고 못 박는다 |
| remote functions (2.27+) | 서버 함수다 |
| `hooks.server.ts` · `handle` | 요청 훅이다. **i18n 의 `<html lang>` 을 이걸로 바꾸는 공식 레시피가 우리에게는 안 통한다** (#15 착수 시 주의) |
| `$env/static/private` · `$env/dynamic/*` | 비밀을 둘 서버가 없다 |
| 쿠키·세션·인증 | 〃 |

**써야 하는 것.**

- 루트 `src/routes/+layout.ts` 의 `export const prerender = true` 하나로 전부 프리렌더된다. 지금 그 파일에는 그 한 줄뿐이다.
- `adapter({ strict: true })` — 프리렌더에서 빠진 라우트가 있으면 **빌드가 깨진다.** 이것이 우리의 링크 검사다 (아래 2절).
- **`ssr = false` 를 켜지 않는다.** 켜면 프리렌더가 빈 껍데기를 저장한다. SSG 의 전제가 무너진다.
- **SPA fallback(`fallback: '200.html'`)을 쓰지 않는다.** 전부 프리렌더되므로 필요가 없고, 문서가 성능·SEO 손해를 명시한다.
- `csr = false` 도 안 쓴다. 화면이 전부 상호작용을 한다.

### 404 는 SvelteKit 이 아니라 nginx 가 답한다

`+error.svelte` 가 이 저장소에 없다. 있어도 안 돈다 — 정적 파일 서버 앞에서
SvelteKit 의 에러 페이지는 요청을 볼 기회가 없다.

```nginx
# deploy/nginx/cube.conf:56
try_files $uri $uri.html $uri/index.html /index.html;
```

마지막 `/index.html` 이 사실상의 폴백이다. **없는 주소는 404 가 아니라 첫 화면이
200 으로 뜬다.** 옛 북마크가 깨지지 않고 홈으로 떨어지는 것이 이것 덕이다
(navigation SPEC 결정 2). 진짜 404 화면이 필요해지면 nginx 쪽을 고칠 일이지
`+error.svelte` 를 놓을 일이 아니다.

### `trailingSlash` 는 기본값(`'never'`)이다

`/anchors` 는 `anchors.html` 로 빌드되고 nginx 의 `$uri.html` 이 그것을 찾는다.
서버가 그 규칙을 갖고 있으므로 `'always'` 로 바꿀 이유가 없다. **바꾸면 산출물이
`anchors/index.html` 로 바뀌므로 서버 설정과 함께 움직여야 한다.**

---

## 1. 설정 파일

**`svelte.config.js` 가 없다.** SvelteKit 설정을 `vite.config.ts` 의
`sveltekit({...})` 인자로 넘긴다. 이것은 편법이 아니라 **2.62.0 부터의 공식
지원**이다 (`@sveltejs/kit/vite` 문서: "you can pass configuration directly, in which
case `svelte.config.js` is ignored").

주의할 점 하나: 그 경우 `svelte.config.js` 는 **무시된다.** 나중에 누군가 관습대로
그 파일을 만들면 조용히 안 먹는다. 설정은 `vite.config.ts` 한 곳에 있다.

```ts
sveltekit({
  compilerOptions: {
    runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
  },
  adapter: adapter({ strict: true })
})
```

**`runes: true` 를 강제한다.** 우리 코드에서 레거시 문법이 조용히 되살아나는 것을
컴파일러가 막는다. `node_modules` 만 예외로 두는 이유는 남의 코드가 아직 레거시일 수
있기 때문이다.

---

## 2. 라우팅 — 파일 시스템이 정본이다

- **라우트 상수 파일을 두지 않는다.** `export const ROUTES = {...}` 같은 것을 만들면 정본이 둘이 되고, 폴더만 옮겼을 때 둘이 갈라진다. URL 의 정본은 `src/routes` 의 디렉터리 구조 하나다.
- 이동은 `<a href>` 다. 프레임워크 `<Link>` 컴포넌트가 없다.
- **`href` 는 리터럴로 적는다.** 오타의 안전망은 프리렌더 크롤러다 — 크롤러가 모든 `<a>` 를 따라가고, 없는 라우트를 가리키면 `strict: true` 가 빌드를 깬다. 즉 **깨진 내부 링크는 배포되지 않는다.**
- 타입으로 더 앞당기고 싶으면 `$app/paths` 의 `resolve()` 가 있다 (2.26+). `.svelte-kit/non-ambient.d.ts` 의 `RouteId` 유니온이 실제 폴더에서 생성되므로, 폴더를 옮기면 호출부가 타입 에러로 뜬다. **써도 되고 안 써도 된다** — 소스의 라우트 링크가 6곳뿐이라 어느 쪽이든 총량이 작다. 쓰기로 하면 화면 전체에서 일관되게 쓴다.
- **E2E 의 진입 주소는 언제나 리터럴이다.** `$app/paths` 는 가상 모듈이라 Playwright 에서 import 되지도 않지만, 더 중요한 이유는 따로 있다 — 검사가 앱과 같은 방식으로 URL 을 계산하면 URL 이 틀렸을 때 같이 틀린다.

### 라우트 축 — 새 화면을 어디 둘 것인가

**이 절이 경로 규칙의 정본이다.** 개별 작업 SPEC 은 여기를 가리키고 자기 화면의
경로만 적는다. 2026-08-26 에 정했다.

```
/{퍼즐}/{종목}/{방법}/{세트}/{기능}
```

**해당 축이 없는 화면은 그 칸을 건너뛴다.** 건너뛴 칸은 "아직 안 정했다" 가 아니라
**"이 화면에는 그 축이 없다"** 는 뜻이다.

| 화면 | 경로 |
|---|---|
| 홈 | `/` |
| 코너 3-style 조회·기준공식·퀴즈 | `/3x3/bld/3style/corner/{lookup,algs,quiz}` |
| 트레이싱 | `/3x3/bld/trace` — 방법·세트에 안 매인다 |
| 엣지 3-style (#16) | `/3x3/bld/3style/edge/{lookup,algs,quiz}` |
| M2 참조표 (#17) | `/3x3/bld/m2/edge/lookup` |
| 코너 OP (#18) | `/3x3/bld/op/corner/lookup` |
| 스티커 외우기 (#19) · 메모 훈련 (#21) | `/3x3/bld/letters` · `/3x3/bld/memo` |
| 멀티페이즈 타이머 (#23) | `/3x3/bld/timer` |
| CFOP (#20 이후) | `/3x3/speed/cfop/{f2l,oll,pll}/{lookup,algs,quiz}` |

규칙 다섯 가지.

1. **퍼즐이 맨 앞이다.** 3BLD 도 3x3 이다. 종목을 첫 칸에 두면 퍼즐과 종목이 한 칸에 섞인다.
2. **종목 칸(`bld` / `speed`)을 생략하지 않는다.** 한 칸 더 깊어지는 값으로 사는 것은 **묶음이 경로 접두사가 된다**는 성질이다. `/3x3/bld/*` 하나로 홈의 묶음도, 하단 탭의 형제도, "다른 묶음의 화면을 링크하지 않는다" 는 검사도 전부 기계적으로 나온다. 종목 칸을 빼면 그 묶음이 다시 손으로 적는 배열이 된다.
3. **기능 칸의 이름은 세트가 달라도 같은 것을 쓴다** — `lookup` · `algs` · `quiz`. 세트마다 다르면 탭과 규약 검사가 세트별 표를 들어야 한다. `algs` 를 고른 이유는 navigation SPEC 의 AD-NAV-8 에 있다.
4. **버퍼는 경로가 아니다.** UBL / UFR(#24)은 같은 화면이 데이터셋만 바꿔 끼우는 것이라 화면 안의 설정으로 고른다. 조각·방법과 달리 화면 구성이 하나도 안 바뀐다.
5. **축의 값은 소문자 영문 한 단어.** `3style` 은 하이픈 없이 쓴다 — 화면 문구의 "3-style" 과 달리 경로에서는 구분자를 아낀다.

#### 방법 칸을 새로 팔 것인가, 필터로 둘 것인가

경계는 하나다 — **알고리즘 집합이 다른가.**

| | 판정 |
|---|---|
| 2-look OLL(10) · 2-look PLL(6) | **필터.** full OLL 57 / PLL 21 의 부분집합이고 공식이 같다 |
| 중급의 "F2L 을 몇 가지로 끝내기" | **필터** — CFOP 의 F2L 케이스를 덜 외우는 것이라면 |
| 초보 층별(LBL)의 코너·엣지 삽입 | **다른 방법.** F2L 에 없는 수순을 쓴다 → `/3x3/speed/lbl/...` |

부분집합을 별도 경로로 만들면 **같은 케이스가 두 곳에 존재하고 암기 진도가 갈라진다.**
한쪽에서 체크한 공식이 다른 쪽에서 비어 있는 상태가 생기고, 그것을 화면에서 설명할
방법이 없다. 그래서 세트는 하나로 두고 **커리큘럼을 데이터의 태그로 넣어 거른다.**

이 저장소에 같은 모양이 이미 둘 있다 — 기준공식(anchor)은 378 케이스를 묶는 방식이지
별도 데이터가 아니고, "암기한 것만 출제" 는 같은 pool 을 거르는 필터다.

> 위 케이스 수(OLL 57 / PLL 21 / F2L 41, 2-look 10 / 6)는 리포에 근거가 없는 통용
> 지식이다. 해당 세트를 착수할 때 데이터로 확인할 것.

### `load` 는 universal 하나뿐

`+page.ts` / `+layout.ts` 만 쓴다 (`.server.ts` 는 위 0절에서 잘렸다). 프리렌더하는
페이지의 `load` 는 **빌드 타임에 한 번** 돈다.

- `load` 는 순수해야 한다. 전역 상태에 쓰지 말고 값을 **반환**한다.
- 프리렌더 중에는 `url.searchParams` 를 읽을 수 없다 (문서가 금지). 쿼리로 들어오는 값(`/?c=LB`)은 화면에서 `page.url` 로 읽는다.
- 동적 라우트(`[code]`)는 크롤러가 링크를 따라가며 발견한다. 링크 없이 존재하는 페이지가 생기면 `entries()` 로 알려야 한다. 지금은 기준 목록이 전부 링크하므로 필요 없다.

### 네비게이션 상태

`$app/state` 의 `page` 를 쓴다 (2.12+). `$app/stores` 는 레거시다. `$derived` 와 함께
써야 갱신된다 — `$:` 는 애초에 우리 코드에 없다.

**주의: 탭 활성 판정이 `page.url.pathname === item.href` 다** (`+layout.svelte:192`).
라우트가 깊어지면(`/3x3/bld/3style/corner/algs/GC`) 상세 화면에서 탭이 꺼진다. 경로를
옮길 때 함께 볼 자리다.

---

## 3. 상태 — 룬만 쓴다

공식 문서의 "Avoid legacy features" 목록을 그대로 따른다. **2026-08-26 기준 위반 0건**
이고, 그 상태를 유지한다.

| 쓰지 않는 것 | 대신 |
|---|---|
| `export let` · `$$props` · `$$restProps` | `$props()` |
| `$:` | `$derived` / `$effect` |
| `on:click` | `onclick` |
| `<slot>` · `$$slots` · `<svelte:fragment>` | `{#snippet}` · `{@render}` |
| `svelte/store` (`writable` 등) | `$state` 를 가진 클래스 |
| `<svelte:component>` · `<svelte:self>` | 직접 import |
| `{@const}` | `{const x = ...}` (5.56+) |
| `class:` 디렉티브 | `class={{ ... }}` / `class={[ ... ]}` (5.16+) |
| `use:` 액션 | `{@attach}` (5.29+) |

마지막 둘은 **아직 남아 있다.** `class:` 8곳, `{@const}` 3곳. 동작에 문제가 없으므로
일괄 치환하지 않는다 — 그 파일을 다음에 만질 때 함께 옮긴다. 새 코드에는 쓰지 않는다.

### `$state` / `$derived` / `$effect` 의 경계

- **파생값은 `$derived`.** `$effect` 로 상태를 동기화하지 않는다. 공식 문서가 이것을 가장 크게 경고한다.
- `$effect` 는 **외부 세계와 맞물릴 때만** 쓴다. 우리 용례는 셋뿐이다 — `localStorage` 저장, `document.documentElement.dataset` 조작, three.js 뷰어에 상태 전달.
- `$effect` 안을 `if (browser)` 로 감싸지 않는다. 효과는 서버에서 아예 안 돈다.
- 비동기로 읽은 값은 의존성으로 잡히지 않는다 (`await`·`setTimeout` 뒤). 뷰어처럼 늦게 준비되는 대상은 `view?.setX(...)` 꼴로 동기 접근을 유지한다 (`Cube3D.svelte`).

### 저장은 `$effect` 로 한다 — 정당한 예외다

`settings.svelte.ts` · `memorize.svelte.ts` · `tracing.svelte.ts` 가 같은 모양이다.

```ts
class Settings {
  mode = $state<Mode>(read(KEY_MODE, ...));
  constructor() {
    if (browser) {
      $effect.root(() => {
        $effect(() => localStorage.setItem(KEY_MODE, this.mode));
      });
    }
  }
}
```

- 이것은 "상태를 상태에 동기화" 가 아니라 **외부 시스템에 내보내기** 다. 문서가 말리는 쪽이 아니다.
- 컴포넌트 밖에서 효과를 만들려면 `$effect.root` 가 필요하다. 반환된 정리 함수를 안 부르므로 앱 수명 내내 산다 — 싱글턴이라 의도한 것이다.
- **읽기는 `browser` 가드가 필수다.** SSR(=프리렌더) 시점에는 `localStorage` 가 없다. 그래서 서버가 그리는 값은 언제나 **기본값**이고, 하이드레이션 직후에 저장된 값으로 바뀐다. 이 저장소가 두 번 밟은 하이드레이션 함정의 뿌리가 여기다 (5절).
- 키 이름과 스키마 버전은 기능별로 나눈다 (`ui.*`, `memorize.*`, `trace.*`). 롤백이 데이터 안전한 이유가 이것이다.

### 공유 상태를 모듈 싱글턴으로 두는 것

공식 권고는 **context** 다. 근거는 하나뿐이다 — 서버에서 모듈 전역을 건드리면 다음
요청의 사용자에게 샌다. **우리에게는 그 서버가 없다.** 요청을 처리하는 프로세스가
없으므로 누출 경로 자체가 없다.

그래서 `$lib/ui/*.svelte.ts` 싱글턴을 계속 쓴다. 대신 조건이 붙는다.

- **프리렌더(SSR) 중에 이 상태를 변경하지 않는다.** 빌드 타임에 값을 바꾸면 그 값이 HTML 에 굳어 모든 사용자에게 나간다.
- 초기값은 `browser` 가드를 통과한 뒤에만 저장소에서 읽는다.
- 언젠가 서버 렌더링이 필요해지면 이 결정을 통째로 다시 봐야 한다. 그 순간이 `createContext` 로 옮길 때다.

### `$props` · `$bindable`

- props 는 바뀔 수 있는 값으로 취급한다. props 에서 계산한 값은 `$derived` 로 둔다.
- props 를 **변경하지 않는다.** 양방향이 필요하면 `$bindable`, 아니면 콜백 prop.
- 타입은 `let { x }: Props = $props()` 로 붙인다.

---

## 4. 컴포넌트와 마크업

- 이벤트는 속성이다: `onclick={...}`, 축약 `{onclick}`, 스프레드 가능.
- `window`·`document` 리스너는 `<svelte:window>` / `<svelte:document>` 로 붙인다. `onMount` 로 `addEventListener` 하지 않는다.
- `{#each}` 는 **언제나 키를 준다.** 인덱스를 키로 쓰지 않는다 (`Alg.svelte` 만 예외 — 토큰 목록이 통째로 갈리므로 인덱스가 곧 정체성이다).
- CSS 는 컴포넌트 스코프가 기본. 부모가 자식 모양을 바꿔야 하면 **CSS 커스텀 프로퍼티**로 넘긴다. `:global` 은 마지막 수단이다.
- `{@html}` 을 쓰지 않는다. 알고리즘 렌더가 `Alg.svelte` 한 곳인 것과 같은 이유다.
- 페이지마다 `<svelte:head><title>` 이 있어야 한다. **접근성 요구다** — 클라이언트 이동에는 페이지 리로드가 없어서 SvelteKit 이 `<title>` 을 라이브 리전에 읽어준다. 지금 다섯 화면 모두 있고, 문구 형식만 `/trace` 가 다르다 (navigation SPEC FR-NAV-9 에서 정리).

### `onMount` 대신 `{@attach}` 를 먼저 본다

DOM 요소에 외부 라이브러리를 물리는 일은 이제 attachment 가 정식 자리다. 지금
`onMount` 를 쓰는 곳이 셋(`Cube3D.svelte`, `anchors/+page.svelte`,
`trace/+page.svelte`)이고, **`Cube3D` 가 가장 뚜렷한 후보다** — 요소 하나에 three.js
뷰어를 붙였다 떼는 일 그 자체다. 급하지 않으니 그 파일을 만질 때 옮긴다.

---

## 5. SSR 과 하이드레이션 — 이 저장소가 두 번 밟은 곳

프리렌더가 그린 HTML 과 브라우저가 하이드레이션한 결과가 **같은 요소 구성**이어야
한다. 어긋나면 레이아웃이 밀리거나 요소가 사라졌다 나타난다.

- **`{#if}` 로 화면 요소를 넣었다 뺐다 하지 않는다.** 접는 것은 CSS 로 한다.
- 예외는 하나다: 표시 여부가 `localStorage` 나 브라우저 API 에서 오는 자리. 이때는 자리를 예약하거나, 아예 서버 기본값과 같은 모양으로 그린다.
- 판단 기준: **서버가 그 값을 알 수 있는가.** `stage` 처럼 언제나 같은 값에서 시작하는 것은 접어도 되고, 저장소에서 오는 것은 예약해야 한다.

이 규칙의 근거와 사례는 `CONVENTIONS.md` (예정) 와 각 화면의 주석에 있다. 여기서는
"프레임워크 쪽 원인" 만 적어 둔다 — Svelte 의 하이드레이션은 서버가 그린 DOM 을
**재사용**하지, 다시 그리지 않는다.

---

## 6. PWA · 서비스워커

SvelteKit 은 `src/service-worker.ts` 를 두면 자동 등록하는 자체 경로를 갖고 있다.
**우리는 그것을 안 쓰고 `@vite-pwa/sveltekit`(Workbox)을 쓴다.** 공식 문서가 인정하는
대안이다("many PWA applications leverage Workbox … you may prefer Vite PWA plugin").

그 선택에 따라오는 것들:

- 프리캐시 목록은 `workbox.globPatterns` 가 만든다. **`json` 을 빠뜨리면 오프라인에서 데이터가 통째로 죽는다** (NFR-8).
- `$service-worker` 모듈(`build`·`files`·`version`)은 쓰지 않는다. 그건 SvelteKit 자체 경로의 API 다.
- manifest 링크는 `+layout.svelte` 가 직접 건다. SvelteKit 이 `app.html` 을 제어해서 플러그인이 주입하지 못한다.
- `registerType: 'autoUpdate'`.
- **PWA 확인은 프로덕션 빌드에서만 된다.** dev 서버에는 서비스워커를 등록하지 않는다 (SW 캐시가 HMR 을 가린다).

---

## 7. 테스트

공식 문서의 권고와 우리 구조가 이미 같다 — **"컴포넌트를 테스트할지, 컴포넌트
안의 로직을 테스트할지 먼저 생각하라. 후자면 로직을 빼서 테스트하라."**

- 단위 테스트(Vitest)는 `environment: 'node'` 이고 `tests/unit/**` 만 본다. 컴포넌트를 마운트하는 테스트가 하나도 없다 — 도메인·엔진이 순수 함수로 빠져 있기 때문이다. jsdom 도 `@testing-library/svelte` 도 필요 없다.
- 룬을 쓰는 코드를 단위 테스트해야 하면 파일 이름에 `.svelte` 를 넣어야 한다(`*.svelte.test.ts`). 효과를 테스트하려면 `$effect.root` 로 감싸고 `flushSync()` 를 부른다. **아직 그런 테스트가 없다.** 필요해지는 날 이 문단이 출발점이다.
- 화면은 E2E(Playwright)가 본다. 빌드한 뒤 preview 서버에 붙는다.
- 정적 검사(소스를 읽어 정규식으로 확인하는 단위 테스트)를 쓴다. 규약을 문서 대신 검사로 못 박는 자리다.

---

## 8. 접근성 · i18n 에서 미리 알아둘 것

- 라우트 이동 시 SvelteKit 이 `<body>` 에 포커스를 준다. `autofocus` 가 있으면 그쪽으로 간다.
- `<html lang="ko">` 가 `app.html` 에 하드코딩돼 있다. 공식 다국어 레시피는 `handle` 훅으로 `%lang%` 를 치환하는 것인데 **우리에게는 서버 훅이 없다.** #15 를 착수하면 여기서 방법이 갈린다 — 언어를 경로로 올리든지(`/en/...`, 프리렌더 대상이 두 배), 클라이언트에서 `document.documentElement.lang` 을 고치든지(첫 렌더가 잠깐 틀린다). 결정 전에 이 문단을 읽을 것.
- 색만으로 정보를 전달하지 않는 규칙은 화면 규약(`CONVENTIONS.md`) 쪽이다.

---

## 9. 지금 안 쓰지만 후보인 것

| 기능 | 언제 |
|---|---|
| `{@attach}` | `onMount` 를 쓰는 세 곳을 만질 때 |
| `resolve()` (`$app/paths`) | 라우트를 옮기는 김에 링크 6곳을 타입으로 묶고 싶을 때 |
| Snapshot (`export const snapshot`) | 화면을 떠났다 돌아왔을 때 입력칸을 복원하고 싶어지면. `sessionStorage` 를 SvelteKit 이 관리한다 |
| Shallow routing (`pushState`) | 뒤로가기로 닫는 모달이 필요해지면. **`backguard.svelte.ts` 와 정면으로 부딪힌다** — 설치된 앱에서 뒤로가기를 "닫기" 하나로 고정해 뒀다. 둘 중 하나를 포기해야 한다 |
| `@sveltejs/enhanced-img` | 사진을 쓰게 되면. 지금 이미지는 아이콘 몇 개뿐이라 이득이 없다 |
| `createContext` | 서버 렌더링이 필요해지는 날 (3절) |

**영영 안 쓰는 것**: 서버 `load`·form actions·`+server.ts`·remote functions·서버
훅·비공개 환경변수. 서버가 생기지 않는 한 그렇다.

---

## 10. 버전을 올릴 때

- Svelte 6 이 오면 **속성값 인용 부호의 뜻이 바뀐다.** `disabled="{x !== 42}"` 가 문자열로 강제 변환된다. 지금은 경고 없이 동작하는 코드다.
- `class` 의 falsy 처리도 6에서 바뀐다 (`class={false}` 가 속성 생략으로).
- SvelteKit 은 `svelte.config.js` 를 안 쓰는 구성이므로(1절), 마이그레이션 가이드가 그 파일을 고치라고 하면 `vite.config.ts` 로 읽어야 한다.
- 올린 뒤 확인은 `pnpm check` → `pnpm test` → `pnpm test:e2e` → `pnpm preview` 로 PWA. 마지막 하나는 자동 검사가 없다.
