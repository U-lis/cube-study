# Phase 1 — 코어 (`faceletsOf` · 도메인 · 드래프트 커밋)

GLOBAL AD-1, AD-2, AD-8, AD-9. SPEC FR-M2-D-1~6, Section 2 검증.

## 만들 것

### 1. `src/lib/cube/sim.ts` — `faceletsOf` 추가

- `export function faceletsOf(alg: string): string` 를 추가한다.
  내부에서 `new Cube().move(alg).asString()` 를 호출한다.
  알 수 없는 무브가 있으면 cubejs 가 예외를 던지는데, 메시지를 `"Unknown move: X"` 형식으로
  맞춰 re-throw 한다 (기존 `permOf` 의 에러 형식과 같다).
- 기존 `export function permOf` 의 본문을 `stateFromFacelets(faceletsOf(alg), kind)` 로 교체하고
  `export` 키워드를 제거한다. 외부 참조가 없으면 그대로 두어도 되나, `sim.ts` 공개 API 를 줄이기 위해 제거한다.
  내부에서만 쓰인다면 `private` 대신 함수를 파일 스코프로 내린다.

### 2. `src/lib/domain/m2.ts` — 드래프트 완성 및 커밋

파일이 이미 워킹트리에 있다 (`src/lib/domain/m2.ts`). 아래 인터페이스를 확인하고 없는 것을 채운다.

```ts
// 필수 export
export type M2Verdict =
  | { kind: 'correct' }
  | { kind: 'other'; label: string }   // 다른 행의 공식과 상태가 같음
  | { kind: 'identity' }               // 항등 (아무것도 안 친 것과 같음)
  | { kind: 'wrong' }
  | { kind: 'invalid-move'; move: string };

export interface M2Item {
  id: string;          // 행 식별자 (e.g. 'a', 'c2', 'parity')
  letter: string;      // 표시 문자 (대문자, e.g. 'A')
  place: string;       // placeText (e.g. 'DF↔UB')
  order: 'odd' | 'even' | 'parity';
  alg: string;         // 공식 문자열
}

export function itemsOf(ds: M2DataSet): M2Item[];   // 27개, 데이터 순서
export function gradeM2(enteredAlg: string, targetAlg: string, allItems: M2Item[]): M2Verdict;
```

`gradeM2` 구현:
1. `faceletsOf(enteredAlg)` 를 try-catch — 예외 시 `{ kind: 'invalid-move', move: ... }`.
2. `faceletsOf(targetAlg)` 와 같으면 `{ kind: 'correct' }`.
3. `faceletsOf` 결과가 항등(solved facelet 문자열)이면 `{ kind: 'identity' }`.
4. `allItems` 를 돌며 `faceletsOf(item.alg)` 와 같은 게 있으면 `{ kind: 'other', label: item.letter }`.
5. 없으면 `{ kind: 'wrong' }`.

### 3. `src/lib/ui/m2.svelte.ts` — 드래프트 확인 및 커밋

파일이 이미 워킹트리에 있다 (`src/lib/ui/m2.svelte.ts`). 아래 사항을 확인한다.

- `$state` 로 `memorizedOnly` · `checked` (Set) 를 관리한다.
- `$effect.root` 로 localStorage 자동 저장 (`m2.quiz.memorizedOnly`, `m2.checked`).
- `clearAll()` 은 도메인에 두지 않는다. 저장소를 비우는 것은 `m2.svelte.ts` 의 `clearAll()` 이다 (`memorize` 와 같은 분담, 검증 단계에서 바로잡음)

## 새 테스트 파일

### `tests/unit/m2-domain.test.ts`

| # | 검사 | 기대 |
|---|---|---|
| D-1 | `itemsOf(ds)` 개수 | 27 |
| D-2 | `itemsOf(ds)` 의 각 행: `faceletsOf(item.alg)` 가 DF 버퍼 스티커와 타깃 스티커를 교환하고 M2 부수효과(C↔W, I↔S, 센터 180°)를 남긴다 | 각 행 pass |
| D-3 | 각 행: 코너 조각은 무영향 | 전 행 pass |
| D-4 | 패리티 행: 효과가 UB↔UL 교환 + 센터 복원 (1506판 확인) | pass |
| D-5 | `gradeM2` 정답 케이스 | `{ kind: 'correct' }` |
| D-6 | `gradeM2` 다른 행과 같은 상태 | `{ kind: 'other', label: ... }` |
| D-7 | `gradeM2` 항등 | `{ kind: 'identity' }` |
| D-8 | `gradeM2` 완전히 다른 공식 | `{ kind: 'wrong' }` |
| D-9 | `gradeM2` 알 수 없는 무브 | `{ kind: 'invalid-move', ... }` |
| D-10 | parse/serialize 라운드트립 | 복원 가능 |
| D-11 | 깨진 JSON | 기본값으로 복구 |
| D-12 | 버전 불일치 | 기본값으로 복구 |

