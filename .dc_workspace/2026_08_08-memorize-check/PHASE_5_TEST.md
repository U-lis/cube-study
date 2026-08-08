# Phase 5 — 테스트 계획

## 테스트 커버리지 목표

≥ 70% (E2E 중심)

## 실행 명령

```bash
pnpm test:e2e tests/e2e/memorize-quiz.spec.ts
pnpm build
```

---

## E2E 테스트 (`tests/e2e/memorize-quiz.spec.ts`)

검증 대상 FR: FR-MC-18, 19, 20

테스트에서 특정 케이스 코드를 하드코딩하지 않는다. `addInitScript`로 주입하는 케이스 목록은 `loadDataset()`으로 읽은 데이터에서 선택한다.

### T5-1. 토글 존재 및 기본값 (FR-MC-18)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | localStorage 없는 상태에서 `/quiz` 접속 | "암기한 것만 출제" 토글이 존재하고 OFF 상태(`checked` 없음) |
| 2 | 토글 ON | `localStorage.getItem('quiz.memorizedOnly')` === `"true"` |
| 3 | 새로고침 | 토글이 ON 상태로 복원된다 |
| 4 | 토글 OFF | `localStorage.getItem('quiz.memorizedOnly')` === `"false"` |

### T5-2. 토글 OFF — 전체 출제 유지 (FR-MC-18)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `addInitScript`로 `checked.direct = [케이스A]` 주입, 토글 OFF 상태 | 첫 출제 케이스가 반드시 케이스A일 필요가 없다 (전체 pool) |
| 2 | 20회 "다음" 클릭 | 케이스A 외 케이스도 출제된다 |

### T5-3. direct 모드 토글 ON — pool 제한 (FR-MC-19)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `addInitScript`로 `quizInput = 'direct'`, `checked.direct = [케이스A, 케이스B, 케이스C]` 주입 | — |
| 2 | `/quiz` 접속 후 토글 ON | "암기 표시한 공식이 없습니다" 안내가 없다 |
| 3 | "다음" 30회 클릭 | 출제된 케이스 집합이 `[케이스A, 케이스B, 케이스C]` 안에만 있다 |
| 4 | 출제 케이스 코드 확인 | 주입 목록 밖의 코드가 0건 |

### T5-4. quizInput 전환 시 pool 갱신 (FR-MC-19)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `checked.direct = [케이스D]`, `checked.setup = [케이스E, 케이스F]` 주입, `quizInput = 'direct'`, 토글 ON | 출제 pool이 `[케이스D]` |
| 2 | `quizInput`을 `'setup'`으로 전환 | 출제 pool이 `[케이스E, 케이스F]`로 즉시 전환 (케이스D가 나오지 않음) |
| 3 | `quizInput`을 다시 `'direct'`로 전환 | 출제 pool이 `[케이스D]`로 복원 |

### T5-5. 암기 케이스 0개 — 안내 표시, fallback 없음 (FR-MC-20)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | `checked.direct = []`, `quizInput = 'direct'` 주입, 토글 ON | "암기 표시한 공식이 없습니다" 안내가 표시된다 |
| 2 | 문제 UI 확인 | 현재 출제 케이스 UI가 없다 (`current === null`) |
| 3 | "다음" 버튼 클릭 가능 여부 | 클릭해도 케이스가 출제되지 않거나 버튼이 비활성화되어 있다 |
| 4 | 전체 케이스 fallback 확인 | 안내 없이 임의 케이스가 출제되지 않는다 |
| 5 | `checked.direct`에 케이스 1개를 직접 localStorage에 추가 후 새로고침 | 안내가 사라지고 해당 케이스가 출제된다 |

### T5-6. memorizedOnly 도중 변경 → next() 재호출 (FR-MC-18, 19)

| # | 단계 | 완료 조건 |
|---|------|----------|
| 1 | 토글 OFF 상태에서 pool 밖 케이스가 현재 문제로 출제된 상태 | — |
| 2 | 토글 ON | `pool.length > 0`이면 즉시 다음 문제로 이동 (pool 안 케이스가 출제됨) |
| 3 | 토글 ON 시 `pool.length === 0`이면 | 안내가 표시된다 |

---

## 빌드 검증

| # | 명령 | 완료 조건 |
|---|------|----------|
| 1 | `pnpm build` | 성공 |
| 2 | 퀴즈 화면에 "암기한 것만 출제" 관련 체크박스 존재 | 빌드 산출물 확인 (퀴즈는 SSR 범위 밖이지만 JS 번들 포함) |

---

## 완료 조건 종합

- [ ] `pnpm test:e2e tests/e2e/memorize-quiz.spec.ts` 전체 통과
- [ ] 30회 출제가 모두 주입 목록 안에서만 나오는 케이스가 0건 위반
- [ ] pool이 0개일 때 안내가 표시되고 전체 fallback이 없음 확인
- [ ] `pnpm build` 성공
