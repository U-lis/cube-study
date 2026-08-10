# Phase 6 — 테스트 계획

## 테스트 커버리지 목표

≥ 70% (E2E 중심)

## 실행 명령

```bash
pnpm test:e2e tests/e2e/memorize-clear.spec.ts
pnpm build
```

---

## E2E 테스트 (`tests/e2e/memorize-clear.spec.ts`)

검증 대상 FR: FR-MC-21, 22

### T6-1. 버튼 존재 및 위치 (FR-MC-21)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | About 모달 열기 | "암기 표시 전체 해제" 버튼이 존재한다 |
| 2 | 버튼 위치 확인 | "업데이트 확인" 버튼보다 아래에 위치한다 (`getBoundingClientRect().top` 비교) |
| 3 | 버튼 높이 | `getBoundingClientRect().height >= 44` |

### T6-2. 2단계 확인 흐름 (FR-MC-22)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | "암기 표시 전체 해제" 첫 클릭 | 버튼 텍스트가 "정말 해제합니다"로 변경된다 |
| 2 | "정말 해제합니다" 버튼의 높이 | `getBoundingClientRect().height >= 44` |
| 3 | "정말 해제합니다" 클릭 | `localStorage.getItem('memorize.checked')`를 파싱하면 `checked.setup === []`, `checked.direct === []` |
| 4 | 실행 후 버튼 상태 | "암기 표시 전체 해제" (idle) 상태로 복원된다 |

### T6-3. 브라우저 confirm() 미사용 (FR-MC-22)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `page.on('dialog', ...)` 리스너 등록 후 버튼 클릭 시퀀스 전체 실행 | `dialog` 이벤트가 발생하지 않는다 |

### T6-4. 모달 닫기 → idle 리셋 (FR-MC-22)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | "암기 표시 전체 해제" 클릭 → "정말 해제합니다" 상태 | 버튼이 confirming 상태 |
| 2 | 모달 닫기 (ESC 또는 닫기 버튼) | 모달이 닫힌다 |
| 3 | 모달 다시 열기 | 버튼이 "암기 표시 전체 해제" (idle) 상태다 |
| 4 | 2초 이상 대기 없이 바로 재열기 | 여전히 idle 상태 (리셋이 `onclose`에서 즉시 실행) |

### T6-5. 전체 해제 실행 결과 (FR-MC-21)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `addInitScript`로 `checked.setup = [케이스A, 케이스B]`, `checked.direct = [케이스A]` 주입 | — |
| 2 | About 모달에서 2단계 확인 후 실행 | `localStorage.getItem('memorize.checked')` 파싱 결과 `setup === []`, `direct === []` |
| 3 | 모달 닫기 후 `/anchors` 방문 | 모든 기준 카드 진도가 `0/{전체}` |
| 4 | `/anchors/[code]` 방문 | 체크박스가 모두 unchecked. 진도가 `0/{전체}` |

### T6-6. 첫 클릭 후 취소 — 실행 안 됨

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `addInitScript`로 체크 데이터 주입 | — |
| 2 | "암기 표시 전체 해제" 클릭 → confirming 상태 | — |
| 3 | 모달 닫기 (실행 안 함) | localStorage `checked.setup`이 여전히 주입 목록을 유지한다 |

---

## 빌드 검증

| # | 명령 | 완료 조건 |
|---|------|----------|
| 1 | `pnpm build` | 성공 |
| 2 | `grep -n "confirm(" src/lib/ui/About.svelte` | 결과 0건 (브라우저 `confirm()` 미사용) |

---

## 완료 조건 종합

- [ ] `pnpm test:e2e tests/e2e/memorize-clear.spec.ts` 전체 통과
- [ ] 브라우저 `confirm()` 미사용 확인 (grep 0건)
- [ ] 2단계 확인 흐름 정상 동작
- [ ] 모달 닫기 후 idle 리셋 확인
- [ ] 전체 해제 후 `checked.setup`, `checked.direct` 모두 빈 배열 확인
- [ ] `pnpm build` 성공
