# Phase 2 — OP 코어 (`op-core`)

GLOBAL AD-1~AD-7. SPEC FR-OP-D-1~5.

## 전제

- Phase 1 완료 (`pnpm check && pnpm test && pnpm test:e2e` 초록).

## 만들 것

### 1. `src/lib/data/corner-UBL-op.json`

22행 + meta. 구조는 GLOBAL AD-4 의 스키마를 따른다.

- `meta.yPerm`: `"R U' R' U' R U R' F' R U R' U' R' F R"`
- `meta.source`: `"사용자 PDF op_corners.pdf (2026-10-29, 비공개)"`
- `rows[0]`: `{ "id": "y", "letter": "Y", "setup": "", "isYRow": true }`
- 나머지 21행: SPEC FR-OP-D-5 표의 setup 값을 그대로 사용한다.
  코드가 setup 값을 수정하거나 생성하지 않는다.

setup 표 (SPEC FR-OP-D-5):

| 문자 | id | setup |
|------|----|-------|
| B | b | `R D'` |
| C | c | `F` |
| D | d | `F R'` |
| F | f | `F2` |
| G | g | `D2 R` |
| H | h | `D2` |
| I | i | `F' D` |
| J | j | `F2 D` |
| K | k | `D R` |
| L | l | `D` |
| M | m | `R'` |
| N | n | `R2` |
| O | o | `R` |
| P | p | `` (빈 문자열) |
| Q | q | `R' F` |
| S | s | `D' R` |
| T | t | `D'` |
| U | u | `F'` |
| V | v | `D' F'` |
| W | w | `D2 F'` |
| X | x | `D F'` |

### 2. `src/lib/domain/op.ts`

아래 인터페이스를 export 한다.

```ts
export type OpVerdict =
  | { kind: 'correct' }
  | { kind: 'other'; label: string }
  | { kind: 'identity' }
  | { kind: 'wrong' }
  | { kind: 'invalid-move'; move: string };

export interface OpItem {
  id: string;       // 예: 'b', 'y'
  letter: string;   // 표시 문자 대문자 (예: 'B', 'Y')
  piece: string;    // 자리 텍스트 (예: 'UBL↔DFR')
  setup: string;    // 데이터의 setup 문자열
  isYRow: boolean;
  alg: string;      // 완성된 공식 문자열
}

export interface OpDataSet { meta: ...; rows: ...[]; }

export function itemsOf(ds: OpDataSet): OpItem[];
// 22개 항목, Y 행 맨 위. alg 계산:
//   Y 행: yPerm (expandY 시 [Y] → yPerm 으로 치환하는 공식)
//   P 행: yPerm (setup 빈 문자열이므로 "[Y]" → yPerm)
//   나머지: `${setup} [Y] ${invertAlg(setup)}`.trim()

export function expandY(alg: string, yPerm: string): string;
// alg 안의 "[Y]" 를 yPerm 으로 모두 치환한 문자열을 반환한다.

export function displayPartsOf(
  item: OpItem,
  yPerm: string
): { text: string; role: 'plain' | 'anchor' }[];
// setup 이 있으면 [{setup, plain}, {[Y], anchor}, {setup', plain}]
// setup 이 없으면 [{[Y], anchor}]

export function gradeOp(
  entered: string,
  item: OpItem,
  allItems: OpItem[],
  yPerm: string
): OpVerdict;
// expandY(entered, yPerm) → faceletsOf → item.alg 와 비교 → verdict

export function opVerdictText(v: OpVerdict): string;
// 사실 문구만. 백분율·격려 없음.

export function parseOpChecked(raw: string | null): Set<string>;
export function serializeOpChecked(checked: Set<string>): string;
```

`itemsOf` 세부:
- Y 행의 `alg` 는 `yPerm` (자체가 Y-perm 공식).
- P 행의 `alg` 는 `yPerm` (setup 빈 문자열 → `"" + [Y] + ""` 펼치면 yPerm).
- 나머지 행: `[setup, '[Y]', invertAlg(setup)].filter(Boolean).join(' ')`.
- `invertAlg` 는 `src/lib/cube/notation.ts:22` 를 사용한다.

`gradeOp` 구현:
1. `expandY(entered, yPerm)` → try `faceletsOf` — 예외 시 `{ kind: 'invalid-move', move }`.
2. `expandY(item.alg, yPerm)` → `faceletsOf` 와 비교 → 같으면 `{ kind: 'correct' }`.
3. 항등(solved facelet) → `{ kind: 'identity' }`.
4. `allItems` 순회 → 같은 상태가 있으면 `{ kind: 'other', label: item.letter }`.
5. 없으면 `{ kind: 'wrong' }`.

