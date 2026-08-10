# Phase 2 — 테스트 계획

## 테스트 커버리지 목표

≥ 70% (E2E 중심)

## 실행 명령

```bash
pnpm test:e2e tests/e2e/memorize-checkbox.spec.ts
pnpm build && grep -l 'type="checkbox"' build/anchors/**/*.html
```

---

## E2E 테스트 (`tests/e2e/memorize-checkbox.spec.ts`)

검증 대상 FR: FR-MC-3(a), 3(b), 4, 5; NFR-MC-2, 4

데이터 의존 테스트는 `tests/e2e/quiz.spec.ts:11-15` 방식으로 `loadDataset()`을 호출해 케이스 코드와 기준 이름을 읽는다. 테스트 코드에 케이스 코드를 리터럴로 박지 않는다.

### T2-1. CaseView 체크박스 — setup 모드 (FR-MC-3(a), 5)

시나리오: 조회 화면(`/`)에서 케이스를 검색해 결과 카드를 표시한 후 체크박스를 토글한다.

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `settings.mode`가 `'setup'`인 상태에서 카드 표시 | 체크박스 라벨이 `"setup 암기"` 텍스트를 포함한다 |
| 2 | 체크박스가 unchecked 상태 | `input[type="checkbox"]`의 `checked` 속성이 `false` |
| 3 | 체크박스 클릭 | `localStorage.getItem('memorize.checked')`를 파싱하면 `checked.setup` 배열에 해당 케이스 코드가 있다 |
| 4 | 페이지 새로고침 | 체크박스가 checked 상태로 복원된다 |
| 5 | 체크박스 재클릭 | `checked.setup` 배열에서 해당 코드가 제거된다 |

### T2-2. CaseView 체크박스 — direct/setup 모드 전환 (FR-MC-3(a), 1)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `settings.mode = 'setup'`에서 체크박스 체크 | `checked.setup`에 코드 추가됨 |
| 2 | mode를 `'direct'`(optimized)로 전환 | 체크박스 라벨이 `"optimized 암기"`로 바뀐다 |
| 3 | 전환 직후 체크박스 상태 | unchecked (direct 체크 이력이 없으므로) |
| 4 | direct 모드에서 체크박스 체크 | `checked.direct`에 코드 추가됨. `checked.setup`은 유지 |
| 5 | mode를 다시 `'setup'`으로 전환 | 체크박스가 checked 상태 (step 1의 상태 복원) |

### T2-3. 기준 상세 체크박스 — setup 고정 (FR-MC-3(b), 5)

시나리오: `addInitScript`로 localStorage를 초기화한 뒤 `/anchors/[code]` 페이지를 열어 행 체크박스를 테스트한다.

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `/anchors/[code]` 페이지 열기 | 각 `<li>`에 `data-memorize-setup` 체크박스가 존재한다 |
| 2 | 첫 번째 케이스 행의 체크박스 클릭 | `checked.setup` 배열에 해당 케이스 코드가 추가된다 |
| 3 | `settings.mode`를 `'direct'`로 변경 후 확인 | `anchors/[code]` 체크박스 상태가 `checked.setup`을 여전히 반영한다 (setup 고정) |
| 4 | `settings.mode`를 `'direct'`로 바꾼 뒤 체크박스 토글 | `checked.direct`가 아닌 `checked.setup`이 변경된다 |
| 5 | 새로고침 | 체크 상태가 유지된다 |

### T2-4. 체크박스와 링크 이벤트 독립 (AD-7)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `/anchors/[code]` 에서 체크박스 클릭 | URL이 변경되지 않는다 (`page.url()`이 동일) |
| 2 | `/anchors/[code]` 에서 `<a>` 행 클릭 | 해당 케이스 조회 페이지로 이동한다. localStorage의 `checked.setup`이 변경되지 않는다 |

### T2-5. 터치 대상 크기 (FR-MC-4)

| # | 검사 | 완료 조건 |
|---|------|----------|
| 1 | `CaseView.svelte` 체크박스 `<label>`의 높이 | `getBoundingClientRect().height >= 44` |
| 2 | `anchors/[code]` 행 체크박스 `<label>`의 높이 | `getBoundingClientRect().height >= 44` |

### T2-6. 레이아웃 안정성 (NFR-MC-2)

| # | 검사 | 완료 조건 |
|---|------|----------|
| 1 | 체크박스 토글 전후 CaseView `.main` 요소의 `getBoundingClientRect().top` | 동일한 값 |
| 2 | `anchors/[code]` 에서 체크박스 토글 전후 `<ul>` 높이 | 동일한 값 |

---

## 빌드 검증

| # | 명령 | 완료 조건 |
|---|------|----------|
| 1 | `pnpm build` | 성공 |
| 2 | SSR 산출물에서 체크박스 확인 | `build/anchors/` 아래 HTML 파일에 `type="checkbox"`가 존재하고 `checked` 속성이 없다 |
| 3 | Playwright 콘솔 필터 | `hydration` 관련 경고 0건 |

---

## 완료 조건 종합

- [ ] `pnpm test:e2e tests/e2e/memorize-checkbox.spec.ts` 전체 통과
- [ ] `pnpm build` 성공 및 하이드레이션 경고 0건
- [ ] 체크박스 터치 대상 44px 이상 확인
- [ ] 체크박스-링크 이벤트 독립 확인
