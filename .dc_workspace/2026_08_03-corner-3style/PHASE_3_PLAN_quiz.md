# Phase 3 — 퀴즈

**담당**: FR-16 ~ FR-19
**완료 기준**: 큐브 없이 케이스를 출제받아 공식을 입력하고 판정을 받을 수 있다.

## 3-1. 출제 (FR-16)

`src/routes/quiz/+page.svelte`

- 378케이스에서 무작위 1건 출제. 케이스 코드와 두 타깃 위치를 보여준다
- 정답 알고리즘은 판정 전까지 DOM에 넣지 않는다 (개발자 도구로 보이지 않게)
- 출제 이력은 세션 메모리(`$state`)에만. localStorage 저장 없음 (SPEC 범위 제외)
- 직전 문제와 같은 케이스가 연속으로 나오지 않게만 처리한다

## 3-2. 무브 입력 (FR-17)

`src/lib/ui/MoveKeypad.svelte`

- 18버튼: `U L F R B D` × (정방향 / `'` / `2`)
- 배치: 6열 × 3행. 면(U L F R B D)이 열, 수식(none / ' / 2)이 행
- 하단 고정, 엄지 도달 범위. 버튼 최소 44×44px (터치 타겟)
- 되돌리기(마지막 무브 삭제), 전체 지우기
- 입력된 무브 열은 `Alg.svelte`로 실시간 표시 (고정폭·nowrap 재사용)
- 물리 키보드 병행 지원: `u l f r b d` 키 + `Shift`=prime, `2`=double은 **넣지 않는다**. 버튼만으로 충분하고 조합 규칙이 오히려 혼란

```ts
let moves = $state<string[]>([]);
function push(face: string, suffix: '' | "'" | '2') { moves.push(face + suffix); }
function undo() { moves.pop(); }
function clear() { moves = []; }
let alg = $derived(moves.join(' '));
```

무브 수 상한 200. 초과 시 더 이상 입력받지 않는다 (엣지케이스 18).

## 3-3. 판정 (FR-18)

`src/lib/domain/grade.ts` — 순수 함수. 시뮬레이터만 사용한다.

```ts
export type Verdict =
  | { kind: 'correct' }
  | { kind: 'edge-dirty'; cubies: Cubie[] }      // 코너는 맞고 엣지 오염
  | { kind: 'twist' }                            // 3큐비 위치는 맞고 방향 불일치
  | { kind: 'identity' }                         // 큐브가 안 바뀜
  | { kind: 'wrong'; identified: CaseCode | null };

export function grade(sim: CubeSim, target: CaseCode, alg: string): Verdict;
```

판정 순서:

1. `alg`가 비었거나 `moves.length === 0` → 제출 자체를 막는다 (UI에서 버튼 비활성)
2. 코너 상태를 계산. `isSolved(cornerState)` → `identity`
3. `identifyCase(alg) === target` 이고 `isEdgeNeutral(alg)` → `correct`
4. `identifyCase(alg) === target` 이지만 엣지 오염 → `edge-dirty`, `affectedCubies(edgeState,'edge')` 동봉
5. 영향받은 코너 큐비 집합이 정답과 같지만 `identifyCase`가 다름 → `twist`
6. 그 외 → `wrong`. `identifyCase(alg)` 결과를 함께 준다 (다른 케이스를 풀었다면 어느 것인지)

**`identifyCase`가 채점의 중심이다.** 데이터의 알고리즘 문자열과 비교하지 않으므로, 데이터에 없는 유효한 변형도 `correct`가 된다.

### 피드백 문구 (NFR-9: 사실만)

| Verdict | 문구 |
|---|---|
| `correct` | `정답` |
| `edge-dirty` | `코너는 맞지만 엣지를 건드립니다: {cubies}` |
| `twist` | `조각 위치는 맞지만 방향이 다릅니다` |
| `identity` | `큐브가 바뀌지 않았습니다` |
| `wrong` (identified 있음) | `{identified} 케이스를 푸는 공식입니다` |
| `wrong` (null) | `3-cycle이 아닙니다` |

격려·재도전 권유 문구를 넣지 않는다.

## 3-4. 정답 공개 (FR-19)

- 판정 후 direct / setup 알고리즘을 모두 표시 (`Alg.svelte` 재사용, 현재 notation 설정 반영)
- 조회 화면 링크 `/?c={code}`
- "다음 문제" 버튼

## 산출물

```
src/lib/ui/MoveKeypad.svelte
src/lib/domain/grade.ts
src/routes/quiz/+page.svelte
```

## 위험 요소

| 위험 | 대응 |
|---|---|
| `twist` 판정이 코너 방향만 다른 경우를 정확히 못 잡음 | 영향 큐비 집합 비교로 판정. 단위 테스트에서 실제 twist 케이스로 검증 |
| 정답이 DOM에 미리 들어가 있음 | 판정 전에는 렌더 자체를 하지 않는다 (`{#if graded}`) |
| 긴 입력에서 판정이 느려짐 | 200무브 상한. 시뮬레이터는 무브당 O(24)라 문제되지 않는다 |
