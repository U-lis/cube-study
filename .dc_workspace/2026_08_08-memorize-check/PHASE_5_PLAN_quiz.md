# Phase 5 — 퀴즈 "암기한 것만" (quiz)

**담당**: FR-MC-18~20

## 목표

이 페이즈가 끝나면:
- 퀴즈 화면(`quiz/+page.svelte`)에 "암기한 것만 출제" 토글이 추가된다
- 토글이 켜지면 현재 `settings.quizInput`에 해당하는 암기 목록에서만 출제된다
- 암기 케이스가 0개이면 안내가 표시되고 전체에서 조용히 출제하지 않는다
- `quizInput`(direct/setup)이 바뀌면 pool이 즉시 갱신된다

## 선행 조건

- Phase 1 완료 (`memorize.svelte.ts`의 `memorizedOnly`, `checkedFor`, `poolFor` 사용 가능)

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-18 | 퀴즈 화면에 "암기한 것만 출제" 토글. 저장 키 `"quiz.memorizedOnly"`, 기본값 `false` |
| FR-MC-19 | 토글 ON 시 `settings.quizInput`에 맞는 표기의 체크 목록으로 pool 제한 |
| FR-MC-20 | 토글 ON + 암기 케이스 0개 → 안내 표시 + 전체 fallback 없음 |

## 수정·생성할 파일

### `src/routes/quiz/+page.svelte` (수정)

참조 코드:
- `quiz/+page.svelte:38-54` — `INPUT_OPTIONS`, `settings.quizInput` 사용 위치
- `quiz/+page.svelte:69-78` — 현재 `next()` 함수, `Object.keys(ds.cases)` 순회

구현 내용:

**"암기한 것만" 토글 UI**:
- 위치: `INPUT_OPTIONS` 세그먼티드 컨트롤(입력 방식 선택) 근처
- `<label>` + `<input type="checkbox" bind:checked={memorize.memorizedOnly}>`
- 라벨 텍스트: `"암기한 것만 출제"`
- `min-height: 44px`

**pool을 $derived로**:

```svelte
let pool = $derived(
  memorize.memorizedOnly
    ? poolFor(memorize, settings.quizInput)
    : Object.keys(ds.cases)
);
```

`poolFor`는 Phase 1의 `domain/memorize.ts`에서 import한다. 또는 `memorize.svelte.ts`의 래퍼 메서드를 사용한다.

**`next()` 수정**:
- `pool`을 사용해 다음 케이스를 선택
- 기존 `Object.keys(ds.cases)` 순회를 `pool`로 교체
- `pool.length === 0`이면 `current = null`을 설정하고 `next()`를 호출하지 않음 (FR-MC-20)

**pool 비면 안내**:

```svelte
{#if memorize.memorizedOnly && pool.length === 0}
  <p>암기 표시한 공식이 없습니다</p>
{/if}
```

SSR 이슈 없음 — 퀴즈 화면은 `prerender` 지시자 없고 초기 렌더가 `{#if current && ds}` 안임.

**memorizedOnly 변화 시 next() 재호출**:

```svelte
$effect(() => {
  memorize.memorizedOnly; // 의존성 추적
  if (pool.length > 0) next();
  else current = null;
});
```

기존 `$effect(() => { settings.quizInput; clearEntry(); })` 패턴 유지. `quizInput` 변경 시 pool이 자동 갱신되므로 별도 처리 불필요.

### `tests/e2e/memorize-quiz.spec.ts` (신규)

`addInitScript`로 localStorage에 암기 목록을 심고 테스트한다.

## 구현 순서

1. `memorize.memorizedOnly`가 Phase 1에서 구현되었는지 확인. 미구현이면 `memorize.svelte.ts`에 추가
2. `quiz/+page.svelte`에 memorize import 추가
3. "암기한 것만" 토글 UI 추가 (입력 방식 근처)
4. `pool = $derived(...)` 선언 (기존 `Object.keys(ds.cases)` 인라인 사용을 교체)
5. `next()` 함수에서 `pool`을 사용하도록 수정
6. `pool.length === 0` 안내 추가
7. `memorizedOnly` 변화 감지 `$effect` 추가
8. `tests/e2e/memorize-quiz.spec.ts` 작성 및 통과 확인

## 완료 체크리스트

- [ ] 퀴즈 화면에 "암기한 것만 출제" 토글이 표시된다 (E2E로 검증)
- [ ] 토글 OFF 상태에서는 기존대로 전체 케이스에서 출제된다 (E2E로 검증)
- [ ] `addInitScript`로 `quizInput = 'direct'`, `checked.direct = [케이스A, 케이스B, ...]`를 주입하고 토글 ON 시, 30회 출제가 모두 주입된 목록 안의 케이스다 (E2E로 검증)
- [ ] `settings.quizInput`을 `'setup'`으로 바꾸면 pool이 `checked.setup`으로 전환되어 목록 밖 케이스가 나오지 않는다 (E2E로 검증)
- [ ] `checked.direct = []`인 상태에서 `quizInput = 'direct'`, 토글 ON → "암기 표시한 공식이 없습니다" 안내가 표시되고 자동으로 전체 출제되지 않는다 (E2E로 검증)
- [ ] 토글 ON 상태에서 도중에 `quizInput`을 전환하면 pool이 새 입력 방식의 목록으로 즉시 갱신된다 (E2E로 검증)
- [ ] `memorize.memorizedOnly`가 `"quiz.memorizedOnly"` 키로 localStorage에 저장되고 새로고침 후 유지된다 (E2E로 검증)
- [ ] `pnpm test:e2e tests/e2e/memorize-quiz.spec.ts` 전체 통과
- [ ] `pnpm build` 성공

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| `pool`이 도중에 비거나 현재 문제가 pool 밖 | `$effect`로 감지해 `next()` 재호출. pool이 0이면 `current = null` + 안내 |
| `quizInput` 전환 시 pool 갱신 타이밍 | `pool`이 `$derived`이므로 `quizInput` 변화 시 자동 갱신. `next()`가 `pool` 참조이므로 별도 처리 없음 |
| 기존 `next()` 로직이 `ds.cases` 직접 참조하는 경우 | `quiz/+page.svelte:69-78` 전체를 확인해 `Object.keys(ds.cases)` 사용 위치를 `pool`로 교체 |
| 퀴즈 화면에 체크박스 추가 오해 | 퀴즈 화면에 체크박스를 두지 않는다. "암기한 것만 출제" 토글만 추가한다 (SPEC 제약) |
