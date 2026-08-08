# Phase 4 — "외운거 안보기" 토글 (hide)

**담당**: FR-MC-13~17; NFR-MC-2

## 목표

이 페이즈가 끝나면:
- 기준 상세 화면(`anchors/[code]/+page.svelte`)에 "외운거 안보기" 토글이 추가된다
- 토글이 켜지면 setup 체크된 케이스의 `<li>`에 `class:hidden` → CSS `display:none`이 적용된다 (DOM 요소 개수 유지)
- 모든 케이스가 숨겨지면 안내 문구가 표시된다
- 토글 상태가 localStorage에 저장되고 새로고침 후 유지된다
- 진도 숫자(`{체크}/{전체}`)의 분모는 토글 상태에 무관하게 전체 케이스 수를 유지한다

## 선행 조건

- Phase 2 완료 (기준 상세 화면 체크박스 존재)
- Phase 3 완료 (진도 숫자 존재)

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-13 | 기준 상세 화면에만 "외운거 안보기" 토글. 판정 기준은 setup 암기 상태 |
| FR-MC-14 | 토글 상태를 `"anchor.hideMemorized"` 키로 localStorage 저장. 기본값 `false` |
| FR-MC-15 | 모든 케이스가 숨겨지면 "모두 암기 표시되어 있습니다" 안내 표시 |
| FR-MC-16 | 진도 분모는 항상 전체 케이스 수. 숨겨진 케이스가 분모에서 빠지면 안 됨 |
| FR-MC-17 | 토글 on/off 시 레이아웃 점프 없음 |
| NFR-MC-2 | 체크 상태 변경이 레이아웃을 변경하면 안 됨 |

## 수정·생성할 파일

### `src/routes/anchors/[code]/+page.svelte` (수정)

변경 위치: 진도 숫자(`{체크}/{전체}`) 와 케이스 목록 `<ul>` 사이.

**토글 UI 추가**:
- `<label>` + `<input type="checkbox" bind:checked={memorize.hideMemorized}>` 형식
- 라벨 텍스트: `"외운거 안보기"`
- `min-height: 44px` (FR-MC-4와 동일 기준)
- `memorize.hideMemorized`는 Phase 1에서 `memorize.svelte.ts`에 이미 구현된 상태

**케이스 목록 필터링**:

```svelte
<li
  class:hidden={memorize.hideMemorized && memorize.isChecked('setup', c.case)}
  ...
>
```

CSS:
```css
.hidden { display: none; }
```

`{#if}` 조건부 블록으로 `<li>`를 제거하지 않는다 — DOM 개수 불변 원칙 (AD-4).

**"모두 암기" 안내**:

```svelte
{#if browser && memorize.hideMemorized && visibleCount === 0}
  <p>모두 암기 표시되어 있습니다</p>
{/if}
```

- `visibleCount = $derived(data.cases.filter(c => !memorize.isChecked('setup', c.case)).length)`
- `{#if browser && ...}` 이중 방어 — SSR에서는 이 블록이 렌더되지 않음 (AD-4)
- 빈 `<ul>`만 남기지 않음 (FR-MC-15)

**진도 숫자 분모 확인**:
- Phase 3에서 이미 `data.cases.length`가 분모. 토글 관련 변수를 분모에 사용하지 않는다 (FR-MC-16)

### `tests/e2e/memorize-hide.spec.ts` (신규)

## 구현 순서

1. `memorize.hideMemorized`가 Phase 1에서 구현되었는지 확인. 미구현이면 `memorize.svelte.ts`에 추가
2. "외운거 안보기" 토글 UI를 `anchors/[code]/+page.svelte`에 추가
3. `<li class:hidden>` 바인딩 추가 및 `.hidden { display: none; }` CSS 추가
4. `visibleCount $derived` 및 안내 문구 추가
5. `pnpm build`로 SSR 산출물 확인 — 안내 문구 없음, 모든 `<li>` 존재
6. `tests/e2e/memorize-hide.spec.ts` 작성 및 통과 확인

## 완료 체크리스트

- [ ] 기본 상태(localStorage 없음)에서 `/anchors/[code]` 접속 시 토글이 OFF이고 모든 케이스가 표시된다 (E2E로 검증)
- [ ] 케이스 1개를 setup 체크한 뒤 토글을 ON하면 해당 `<li>`에 `hidden` 클래스가 추가되고 화면에서 보이지 않는다 (E2E로 검증, `display: none` 확인)
- [ ] 토글 ON 상태에서 해당 `<li>` DOM 요소가 여전히 존재한다 (`{#if}`로 제거되지 않음) — `page.locator('li').count()`가 토글 전후 동일
- [ ] 모든 케이스를 setup 체크한 뒤 토글 ON → "모두 암기 표시되어 있습니다" 안내가 표시된다 (E2E로 검증)
- [ ] 토글 ON 상태에서 케이스 1개 체크 해제 → 해당 `<li>`가 즉시 표시된다 (E2E로 검증)
- [ ] 토글 상태가 localStorage `"anchor.hideMemorized"`에 저장되고 새로고침 후 유지된다 (E2E로 검증)
- [ ] 토글이 켜지고 꺼질 때 케이스 목록 컨테이너의 위치(`getBoundingClientRect().top`)가 변하지 않는다 (FR-MC-17)
- [ ] 토글 ON 상태에서도 진도 숫자 분모가 전체 케이스 수다 (숨겨진 케이스가 분모에서 빠지지 않음) (FR-MC-16)
- [ ] SSR 산출물에 "모두 암기 표시되어 있습니다" 문구가 없다
- [ ] SSR 산출물에 모든 케이스 `<li>`가 존재하고 `hidden` 클래스가 없다
- [ ] `pnpm test:e2e tests/e2e/memorize-hide.spec.ts` 전체 통과
- [ ] `pnpm build` 성공

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| `{#if}`로 `<li>` 제거 → 목록 축소 + 레이아웃 점프 | 반드시 `class:hidden` + CSS `display:none`만 사용 (AD-4) |
| "모두 암기" 안내가 SSR에 렌더됨 | `{#if browser && ...}` 이중 방어 (`browser`는 `$app/environment`에서 import) |
| 토글 시 목록 컨테이너 위치 이동 | `<ul>` 높이가 줄어들면서 밀림. `<ul>`에 `min-height`를 주거나 `position` 레이아웃 확인 |
| `hideMemorized`가 Phase 1에서 미구현된 경우 | `memorize.svelte.ts`에서 `hideMemorized = $state<boolean>(...)` 및 `$effect` 저장 패턴 추가. `"anchor.hideMemorized"` 키 확인 |
