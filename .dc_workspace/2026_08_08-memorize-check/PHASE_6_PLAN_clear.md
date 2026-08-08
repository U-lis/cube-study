# Phase 6 — About "전체 해제" (clear)

**담당**: FR-MC-21~22

## 목표

이 페이즈가 끝나면:
- 앱 정보 모달(`About.svelte`)에 "암기 표시 전체 해제" 버튼이 추가된다
- 첫 클릭에 확인 문구로 전환, 두 번째 클릭에 `clearAll()` 실행 (2단계 확인)
- 모달을 닫고 다시 열면 확인 상태가 초기화된다
- 실행 후 `checked.setup`과 `checked.direct`가 모두 빈 배열이 되고 localStorage가 갱신된다

## 선행 조건

- Phase 1 완료 (`memorize.svelte.ts`의 `clearAll()` 사용 가능)
- Phase 2~5의 다른 화면이 완성된 상태에서 전체 해제가 진도 및 체크박스에 반영되는지 통합 검증 가능

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-21 | `About.svelte` "업데이트 확인" 버튼 아래에 "암기 표시 전체 해제" 버튼 추가 |
| FR-MC-22 | 2단계 확인: 첫 클릭 → 문구 전환, 두 번째 클릭 → 실행. 브라우저 `confirm()` 미사용. `onclose`에서 idle 리셋 |

## 수정·생성할 파일

### `src/lib/ui/About.svelte` (수정)

참조 코드:
- `About.svelte:21-47` — `<dialog>` 내 `.body` 구조
- `About.svelte:31-39` — "업데이트 확인" 버튼 (전체 해제 버튼 삽입 기준점)
- `About.svelte:110` — 버튼 `min-height: 44px`

구현 내용:

**상태 변수**:
```svelte
let clearState = $state<'idle' | 'confirming'>('idle');
```

**dialog onclose 핸들러**:
```svelte
<!-- 기존 <dialog> 태그에 onclose 추가 -->
<dialog ... onclose={() => { clearState = 'idle'; }}>
```

**버튼 배치** ("업데이트 확인" 버튼 아래):
```svelte
{#if clearState === 'idle'}
  <button onclick={() => { clearState = 'confirming'; }}>
    암기 표시 전체 해제
  </button>
{:else}
  <button onclick={() => { memorize.clearAll(); clearState = 'idle'; }}>
    정말 해제합니다
  </button>
{/if}
```

- `min-height: 44px` (FR-MC-4 기준)
- 되돌릴 수 없는 동작임을 명확히 — "정말 해제합니다" 문구로 충분. 추가 경고 텍스트를 인라인으로 넣어도 됨
- 버튼 스타일은 기존 버튼과 동일한 클래스/스타일을 따른다

### `tests/e2e/memorize-clear.spec.ts` (신규)

## 구현 순서

1. `About.svelte`에 memorize import 추가
2. `clearState` 상태 변수 추가
3. `<dialog>`에 `onclose` 핸들러 추가
4. "업데이트 확인" 버튼 아래에 조건부 버튼 추가
5. `pnpm build` 확인
6. `tests/e2e/memorize-clear.spec.ts` 작성 및 통과 확인

## 완료 체크리스트

- [ ] About 모달에 "암기 표시 전체 해제" 버튼이 존재하고 "업데이트 확인" 버튼보다 아래에 위치한다 (E2E로 검증)
- [ ] 버튼을 한 번 클릭하면 "정말 해제합니다" 문구로 바뀐다 (E2E로 검증)
- [ ] "정말 해제합니다"를 클릭하면 `localStorage.getItem('memorize.checked')`의 `checked.setup`과 `checked.direct`가 모두 빈 배열이 된다 (E2E로 검증)
- [ ] 전체 해제 후 `/anchors` 화면의 모든 기준 진도가 `0/{전체}`가 된다 (E2E로 검증)
- [ ] 모달을 닫고 다시 열면 버튼이 "암기 표시 전체 해제" (idle) 상태로 초기화된다 (E2E로 검증)
- [ ] 첫 클릭 후 모달을 닫으면 확인 상태가 리셋된다 (다시 열면 idle) (E2E로 검증)
- [ ] 브라우저 `confirm()` 다이얼로그가 호출되지 않는다 (Playwright `page.on('dialog')` 이벤트 없음)
- [ ] "암기 표시 전체 해제" 버튼의 터치 대상 높이가 44px 이상이다 (E2E로 검증)
- [ ] "정말 해제합니다" 버튼의 터치 대상 높이가 44px 이상이다 (E2E로 검증)
- [ ] `pnpm test:e2e tests/e2e/memorize-clear.spec.ts` 전체 통과
- [ ] `pnpm build` 성공

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| About 확인 상태가 모달 재열림 후 잔존 | `<dialog>` 의 `onclose` 이벤트에서 `clearState = 'idle'` 리셋. 기존 `<dialog>` 태그에 `onclose` 핸들러를 추가한다 |
| `clearAll()`이 `memorize.svelte.ts`에서 Set을 빈 Set으로 교체할 때 $state 반응성 손실 | `setupChecked = new Set()` 직접 대입이 아닌 Set.clear() 후 트리거 방식 또는 새 Set 대입이 `$state`로 올바르게 반응하는지 확인 |
| 버튼 스타일이 기존 버튼과 어긋남 | `About.svelte:31-39` "업데이트 확인" 버튼의 클래스·스타일을 그대로 사용 |
