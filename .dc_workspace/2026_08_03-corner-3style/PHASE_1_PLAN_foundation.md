# Phase 1 — 기반 (스캐폴딩 · 데이터 · 시뮬레이터)

**담당**: FR-1, FR-2, FR-13, FR-14, FR-15, NFR-6
**완료 기준**: 화면은 없지만 `npm test`가 데이터 회귀 6426건을 통과한다.

## 1-1. 프로젝트 스캐폴딩

```bash
npx sv create . --template minimal --types ts --no-install
npm i -D @sveltejs/adapter-static vitest @playwright/test @vite-pwa/sveltekit
npm i -D @testing-library/svelte jsdom
npm install
```

- 워크트리 루트에 직접 생성한다. `.dc_workspace/`, `LICENSE`, `README.md`, `.gitignore`가 이미 있으므로 덮어쓰지 않도록 주의한다
- `svelte.config.js`: `adapter-static`, `prerender.entries` 기본값 사용
- `+layout.ts`에 `export const prerender = true`
- `tsconfig.json`: `strict: true`

**확인**: `npm run build`가 성공하고 `build/index.html`이 생성된다.

## 1-2. 자산 이식

| 원본 | 대상 |
|---|---|
| `.dc_workspace/handoff/3style_ubl_data.v2.json` | `src/lib/data/corner-UBL.json` |
| `.dc_workspace/handoff/sim/cube_perms.json` | `src/lib/cube/perms.json` |

**복사이며 편집하지 않는다.** 원본과 바이트 동일해야 한다.

## 1-3. 타입 정의 (FR-2)

`src/lib/domain/types.ts` — schemaVersion 2 스키마를 그대로 반영한다.

```ts
export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
export type Sticker = string;   // 'A'..'X'
export type Cubie = string;     // 'UBL', 'DFR' ...
export type CaseCode = string;  // 2글자
export type AlgType = 'pure' | 'conj';
export type AnchorName = string; // 'LB' | ... | '(직접)'

export interface Target { sticker: Sticker; cubie: Cubie; face: Face; }
export interface StrictInfo { alg: string; moves: number; cancels: number; }
export interface DirectStrict extends StrictInfo { aSelfInverse: boolean; bSelfInverse: boolean; }

export interface DirectAlg {
  alg: string; moves: number; type: AlgType;
  A: string; B: string; S: string;
  strict: DirectStrict;
}
export interface SetupAlg {
  alg: string; moves: number; anchor: AnchorName; S: string;
  strict: StrictInfo;
}
export interface CaseEntry {
  case: CaseCode; target1: Target; target2: Target;
  direct: DirectAlg; setup: SetupAlg;
  inverse: CaseCode; sameAlg: boolean;
  inverseTrick: { direct: boolean; setup: boolean };
}
export interface Anchor {
  alg: string; moves: number; count: number;
  entry1: Target; entry2: Target;
}
export interface Dataset {
  meta: { buffer: Cubie; bufferStickers: Sticker[]; primarySticker: Sticker;
          scheme: string; totalCases: number; schemaVersion: number;
          colorScheme: Record<Face, string>; };
  stickers: Record<Sticker, { cubie: Cubie; face: Face }>;
  anchors: Record<AnchorName, Anchor>;
  cases: Record<CaseCode, CaseEntry>;
}
```

`ANCHOR_DIRECT = '(직접)'` 상수를 함께 export 한다. 문자열 리터럴을 코드 곳곳에 박지 않는다.

## 1-4. 데이터 로더 (FR-1)

`src/lib/data/loader.ts`

```ts
export type PieceType = 'corner' | 'edge';
export interface DatasetKey { pieceType: PieceType; buffer: string; }

export async function loadDataset(key: DatasetKey): Promise<Dataset>
```

- 0.1.0은 `{pieceType:'corner', buffer:'UBL'}`만 지원. 그 외 키는 명확한 오류를 던진다
- 내부에서 동적 `import()`로 청크를 분리한다
- 결과를 모듈 스코프에 캐시해 재호출 시 재파싱하지 않는다 (NFR-1)
- **NFR-6(확장성)이 여기서 확정된다.** 시그니처가 굳으면 UFR·엣지 추가 시 `loader.ts` 내부만 바뀌고 호출부는 손대지 않는다

## 1-5. 시뮬레이터 이식 (FR-13, FR-14)

`src/lib/cube/sim.ts` — `handoff/sim/cube-sim.js`를 TS로 옮긴다.

**규약을 바꾸지 않는다:**
- 상태: `Record<Sticker, Sticker>` = `{위치: 그_위치에_있는_원래_스티커}`
- 적용: `next[pos] = st[table[pos]]`
- `perms.json`의 테이블에는 역치환이 이미 적용되어 있다

이식할 API:

| 함수 | 용도 |
|---|---|
| `solvedCorners()` / `solvedEdges()` | 초기 상태 |
| `apply(state, alg, kind)` | 알고리즘 적용. 미지 토큰은 `throw` |
| `isSolved(state)` | 풀림 여부 |
| `movedStickers(state)` | 움직인 스티커 |
| `affectedCubies(state, kind)` | 영향받은 큐비 (FR-18 오염 엣지 표시) |
| `isEdgeNeutral(alg)` | 엣지 무영향 |
| `identifyCase(alg, opts)` | **케이스 역판정. 퀴즈 채점의 핵심** |

`src/lib/cube/notation.ts` — `invertAlg`, `cancelMoves`, `moveCount`를 그대로 옮긴다.

지원 무브는 27종(`U L F R B D` + `M E S` 슬라이스 × 3). 0.1.0 UI는 18종만 노출하지만 시뮬레이터는 전부 받는다.

## 1-6. 테스트 하네스 (FR-15)

`vitest.config.ts` 설정 후 아래 두 스위트를 만든다.

- `tests/unit/data-regression.test.ts` — `handoff/sim/test_sim.mjs` 재현 (1134건)
- `tests/unit/data-v2.test.ts` — `handoff/sim/test_v2.mjs` 재현 (5292건)

두 스위트는 **이식한 `sim.ts`를 사용한다.** 원본 `cube-sim.js`를 import 하면 이식 검증이 되지 않는다.

`package.json`에 `"test": "vitest run"` 추가.

## 산출물

```
svelte.config.js, vite.config.ts, tsconfig.json, vitest.config.ts
src/lib/data/{corner-UBL.json, loader.ts}
src/lib/cube/{perms.json, sim.ts, notation.ts}
src/lib/domain/types.ts
tests/unit/{data-regression.test.ts, data-v2.test.ts}
```

## 위험 요소

| 위험 | 대응 |
|---|---|
| 이식 중 무브 적용 규약을 뒤집음 | 1-6 테스트가 즉시 실패한다. `bld_sim.py`를 참고하지 않는다 |
| `sv create`가 기존 파일을 덮어씀 | 실행 전 `git status`로 정결 확인, 실행 후 `git diff`로 기존 파일 변경 여부 확인 |
| JSON import 시 타입 추론 폭발 | `import(...)` 결과를 `as Dataset`으로 단언하고 `resolveJsonModule`만 켠다 |
