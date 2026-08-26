# Phase 2 — 테스트 계획

## 테스트 커버리지 목표

`<h1>` 이 화면 이름이 됐는가와 설정 자리 이동이 흠 없이 통과하는가.

**규약을 검사로 못 박는 것은 페이즈 4 다.** 여기서는 옛 검사 갱신과 사람 확인이 대부분이다.

## 실행 명령

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

## 갱신된 E2E

### T2-1. `tests/e2e/pwa.spec.ts:129` — 자동

- [ ] `page.locator('h1[data-case]')` 셀렉터를 새 요소에 맞게 갱신
  - 새 요소가 `<div class="case" data-case={current.case}>` 라면 → `page.locator('[data-case]:not(h1)')` 혹은 `page.locator('.case[data-case]')`
  - 셀렉터 결정은 페이즈 2 커밋 안에서 (같은 커밋)
- [ ] 갱신 후 이 테스트가 통과. 오프라인 상태에서 퀴즈로 이동해 문제가 뜨는지 보는 검사

## 사람이 보는 것

### T2-2. h1 이 화면 이름인지 — 사람

- [ ] `/` — h1 이 "홈" (Phase 1 에서 이미 세움. 여기서는 확인)
- [ ] `/3x3/bld/3style/corner/lookup` — h1 이 "조회"
- [ ] `/3x3/bld/3style/corner/algs` — h1 이 "기준공식" (이미 있음. 유지 확인)
- [ ] `/3x3/bld/3style/corner/algs/{code}` — h1 이 `{code}` 혹은 "기준 없음" (이미 있음. 유지 확인)
- [ ] `/3x3/bld/3style/corner/quiz` — h1 이 "퀴즈" (신설). 케이스 코드는 크게 뜨되 h1 이 아님
- [ ] `/3x3/bld/trace` — h1 이 "트레이싱" (신설)

각 화면에서 브라우저 개발자 도구로 `<h1>` 개수가 **정확히 하나** 인지 확인.

### T2-3. 설정 자리 — 사람

- [ ] `/3x3/bld/3style/corner/quiz` — 입력 방식 토글과 "암기한 것만 출제" 체크가 h1 아래, 케이스 코드 위에 있음
- [ ] `/3x3/bld/3style/corner/algs/{code}` — 두 토글(암기 숨김 · 역공식 숨김)이 목록 머리 옆에 있음 (**예외 자리**. 판의 설정이 아니라 목록 필터)
- [ ] `/3x3/bld/trace` — 세션 설정 두 토글이 큐브·계기 아래에 있음 (**예외 자리**. 큐브가 h1 바로 아래에 서야 하는 흐름 때문)
- [ ] `/3x3/bld/3style/corner/lookup` — 설정 없음
- [ ] `/3x3/bld/3style/corner/algs` — 설정 없음

두 예외는 GLOBAL 이 못 박아 뒀고, 페이즈 5 의 `CONVENTIONS.md` 가 규칙과 함께 적는다.

### T2-4. UpLink — 사람

- [ ] 네 기능 화면(옮긴 조회·기준 목록·퀴즈·트레이싱) 상단에 "홈" 링크가 뜬다
- [ ] 기준 상세 상단에는 "기준공식" 링크가 뜬다 (FR-NAV-7 예외)
- [ ] 조회에 `?from={기준}` 쿼리로 들어가면 링크 라벨이 그 기준 이름으로 바뀐다 (지금 동작 유지)
- [ ] 홈에는 UpLink 가 없다 (홈이 상위)

### T2-5. 하이드레이션 — 사람

- [ ] `pnpm preview` 로 각 화면을 열 때 h1 이 두 번 그려졌다 사라지는 일이 없다 (NFR-NAV-1 확인)
- [ ] 퀴즈에서 케이스 코드 자리가 SSR/CSR 사이에 안 밀림 — h1 이 화면 이름으로 고정이므로 케이스 코드가 옆으로 밀 자리가 애초에 없다

## 통과 기준

- 자동 검사 (`pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`) 모두 통과
- T2-2 ~ T2-5 사람 확인 항목이 모두 예
