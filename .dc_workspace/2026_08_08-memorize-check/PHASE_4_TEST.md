# Phase 4 — 테스트 계획

## 테스트 커버리지 목표

≥ 70% (E2E 중심)

## 실행 명령

```bash
pnpm test:e2e tests/e2e/memorize-hide.spec.ts
pnpm build
```

---

## E2E 테스트 (`tests/e2e/memorize-hide.spec.ts`)

검증 대상 FR: FR-MC-13~17; NFR-MC-2

### T4-1. 기본 상태 — 토글 OFF, 전체 표시 (FR-MC-14)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | localStorage 없는 상태에서 `/anchors/[code]` 접속 | "외운거 안보기" 토글이 OFF 상태 (`checked` 속성 없음) |
| 2 | 케이스 목록 표시 확인 | 모든 케이스 `<li>`가 보인다 (`display: none`인 `<li>` 없음) |
| 3 | 안내 문구 확인 | "모두 암기 표시되어 있습니다" 문구가 없다 |

### T4-2. 체크 + 토글 ON — li 숨김 (FR-MC-13, 17)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | 케이스 행 중 1개를 setup 체크 | 해당 `<li>`의 `data-memorize-setup` 체크박스가 checked 상태 |
| 2 | "외운거 안보기" 토글 ON | 해당 `<li>`의 computed style `display`가 `none` |
| 3 | DOM 개수 확인 | `page.locator('ul li').count()`가 토글 전후 동일 |
| 4 | 목록 컨테이너 위치 확인 | `<ul>` 요소의 `getBoundingClientRect().top`이 토글 전후 동일 |
| 5 | 토글 OFF | 숨겨진 `<li>`가 다시 표시된다 (`display` 가 `none`이 아님) |

### T4-3. 모든 케이스 숨김 → 안내 표시 (FR-MC-15)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `addInitScript`로 해당 기준의 모든 케이스 코드를 `checked.setup`에 주입 | — |
| 2 | "외운거 안보기" 토글 ON | "모두 암기 표시되어 있습니다" 문구가 표시된다 |
| 3 | 빈 `<ul>` 단독 존재 확인 | 안내 문구가 있으므로 `<ul>` 이 비어있어도 사용자에게 상황이 전달된다 |
| 4 | 토글 OFF | 안내 문구가 사라지고 모든 `<li>`가 표시된다 |

### T4-4. 토글 + 체크 해제 — li 즉시 재표시 (FR-MC-13)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | 토글 ON + 케이스 1개 체크된 상태 | 해당 `<li>`가 숨겨진 상태 |
| 2 | 숨겨진 케이스의 체크박스를 해제 | 해당 `<li>`가 즉시 표시된다 |
| 3 | 진도 숫자 확인 | 체크 해제로 좌측 숫자가 감소한다 |

### T4-5. 토글 상태 localStorage 저장 및 복원 (FR-MC-14)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | 토글 ON | `localStorage.getItem('anchor.hideMemorized')` === `"true"` |
| 2 | 새로고침 | 토글이 ON 상태로 복원된다 |
| 3 | 토글 OFF | `localStorage.getItem('anchor.hideMemorized')` === `"false"` |
| 4 | 새로고침 | 토글이 OFF 상태로 복원된다 |

### T4-6. 진도 분모 불변 (FR-MC-16)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | 토글 OFF 상태에서 진도 `{체크}/{전체}` 분모 기록 | `{전체}` 값을 기록 |
| 2 | 토글 ON | 진도 분모(`{전체}`)가 토글 전과 동일하다 |
| 3 | 케이스 추가 체크 후 토글 ON/OFF 반복 | 분모가 항상 `data.cases.length`와 일치한다 |

### T4-7. 레이아웃 점프 없음 (FR-MC-17)

| # | 검사 | 완료 조건 |
|---|------|----------|
| 1 | 토글 ON 시 목록 아래 요소(`footer` 등)의 `getBoundingClientRect().top` | 목록 높이 감소로 인한 위치 이동이 없다 |
| 2 | 토글 OFF 시 동일 요소 위치 | 복원 시 레이아웃 이동 없다 |

---

## 빌드 검증

| # | 명령 | 완료 조건 |
|---|------|----------|
| 1 | `pnpm build` | 성공 |
| 2 | SSR 산출물에 "모두 암기 표시되어 있습니다" 문구 없음 | `grep -r "모두 암기" build/` 결과 0건 |
| 3 | SSR 산출물에 `hidden` 클래스 `<li>` 없음 | `grep -r 'class="hidden"' build/anchors/` 결과 0건 |
| 4 | SSR 산출물에 모든 케이스 `<li>` 존재 | `build/anchors/[code]/index.html`에 기준 케이스 수만큼 `<li>` 태그 존재 |

---

## 완료 조건 종합

- [ ] `pnpm test:e2e tests/e2e/memorize-hide.spec.ts` 전체 통과
- [ ] `pnpm build` 성공
- [ ] SSR 산출물에 안내 문구 없음, 모든 `<li>` 존재, `hidden` 클래스 없음
- [ ] 토글 시 DOM 개수 불변 확인
- [ ] 레이아웃 점프 없음 확인