### 3. `src/lib/ui/op.svelte.ts`

`src/lib/ui/m2.svelte.ts` 패턴을 복사한다.

- `$state` 로 `memorizedOnly` (boolean), `checked` (Set<string>) 관리.
- `$effect.root` 로 localStorage 자동 저장: 키 `op.quiz.memorizedOnly`, `op.checked`.
  `schemaVersion: 1`.
- `clearAll()` : `checked` 를 빈 Set 으로, `memorizedOnly` 를 false 로 초기화하고 저장소를 비운다.

## 새 테스트 파일

### `tests/unit/op-domain.test.ts`

| # | 검사 | 기대 |
|---|------|------|
| D-1 | `itemsOf(ds)` 개수 | 22 |
| D-2 | Y 행: `faceletsOf(item.alg)` 가 코너 UBL↔DFR + 엣지 UB↔UL(facelet 37·46) 교환만 낸다 | pass |
| D-3 | 21 타깃 행 전수: `setup [Y] setup'` 가 UBL ↔ 타깃 코너 교환만 한다. 바뀌는 코너 UBL + 타깃 둘뿐, 엣지·센터는 Y 단독과 같다 | 전 행 pass |
| D-4 | 각 행의 setup 에 U/B/L 무브가 없다 | 전 행 pass |
| D-5 | `gradeOp` 정답 — 같은 상태, 다른 순서 공식 포함 | `{ kind: 'correct' }` |
| D-6 | `gradeOp` 다른 행과 같은 상태 | `{ kind: 'other', label }` |
| D-7 | `gradeOp` 항등 | `{ kind: 'identity' }` |
| D-8 | `gradeOp` 완전히 다른 공식 | `{ kind: 'wrong' }` |
| D-9 | `gradeOp` 알 수 없는 무브 | `{ kind: 'invalid-move' }` |
| D-10 | `parseOpChecked` / `serializeOpChecked` 라운드트립 | 복원 가능 |
| D-11 | 깨진 JSON / schemaVersion 불일치 | 빈 Set 으로 복구 |
| D-12 | `expandY` 가 `[Y]` 를 yPerm 으로 치환한다 | pass |

### `tests/unit/op-solve.test.ts`

시드 고정 PRNG, ~100 무작위 스크램블.

각 스크램블에서:
1. UBL 버퍼로 타깃 열을 추출한다 (기존 trace 로직 재사용 가능).
2. 데이터 행을 순서대로 친다.
3. 짝수 개수 → 코너·엣지·센터 전부 풀린다.
4. 홀수 개수 → UB↔UL(facelet 37·46) 만 교환, 나머지 풀린다.

보조 헬퍼는 테스트 전용이다. 앱 코드에 복사하지 않는다.

## 순서

1. `corner-UBL-op.json` 작성.
2. `op.ts` 작성 → `pnpm check`.
3. `op-domain.test.ts` 작성 → `pnpm test` 통과.
4. `op-solve.test.ts` 작성 → `pnpm test` 통과.
5. `op.svelte.ts` 작성 → `pnpm check`.
6. `pnpm check && pnpm test` 전체 초록.

## 완료 체크리스트

- [ ] `corner-UBL-op.json` 22행 + meta 작성 완료
- [ ] `op.ts` 에 `itemsOf`, `gradeOp`, `expandY`, `displayPartsOf`, `opVerdictText`, `parseOpChecked`, `serializeOpChecked` export 있음
- [ ] `op.svelte.ts` 에 `memorizedOnly`, `checked`, `clearAll` 있음
- [ ] `op-domain.test.ts` D-1~D-12 통과
- [ ] `op-solve.test.ts` ~100 스크램블 통과
- [ ] `pnpm check && pnpm test` 초록

## 주의사항

- 데이터 JSON 의 setup 값을 코드가 수정하거나 생성하지 않는다.
- `invertAlg` 는 `src/lib/cube/notation.ts:22` 를 사용한다. 직접 구현하지 않는다.
- `faceletsOf` 는 `src/lib/cube/sim.ts` 에 있다.
- 무브 정의는 cubejs 가 한다. 저장소에 별도 무브 표를 만들지 않는다.
