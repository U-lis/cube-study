# Phase 2 TEST — OP 코어

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `itemsOf(ds)` 가 22개를 반환한다 | unit | [x] |
| Y 행 공식: 코너 UBL↔DFR + 엣지 UB↔UL(facelet 37·46) 교환만 낸다 | unit | [x] |
| 21 타깃 행 전수: UBL↔타깃 코너 교환만, 엣지·센터는 Y 단독과 같다 | unit | [x] |
| 각 행의 setup 에 U/B/L 무브가 없다 | unit | [x] |
| `gradeOp` 정답 (같은 상태, 다른 순서 포함) | unit | [x] |
| `gradeOp` 다른 행과 같은 상태 → `other` | unit | [x] |
| `gradeOp` 항등 → `identity` | unit | [x] |
| `gradeOp` 완전히 다른 공식 → `wrong` | unit | [x] |
| `gradeOp` 알 수 없는 무브 → `invalid-move` | unit | [x] |
| `parseOpChecked` / `serializeOpChecked` 라운드트립 | unit | [x] |
| 깨진 JSON 로드 시 빈 Set 으로 복구 | unit | [x] |
| schemaVersion 불일치 시 빈 Set 으로 복구 | unit | [x] |
| `expandY` 가 `[Y]` 를 yPerm 으로 치환한다 | unit | [x] |
| 시드 고정 ~100 스크램블: 짝수 타깃 → 전체 풀림 | unit | [x] |
| 시드 고정 ~100 스크램블: 홀수 타깃 → UB↔UL(37·46) 만 남음 | unit | [x] |

## 이 Phase 에서 실제로 해당하는 경계 케이스

- Y 행: `isYRow: true`, setup 빈 문자열, `alg` 는 yPerm 그대로.
- P 행: `isYRow` 없음, setup 빈 문자열, `alg` 는 yPerm (P↔A 교환 = `[Y]` 단독).
- `gradeOp` 에 빈 문자열 입력 → `identity`.
- `expandY` 에 `[Y]` 없는 문자열 → 원본 그대로 반환.
