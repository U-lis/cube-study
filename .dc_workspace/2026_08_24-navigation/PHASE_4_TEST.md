# Phase 4 — 테스트 계획

## 테스트 커버리지 목표

신설된 `conventions.spec.ts` 와 `routes.test.ts` 가 통과하고, 옛 검사가 함께 통과한다.

## 실행 명령

```bash
pnpm check
pnpm test
pnpm test tests/unit/routes.test.ts           # 신규 정적 검사
pnpm test:e2e
pnpm test:e2e tests/e2e/conventions.spec.ts   # 신규 규약 검사
pnpm build
```

## 자동 검사 (신규 검사 통과)

### T4-1 ~ T4-20 — 자동

Phase 4 PLAN 이 나열한 20개 검사가 모두 통과.

**빠뜨림 판정**: `tests/unit/e2e-tags.test.ts` 가 자동으로 신규 E2E 파일을 스캔한다. 뷰포트 신호를 쓰는 검사(T4-14, T4-18 등) 에 `@viewport` 태그가 붙어 있어야 통과.

### T4-21. E2E 태그 규약 유지 — 자동

- [ ] `tests/unit/e2e-tags.test.ts` 실행. 신규 `conventions.spec.ts` 파일의 모든 `test(...)` 제목이 문자열 리터럴이고, 뷰포트 신호를 쓰는 것들에 `@viewport` 가 붙어 있다

## 규약 하나가 이 페이즈에서 드러날 수 있음

**퀴즈의 진행 버튼이 `{#if verdict}` 로 렌더되는 문제** (Phase 4 PLAN §1g).

지금 코드:

```
{#if verdict}
  <button data-next>다음 문제</button>
{:else if setup 모드}
  <AnchorPad ... />
{:else}
  <button data-grade>제출</button>
{/if}
```

이것은 진행 버튼을 CSS 로 접는 규약(FR-NAV-13, "단계마다 누를 수 있는 것 하나만 보인다") 을 **DOM 존재 여부** 로 실현하고 있다. 트레이싱은 CSS 로 접는다 — 접은 것이 DOM 에 남는다 (`.controls button { display: none }` + 단계별 활성).

**두 방식이 갈리면 검사도 갈린다.** T4-16 이 이것을 드러낸다.

**결정**: 페이즈 4 안에서 결정. 두 선택지 —

(A) **퀴즈를 트레이싱과 같은 방식으로 옮긴다** — 세 진행 버튼 (`data-grade` · `data-next` · setup 모드의 anchor pad) 을 모두 렌더해두고 CSS `display: none` 으로 단계별 접기. `AnchorPad` 는 반응형 컴포넌트이므로 늘 렌더해도 값을 안 뽑아냄

(B) **`{#if}` 방식을 규약의 예외로 인정한다** — `verdict` 는 브라우저 상태에서 오지 않으므로 SSR/CSR 이 갈릴 위험은 없다. 단계별 하나만 보이는 규약은 지켜진다

**권장 결정**: (B). SPEC FR-NAV-18 의 예외 기준은 "표시 여부가 localStorage 나 브라우저 상태에서 오는가" 다. `verdict` 는 사용자 입력의 결과이므로 브라우저 상태가 아니지만 저장소에서 오지도 않는다. SSR 시점에는 언제나 `null` (undefined) 이므로 SSR/CSR 이 갈리지 않는다. 이 자리를 CSS 로 옮기는 값이 값보다 작다.

**대신 T4-16 검사를 이렇게 낸다**: `result` 상태에서 `[data-next]` 가 클릭 가능. `active` 상태에서 `[data-next]` 가 존재하든 안 하든 상관 없음 (부재 검사를 하지 않음). 이 완화가 페이즈 5 의 `CONVENTIONS.md` 규칙에 예외로 반영됨.

**만약 페이즈 4 실행 중 이 결정을 바꾸고 싶다면**: 결정 (A) 로 옮긴다. 페이즈 3 이 아니라 페이즈 4 에서 하는 이유 — 결정 시점이 검사를 쓰는 순간이라, 그 자리에서 값 판단이 가장 뚜렷하다.

## 사람이 보는 것

### T4-22. `pnpm preview` 로 예외들 확인 — 사람

Phase 2·3 의 예외가 규약 검사에서 통과하는지 확인:

- [ ] 기준 상세의 두 토글이 `list-head` 옆에 있음 (T4-14 는 이 화면 제외)
- [ ] 트레이싱의 세션 설정이 큐브 아래에 있음 (T4-14 는 이 화면 제외)
- [ ] 퀴즈의 진행 버튼이 `{#if}` 방식이지만 T4-16 은 완화된 형태로 통과

## 통과 기준

- 위 자동 검사 모두 통과
- 위 결정(퀴즈 진행 버튼 접기 방식)이 명시되고 CONVENTIONS.md 에 예외로 반영될 준비 완료
- T4-22 사람 확인 항목이 모두 예