### `tests/unit/m2-rotation.test.ts`

B 면 공식(회전 없는 버전)과 원래 x-rotation 공식의 54칸 상태가 같은지 확인한다.

| 행 | 원래 공식 | B 면 공식 (데이터) |
|----|-----------|-------------------|
| M  | `x' U' R U M2 U' R' U x`  | B 면 변환값 |
| E  | `x' U L' U' M2 U L U' x`  | B 면 변환값 |
| P  | `x' U' R2 U M2 U' R2 U x` | B 면 변환값 |
| F  | `x' U L2 U' M2 U L2 U' x` | B 면 변환값 |
| O  | `x' U' R' U M2 U' R U x`  | B 면 변환값 |
| G  | `x' U L U' M2 U L' U' x`  | B 면 변환값 |

검사: 양쪽 `faceletsOf(alg)` 가 같다.

### `tests/unit/m2-solve.test.ts`

시드 고정 PRNG (mulberry32, seed 42). ~300 무작위 25-무브 스크램블.

각 스크램블에서:
1. DF 버퍼로 타깃 열을 추출한다 (추상 교환: u↔target, k↔mate; 새 사이클 시작 조건: 첫 미해결 조각의 첫 스티커).
2. 데이터 행을 순서대로 친다. C·W·I·S 는 짝수 위치이면 `${letter}2` 행 id 로 찾는다.
3. 짝수 개수 → 엣지·센터·코너 전부 풀린다.
4. 홀수 개수 + 패리티 공식 → UB↔UL (스티커 a↔d, q↔e) 만 교환, 센터·코너 풀린다.

보조 함수 `solve.mjs` 경로:
`/tmp/claude-1000/-home-ulismoon-Documents-cube-study/a5cc5837-92de-4906-a64a-76710ae4d0e3/scratchpad/m2/solve.mjs`
— 테스트 전용 헬퍼다. **앱 코드에 복사하지 않는다.** `stateFromFacelets` 를 사용해도 된다.

## 순서

1. `sim.ts` 수정 → `pnpm check` 통과 확인.
2. `m2.ts` 드래프트 검토·수정 → 테스트 파일 작성 → `pnpm test` 통과.
3. `m2.svelte.ts` 드래프트 검토·수정.
4. 커밋 (`sim.ts`, `m2.ts`, `m2.svelte.ts`, 테스트 3개).

## 완료 체크리스트

- [x] `sim.ts` 에 `faceletsOf` export 있음 — Verified in src/lib/cube/sim.ts:96
- [x] `permOf` 가 `faceletsOf` 를 내부적으로 사용하고 export 없음 — Verified in src/lib/cube/sim.ts:109
- [x] `m2.ts` 에 `itemsOf`, `gradeM2` export 있음 (clearAll 은 UI 스토어 쪽)
- [x] `m2.svelte.ts` 에 `memorizedOnly`, `checked`, `clearAll` 있음 — Verified in src/lib/ui/m2.svelte.ts
- [x] `tests/unit/m2-domain.test.ts` 전체 통과 — 695/695 tests passed
- [x] `tests/unit/m2-rotation.test.ts` B 면 공식 6개 모두 통과 — 695/695 tests passed
- [x] `tests/unit/m2-solve.test.ts` ~300 스크램블 통과 — 695/695 tests passed
- [x] `pnpm check && pnpm test` 초록 — 0 errors, 695 passed

## 주의사항

- `solve.mjs` 는 테스트 헬퍼 전용이다. 앱 코드에 복사하지 않는다.
- 무브 정의는 cubejs 가 한다. 저장소에 별도 무브 표를 만들지 않는다.
- 데이터 JSON 의 알고리즘 문자열을 코드가 수정하지 않는다.
