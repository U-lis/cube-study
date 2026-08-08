# Phase 1 — 테스트 계획

## 단위 테스트

### T1-1. 시뮬레이터 데이터 회귀 (1134건)

`tests/unit/data-regression.test.ts` — 378케이스 × (direct, setup, 역트릭)

| # | 검사 | 기대 |
|---|---|---|
| 1 | `identifyCase(direct.alg) === caseCode` | 378/378 |
| 2 | `identifyCase(setup.alg) === caseCode` | 378/378 |
| 3 | `isEdgeNeutral(alg)` (direct, setup 양쪽) | 756/756 |
| 4 | `moveCount(alg) === moves` | 756/756 |
| 5 | `identifyCase(cancelMoves(invertAlg(direct.alg))) === inverse` | 378/378 |

**합계 1134건 통과. 하나라도 실패하면 이식이 잘못된 것이다.**

### T1-2. v2 파생 필드 검증 (5292건)

`tests/unit/data-v2.test.ts`

| # | 검사 | 기대 |
|---|---|---|
| 1 | `identifyCase(strict.alg) === caseCode` (direct/setup) | 756/756 |
| 2 | `isEdgeNeutral(strict.alg)` | 756/756 |
| 3 | `cancelMoves(strict.alg) === alg` | 756/756 |
| 4 | `strict.moves`, `strict.cancels` 정합 | 756/756 |
| 5 | `sameAlg === (direct.alg === setup.alg)` | 378/378 |
| 6 | `aSelfInverse === (invertAlg(A) === A)`, B도 동일 | 756/756 |
| 7 | `inverseTrick.direct` / `.setup` 값 정합 | 756/756 |
| 8 | setup.alg 뒤집기가 역케이스를 푸는가 | 378/378 |

### T1-3. 표기 유틸

| # | 입력 | 기대 |
|---|---|---|
| 1 | `invertAlg("R U R' U'")` | `"U R U' R'"` |
| 2 | `invertAlg("B' D2 B")` | `"B' D2 B"` (self-inverse) |
| 3 | `cancelMoves("R R' U")` | `"U"` |
| 4 | `cancelMoves("F' F' U")` | `"F2 U"` |
| 5 | `cancelMoves("R U U' R'")` | `""` (완전 소거) |
| 6 | `moveCount("")` | `0` |

### T1-4. 시뮬레이터 경계

| # | 입력 | 기대 |
|---|---|---|
| 1 | `apply(solved, "Z")` | `throw Error("Unknown move: Z")` |
| 2 | `apply(solved, "")` | solved 그대로 |
| 3 | `apply(solved, "M2")` | 슬라이스 무브가 동작 (엣지 상태 변화) |
| 4 | `identifyCase("R R'")` | `null` (3-cycle 아님) |
| 5 | `identifyCase("R U R' U'")` | `null` (코너 3-cycle 아님 — 엣지도 건드림) |
| 6 | `isEdgeNeutral("R U R' U'")` | `false` |
| 7 | `isEdgeNeutral("R D2 R' U R D2 R' U'")` | `true` (LB) |

### T1-5. 데이터 로더

| # | 검사 | 기대 |
|---|---|---|
| 1 | `loadDataset({pieceType:'corner', buffer:'UBL'})` | 378케이스 Dataset |
| 2 | `meta.schemaVersion` | `2` |
| 3 | 두 번 호출 시 동일 객체 참조 (캐시) | `toBe` 통과 |
| 4 | `loadDataset({pieceType:'edge', buffer:'UBL'})` | 명확한 오류 throw |
| 5 | `Object.keys(cases).length` | `378` |
| 6 | `Object.keys(anchors).length` | `10` |
| 7 | anchors count 합 + `(직접)` 6 | `378` |
| 8 | 호출부가 `DatasetKey`만 넘기고 파일 경로를 모름 (NFR-6) | `loader.ts` 외 소스에 `corner-UBL` 문자열 부재 |

## 빌드 검증

| # | 명령 | 기대 |
|---|---|---|
| 1 | `npm run build` | 성공, `build/index.html` 생성 |
| 2 | `npx tsc --noEmit` | 타입 오류 0 |
| 3 | `npm test` | 전체 통과 |

## 완료 조건

- [ ] `npm test` 통과 (데이터 회귀 6426건 포함)
- [ ] `npx tsc --noEmit` 오류 0
- [ ] `npm run build` 성공
- [ ] `src/lib/data/corner-UBL.json`이 handoff 원본과 바이트 동일
- [ ] `src/lib/cube/perms.json`이 handoff 원본과 바이트 동일
