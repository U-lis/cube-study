# Phase 4 — 세션 추출 (`session`)

GLOBAL AD-12. SPEC FR-EX-R-1~4.

## 전제

- Phase 3 완료 (`pnpm check && pnpm test && pnpm test:e2e` 초록).

## 만들 것

### 1. `src/lib/domain/session.ts` (신규)

매일 퀴즈와 시험이 공유하는 타입·헬퍼만 담는다.

```ts
export type QuizAnswer = /* 기존 DailyAnswer 와 동일한 구조 */;

export function isAnswered(mode: InputMode, a: QuizAnswer): boolean;
export function emptyAnswer(): QuizAnswer;
export function parseAnswer(raw: unknown): QuizAnswer;
```

`QuizAnswer` 는 `src/lib/ui/daily.svelte.ts` 에 있는 `DailyAnswer` 의 복사본이 아니라
이 파일에서 정의하고 `daily.ts` 가 재export 한다.

**공유하지 않는 것**: 세션 스토어(날짜 규칙, 키), 활성 단계 자판+AnchorPad 블록.

### 2. `src/lib/domain/daily.ts` 갱신

`DailyAnswer` 를 `session.ts` 에서 가져와 재export 한다.

```ts
export type { QuizAnswer as DailyAnswer } from './session.ts';
```

기존 importer 가 `DailyAnswer` 를 그대로 쓸 수 있어야 한다. 런타임 동작 변경 없음.

### 3. `src/lib/ui/QuizResults.svelte` (신규)

`src/routes/3x3/bld/3style/corner/daily/+page.svelte:195-234` 영역의 결과 `<ol>` 블록을
컴포넌트로 추출한다.

props:
- `results: QuizAnswer[]`
- `mode: InputMode`
- `notation: string` (호출자가 settings 싱글톤 대신 넘긴다. 컴포넌트 안에서 settings 를 import 하지 않는다.)

`data-result-case`, `data-summary`, `data-verdict`, `data-kind`, `data-result` 속성을
그대로 유지한다. `N문제 중 M개 정답` 요약 줄(`data-summary`)을 포함한다.

### 4. `src/routes/3x3/bld/3style/corner/daily/+page.svelte` 갱신

결과 `<ol>` 블록을 `QuizResults` 컴포넌트 호출로 교체한다. 논리 변경 없음.

## 순서

1. `session.ts` 작성 → `pnpm check`.
2. `daily.ts` 재export 갱신 → `pnpm check`.
3. `QuizResults.svelte` 추출 → `pnpm check`.
4. `daily/+page.svelte` 에서 컴포넌트 교체 → `pnpm check`.
5. `pnpm check && pnpm test && pnpm test:e2e` 전체 통과.

## 완료 체크리스트

- [ ] `session.ts` 에 `QuizAnswer`, `isAnswered`, `emptyAnswer`, `parseAnswer` export 있음
- [ ] `daily.ts` 에서 `DailyAnswer = QuizAnswer` 재export 됨
- [ ] `QuizResults.svelte` 에 `results`, `mode`, `notation` props 있음
- [ ] `QuizResults.svelte` 에 `data-summary`, `data-result-case` 속성 있음
- [ ] `daily/+page.svelte` 에서 `QuizResults` 사용
- [ ] `tests/e2e/daily.spec.ts` 전체 통과 (리팩터링 전후 동일)
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 초록

## 주의사항

- 매일 퀴즈 E2E(`tests/e2e/daily.spec.ts`)가 리팩터링 전후로 그대로 통과해야 한다.
  통과하지 않으면 추출 범위가 너무 크다는 신호다 — 롤백하고 범위를 줄인다.
- 날짜 묶임 로직(`daily/+page.svelte:74`)은 매일 퀴즈 전용이다. `session.ts` 에 넣지 않는다.
- 기존 `daily.session` localStorage 저장 포맷을 변경하지 않는다.
- `QuizResults.svelte` 는 settings 싱글톤을 import 하지 않는다. notation 은 prop 으로 받는다.
