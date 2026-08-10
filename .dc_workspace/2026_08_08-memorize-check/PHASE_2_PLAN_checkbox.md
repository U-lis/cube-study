# Phase 2 — 체크박스 UI (checkbox)

**담당**: FR-MC-3, 4, 5; NFR-MC-2, 4

## 목표

이 페이즈가 끝나면:
- 조회 결과 카드(`CaseView.svelte`)에 현재 `settings.mode` 기준의 암기 체크박스가 표시된다
- 기준 상세 화면(`anchors/[code]/+page.svelte`) 케이스 목록 각 행에 setup 고정 체크박스가 표시된다
- 체크 상태가 즉시 localStorage에 반영되며 새로고침 후 유지된다
- 프리렌더 산출물에 체크박스가 unchecked 상태로 존재하고 하이드레이션 불일치 경고가 없다

## 선행 조건

- Phase 1 완료 (`memorize.svelte.ts` 싱글턴 사용 가능)

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-3(a) | `CaseView.svelte` — header 직후, `settings.mode`에 따라 setup/direct 암기 상태 표시 |
| FR-MC-3(b) | `anchors/[code]/+page.svelte` — 각 `<li>` 행에 **setup 고정** 체크박스 |
| FR-MC-4 | 체크박스 터치 대상 44px 이상 |
| FR-MC-5 | 체크 상태 토글 → 즉시 localStorage 반영 (별도 저장 버튼 없음) |
| NFR-MC-2 | 체크 상태 변경이 카드·목록 레이아웃을 바꾸면 안 됨 |
| NFR-MC-4 | Svelte `$state` 반응성으로 자동 업데이트 |

## 수정·생성할 파일

### `src/lib/ui/CaseView.svelte` (수정)

변경 위치: `CaseView.svelte:35-139`에서 확인한 DOM 구조 기준 — `header` 영역 내부 또는 직후에 삽입.

구현 내용:
- `memorize`를 `memorize.svelte.ts`에서 import
- `let isMemorized = $derived(memorize.isChecked(mode, entry.case))` 선언
  - `mode`는 이미 `CaseView.svelte:24`에 `let mode = $derived(settings.mode)`로 존재
- `<label>` 래핑 체크박스 추가:
  - `<input type="checkbox" checked={isMemorized} onchange={() => memorize.toggle(mode, entry.case)}>`
  - 라벨 텍스트: `mode === 'setup' ? 'setup 암기' : 'optimized 암기'`
  - `min-height: 44px`, 라벨 전체가 클릭 가능 영역
- 체크박스의 크기(width, height)를 CSS로 고정해 SSR/CSR 간 레이아웃이 동일하도록 보장 (AD-4)

조심할 것:
- `footer`(`CaseView.svelte:135-139`)는 역케이스 링크 전용이므로 혼용하지 않는다
- 체크박스 추가로 기존 `.main`, `.block` 영역의 위치가 밀리면 안 된다 (NFR-MC-2)

### `src/routes/anchors/[code]/+page.svelte` (수정)

변경 위치: `<ul>` 내 각 `<li>` 구조 (`anchors/[code]/+page.svelte:32-52`).

현재 행 구조:
```
<li>
  <a> (4열 그리드: 3.2rem 1fr 1.2rem auto)
    ...
  </a>
</li>
```

변경 후 구조 (AD-7 — 체크박스를 `<a>` 밖 형제로):
```
<li style="display:flex; align-items:center;">
  <label>  <!-- 체크박스, setup 고정, min-height:44px -->
    <input type="checkbox" checked={memorize.isChecked('setup', c.case)}
           onchange={() => memorize.toggle('setup', c.case)}>
  </label>
  <a href="...">  <!-- 기존 4열 그리드 그대로 유지 -->
    ...
  </a>
</li>
```

- `memorize.isChecked('setup', c.case)` — 항상 `'setup'` 고정 (FR-MC-3(b))
- `data-memorize-setup` 속성을 `<li>`에 추가해 E2E 선택자로 사용
- 체크박스 열 너비를 고정해 `<a>` 그리드가 밀리지 않도록 한다

### `tests/e2e/memorize-checkbox.spec.ts` (신규)

`tests/e2e/quiz.spec.ts:11-15`의 데이터 로드 방식을 따른다. 기준 이름·케이스 코드를 테스트 코드에 하드코딩하지 않고 데이터에서 읽는다.

## 구현 순서

1. `src/lib/ui/CaseView.svelte` — memorize import, `isMemorized` $derived, 체크박스 label 추가
2. `pnpm build`로 SSR 산출물 확인 (체크박스 unchecked 상태로 렌더되는지)
3. `src/routes/anchors/[code]/+page.svelte` — `<li>` flex 구조 변경, 체크박스 추가
4. `pnpm build`로 SSR 산출물 재확인
5. `tests/e2e/memorize-checkbox.spec.ts` 작성 및 `pnpm test:e2e` 통과 확인

## 완료 체크리스트

- [ ] `CaseView.svelte`에서 `settings.mode`가 `'setup'`일 때 체크박스 라벨이 `"setup 암기"`로 표시된다 (E2E로 검증)
- [ ] `CaseView.svelte`에서 `settings.mode`를 `'direct'`(optimized)로 바꾸면 체크박스 라벨이 `"optimized 암기"`로 바뀐다 (E2E로 검증)
- [ ] `CaseView.svelte` 체크박스를 토글하면 `localStorage.getItem('memorize.checked')`의 해당 mode 배열이 갱신된다 (E2E로 검증)
- [ ] `anchors/[code]/+page.svelte` 케이스 행 체크박스는 `settings.mode` 값에 무관하게 항상 `'setup'` 배열을 갱신한다 (E2E로 검증)
- [ ] 체크박스 클릭과 `<a>` 링크 클릭이 서로 트리거하지 않는다 — 체크박스 클릭 후 URL 변경 없음, `<a>` 클릭 후 localStorage 변경 없음 (E2E로 검증)
- [ ] 체크박스의 터치 대상(높이)이 44px 이상이다 (`About.svelte:110` 기준과 동일)
- [ ] `pnpm build` 산출물에서 `anchors/[code]/` HTML 파일에 `<input type="checkbox">`가 `checked` 속성 없이 존재한다 (SSR 초기값 unchecked)
- [ ] Playwright 콘솔에 하이드레이션 불일치 경고가 없다
- [ ] 새로고침 후 체크 상태가 유지된다 (localStorage 영속화)
- [ ] 체크박스 추가로 CaseView의 `.main`, `.block` 영역이 이동하지 않는다 (레이아웃 고정 확인)
- [ ] `pnpm test:e2e`의 `memorize-checkbox.spec.ts`가 전부 통과한다

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| 하이드레이션 불일치 — SSR에서 체크박스가 `checked`로 렌더됨 | memorize 스토어 초기값이 빈 Set이므로 SSR에서는 항상 `checked={false}`. 이 상태가 유지되는지 `pnpm build` 산출물로 확인 |
| `<a>` 안 체크박스 클릭이 네비게이션 유발 | AD-7 — 체크박스를 `<a>` 밖 형제로. E2E에서 체크박스 클릭 후 URL 변경 없음 검증 |
| 체크박스 너비 추가로 `<a>` 그리드가 밀림 | `<li>` flex 레이아웃에서 체크박스 `<label>` 너비 고정, `<a>` 영역이 남은 공간을 차지하도록 |
| `CaseView.svelte`에서 `mode`를 props로 받지 않고 `$derived`로 읽음 | 기존 코드 `CaseView.svelte:24`의 패턴 유지. 건드리지 않는다 |
