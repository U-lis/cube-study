# Phase 1 — 테스트 계획

## 테스트 커버리지 목표

≥ 70% (단위 테스트만. Phase 1은 UI가 없으므로 E2E 없음)

## 실행 명령

```bash
pnpm test                          # 전체 단위 테스트
pnpm test tests/unit/memorize.test.ts   # memorize만
pnpm build                         # 프리렌더 포함 빌드 검증
```

---

## 단위 테스트 (`tests/unit/memorize.test.ts`)

검증 대상 FR: FR-MC-1, 2, 5, 6, 7, 8, 12, 19

### T1-1. parseStored — 방어적 파싱 (FR-MC-7)

| # | 입력 | 기대 | 검증 FR |
|---|------|------|---------|
| 1 | `null` | `{ setup: new Set(), direct: new Set() }` | FR-MC-7 |
| 2 | `""` (빈 문자열) | 빈 상태 | FR-MC-7 |
| 3 | `"invalid json"` | 빈 상태 (throw 없음) | FR-MC-7 |
| 4 | `'{"schemaVersion":0,"checked":{"setup":["LB"],"direct":[]}}'` | 빈 상태 (버전 불일치) | FR-MC-7 |
| 5 | `'{"schemaVersion":2,"checked":{"setup":["LB"],"direct":[]}}'` | 빈 상태 (버전 불일치) | FR-MC-7 |
| 6 | `'{"checked":{"setup":["LB"],"direct":[]}}'` | 빈 상태 (schemaVersion 필드 없음) | FR-MC-7 |
| 7 | `'{"schemaVersion":1,"checked":{"setup":["LB","SC"],"direct":["LB"]}}'` | `setup: Set{LB, SC}`, `direct: Set{LB}` | FR-MC-6 |
| 8 | `'{"schemaVersion":1,"checked":{"setup":[],"direct":[]}}'` | 빈 Set 두 개 | FR-MC-6 |
| 9 | schemaVersion 이 `1`이고 `checked.setup`이 배열이 아닌 경우 | 빈 상태 | FR-MC-7 |

**완료 조건**: 모든 케이스가 `throw` 없이 완료되고 기대값과 일치한다.

### T1-2. serialize — round-trip (FR-MC-6)

| # | 입력 | 기대 | 검증 FR |
|---|------|------|---------|
| 1 | `{ setup: new Set(['SC', 'LB']), direct: new Set(['LB']) }` | JSON 파싱 후 `schemaVersion === 1`, `checked.setup`이 정렬된 배열 `['LB','SC']` | FR-MC-6 |
| 2 | `{ setup: new Set(), direct: new Set() }` | `checked.setup === []`, `checked.direct === []` | FR-MC-6 |
| 3 | `serialize(parseStored(serialize(checked))) === serialize(checked)` | round-trip 동일성 | FR-MC-6 |
| 4 | 출력 JSON에 `schemaVersion: 1` 포함 | true | FR-MC-6 |
| 5 | `setup` 배열이 정렬되어 있다 (`'LB' < 'SC'`) | true (삽입 순서 무관) | FR-MC-6 |

**완료 조건**: round-trip 테스트가 통과하고 정렬이 삽입 순서에 무관하다.

### T1-3. anchorProgress — 기준별 집계 (FR-MC-2, FR-MC-12)

데이터에서 기준 이름을 읽어 검증한다. 기준 이름을 테스트 코드에 하드코딩하지 않는다. `loadDataset`으로 실제 데이터를 로드해 사용한다.

| # | 입력 | 기대 | 검증 FR |
|---|------|------|---------|
| 1 | `setupChecked = new Set()` | Map의 모든 값이 `0` | FR-MC-12 |
| 2 | 케이스 1개를 `setupChecked`에 추가 | 해당 케이스의 `setup.anchor`에 해당하는 Map 엔트리가 `1` | FR-MC-12 |
| 3 | `Dataset.anchors`의 키 집합과 반환 Map의 키 집합이 일치한다 | true | FR-MC-2 |
| 4 | Map의 모든 값 합계 === `setupChecked.size` | true | FR-MC-12 |
| 5 | `directChecked`에 케이스를 추가해도 반환 Map 값이 변하지 않는다 (setup 전용 집계) | true | FR-MC-1 |
| 6 | 기준에 속하지 않는 케이스(직접 기준 등)가 있을 경우 해당 기준 키의 값이 정확히 집계된다 | Dataset의 해당 anchor 케이스 수와 일치 | FR-MC-12 |

**완료 조건**: 기준 이름 상수가 테스트 코드에 없고, `Dataset.anchors` 기반으로만 검증한다.

### T1-4. poolFor — 퀴즈 풀 필터 (FR-MC-19)

| # | 입력 | 기대 | 검증 FR |
|---|------|------|---------|
| 1 | `mode = 'setup'`, `checked.setup = Set{LB, SC}` | `['LB', 'SC']` (순서 무관, 배열) | FR-MC-19 |
| 2 | `mode = 'direct'`, `checked.direct = Set{LB}` | `['LB']` | FR-MC-19 |
| 3 | `mode = 'setup'`, `checked.setup = Set{}` | `[]` | FR-MC-20 (빈 pool) |
| 4 | `mode = 'direct'`, `checked.setup`에 항목이 있어도 `checked.direct`가 비면 | `[]` | FR-MC-1 (독립) |
| 5 | `mode = 'setup'`으로 호출해도 `checked.direct`가 변하지 않는다 | 부작용 없음 | FR-MC-1 |

**완료 조건**: mode에 따라 올바른 Set을 배열로 반환하고 다른 Set을 건드리지 않는다.

### T1-5. 역케이스 독립 (제약)

| # | 시나리오 | 기대 |
|---|----------|------|
| 1 | `toggle('setup', 'BF')` 후 `isChecked('setup', 'FB')` | `false` |
| 2 | `toggle('direct', 'BF')` 후 `isChecked('setup', 'BF')` | `false` (표기 독립) |
| 3 | `toggle('setup', 'BF')`, `toggle('setup', 'FB')` 모두 체크 후 `clearAll()` | 둘 다 `false` |

**완료 조건**: BF 체크가 FB에 어떤 영향도 주지 않는다. (SPEC 제약 "역케이스 자동 연동 없음")

---

## 빌드 검증

| # | 명령 | 완료 조건 |
|---|------|----------|
| 1 | `pnpm build` | 성공, 프리렌더 오류 0건 |
| 2 | `pnpm exec tsc --noEmit` | 타입 오류 0건 |
| 3 | `grep -rn "GC\|TC\|BU\|IV\|KS\|KG" src/lib/domain/memorize.ts` | 결과 0건 (기준 이름 하드코딩 없음) |
| 4 | `grep -rn "memorize" src/lib/ui/settings.svelte.ts` | 결과 0건 (분리 확인) |
| 5 | `grep -n "localStorage" src/lib/ui/memorize.svelte.ts` | 모든 행이 `if (browser)` 또는 `$effect()` 내부에 있다 |

---

## 완료 조건 종합

- [ ] `pnpm test` 통과 (기존 테스트 포함)
- [ ] `tests/unit/memorize.test.ts`의 T1-1 ~ T1-5 전체 통과
- [ ] `pnpm build` 성공 (프리렌더 포함)
- [ ] 기준 이름 하드코딩 grep 0건
- [ ] `memorize.ts`에 Svelte / SvelteKit import 없음
