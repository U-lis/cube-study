# Phase 4 — 마감 (PWA · 테마 · 반응형 · E2E)

**담당**: FR-20 ~ FR-22, NFR-2, NFR-3, NFR-8
**완료 기준**: 오프라인에서 전 기능이 동작하고 홈 화면 설치가 가능하다.

## 4-1. PWA (FR-20, NFR-8)

`vite.config.ts`에 `SvelteKitPWA` 추가.

```ts
SvelteKitPWA({
  registerType: 'autoUpdate',
  manifest: {
    name: '3-Style Corner Trainer',
    short_name: '3style',
    lang: 'ko',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [ /* 192, 512, maskable */ ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,json,svg,png,woff2}'],
    navigateFallback: '/'
  }
})
```

- **데이터 JSON이 프리캐시에 포함되는지 반드시 확인한다.** `globPatterns`에 `json`이 없으면 오프라인에서 조회가 통째로 죽는다
- 아이콘은 큐브 스티커를 연상시키는 단순 도형으로 SVG 작성 후 PNG 192/512 생성. 외부 에셋을 받지 않는다
- 런타임 네트워크 요청 0건이어야 한다 (E2E에서 검증)

## 4-2. 테마 (FR-21)

`src/lib/styles/app.css` — CSS 변수로 토큰 정의.

```css
:root { --bg; --fg; --muted; --accent-insert; --accent-interchange; --danger; --mono; }
@media (prefers-color-scheme: dark) { :root { ... } }
:root[data-theme="light"] { ... }
:root[data-theme="dark"] { ... }
```

- 시스템 설정을 기본으로 따르고, 수동 전환은 `data-theme`을 루트에 스탬프
- 설정은 `ui.theme`로 localStorage 저장. Phase 2의 `settings.svelte.ts`에 `theme` 필드를 **추가**한다 (GLOBAL D-5)
- FOUC 방지: `app.html`에 인라인 스크립트로 저장된 테마를 즉시 적용
- insert/interchange 색은 **라이트·다크 양쪽에서 대비 4.5:1 이상**을 확보한다. 밤 사용이 잦으므로 다크에서 채도를 낮춘다

## 4-3. 반응형 (FR-22)

- 모바일 우선. 브레이크포인트 하나(`min-width: 640px`)만 둔다
- 세로 배치: 상단 입력(고정) → 보조 영역 → 결과 → 하단 네비게이션
- 퀴즈의 무브 키패드는 하단 고정, 엄지 도달 범위
- 데스크탑에서는 최대 폭 720px 중앙 정렬
- 터치 타겟 최소 44×44px

## 4-4. 고정폭 폰트 (NFR-3)

GLOBAL D-4에 따라 시스템 스택을 사용한다. 웹폰트를 번들하지 않는다.
`--mono` 토큰 자체는 Phase 2에서 정의되므로, 이 페이즈의 역할은 **양 테마에서 렌더를 확인**하는 것이다.

```css
--mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
        "Liberation Mono", "DejaVu Sans Mono", monospace;
```

## 4-5. 로컬 확인 환경

사용자가 직접 볼 수 있도록 아래를 준비한다.

- `npm run dev` — 개발 서버 (기본 5173)
- `npm run preview` — 프로덕션 빌드 미리보기. **PWA와 오프라인은 여기서만 정확히 확인된다**
- README에 실행 방법 기록

## 4-6. E2E 마감 (여건에 따라)

Playwright 브라우저 설치가 가능하면 Phase 2·3의 E2E를 포함해 전체를 실행한다.
설치가 막히면 단위·컴포넌트 테스트로 대체하고, 수동 확인 체크리스트를 README에 남긴다.

## 산출물

```
vite.config.ts (PWA 설정)
static/{favicon.svg, icon-192.png, icon-512.png, icon-maskable.png}
src/app.html (테마 FOUC 방지 스크립트)
src/lib/styles/app.css (테마 토큰 완성)
playwright.config.ts
tests/e2e/*.spec.ts
README.md (실행·확인 방법)
```

## 위험 요소

| 위험 | 대응 |
|---|---|
| 데이터 JSON이 프리캐시에서 누락 | `globPatterns`에 `json` 포함. E2E 오프라인 테스트로 검증 |
| Playwright 브라우저 다운로드 실패 | 시스템 Chromium을 `channel`로 지정 시도 → 실패 시 E2E 스킵하고 문서화 |
| 다크모드에서 insert/interchange 색 대비 부족 | 대비비 계산 후 조정 |
| prerender와 쿼리 파라미터 충돌 | 쿼리는 클라이언트에서만 읽는다. 빌드 로그에서 prerender 경고 확인 |
