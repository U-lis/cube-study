# M2 엣지 — GLOBAL

SPEC: `SPEC.md`. 이 문서는 구현 전체에 걸친 아키텍처 결정과 단계 분할이다.

---

## 아키텍처 결정 (AD)

### AD-1 `faceletsOf` 를 `sim.ts` 에 추가하고 `permOf` 를 내부화한다

`export function faceletsOf(alg: string): string` — cubejs `asString()` 을 래핑한다.
알 수 없는 무브는 `Error("Unknown move: X")` 형식으로 던진다 (기존 `permOf` 와 같다).
`permOf` 는 `stateFromFacelets(faceletsOf(alg), kind)` 로 다시 쓰고 `export` 를 제거한다.

### AD-2 채점은 54칸 문자열 비교

`gradeM2(entered: string, alg: string): M2Verdict` — `faceletsOf(entered)` 와
`faceletsOf(alg)` 를 비교한다. 센터 포함 54칸이므로 다른 순서의 동치 공식도 정답이다.
다른 행과 같은 상태면 `{ kind: 'other', label }` 를 돌려준다.

### AD-3 `MoveKeypad` 에 `extraRows` prop 을 추가한다

`extraRows?: readonly (readonly string[])[]` — 기본값 `[]`. 각 행을 `repeat(len, 1fr)` 그리드로 렌더한다.
버튼은 `data-move={token}`. 기존 호출부는 변경 없다.

M2 퀴즈만 `[["M","M'","M2"],["l","l'","r","r'"]]` 를 넘긴다.

### AD-4 라우트는 `/3x3/bld/m2/edge/{lookup,quiz}`

`/3x3/bld/m2` 와 `/3x3/bld/m2/edge` 는 네임스페이스 — 화면 없음 (SPEC D-1).

### AD-5 서랍 그룹 레이블 `'M2 엣지'`

`nav.ts` 의 `MENU_3BLD` 에 `{ group: '/3x3/bld/m2/edge', label: 'M2 엣지' }` 를 추가한다.
3-style 코너 뒤, 트레이싱 앞. `GROUP_LABELS` 덮어쓰기는 없다 (SPEC D-2; 조회=lookup 기본 라벨 그대로).

### AD-6 About 의 "암기 전체 해제" 는 `m2.clearAll()` 도 부른다

`memorize.clearAll()` 과 함께 호출한다 (SPEC D-7). 두 단계 확인 흐름은 그대로 둔다.

### AD-7 M2 퀴즈 입력 모드는 직접 입력 하나뿐

`SegToggle` / `AnchorPad` 없음. 문제가 나오면 바로 자판이 보인다.

### AD-8 출제는 `pickNext` 재사용, 역케이스 없음

`inverseOf` 기본값(`undefined`)으로 호출한다. 역쌍 제외 없음 (SPEC FR-M2-Q-5).

### AD-9 홀짝은 데이터가 결정한다

짝수 번째 행은 데이터에 따로 적혀 있다. `itemsOf(ds)` 는 27개 항목을 데이터 순서로 돌려준다.
코드가 홀짝을 보고 행을 바꾸지 않는다 (SPEC FR-M2-D-5).

### AD-10 원리 설명은 `<details>` (기본 접힘)

조회 표 아래. 내용 (SPEC FR-M2-L-2):
- 교환은 M2 하나 (DF↔UB-A)
- 셋업은 원하는 스티커를 A 자리로 가져오는 것
- 방향이 맞는 스티커(U/D/F/B 면 색이 U/D/F/B 면에 있음) → U 면 무브, 아닌 것 → B 면 무브
- H·N 은 B 면 위 → l / r 와이드 무브
- M 슬라이스 스티커는 전용 공식
- M2 마다 M 슬라이스 180° — 짝수 번째에서 C↔W, I↔S 공식 교체 (A·Q 무관)
- 홀수 개수 → 패리티 공식 → UB↔UL 교환만 남음 (코너 패리티가 처리)

---

## 단계 분할

순차 3단계.

| Phase | 이름 | 내용 | 상태 |
|-------|------|------|------|
| 1 | core | `sim.ts` `faceletsOf`; 드래프트 `m2.ts`·`m2.svelte.ts` 커밋; 단위 테스트 | Pending |
| 2 | ui | `MoveKeypad` extraRows; `nav.ts` 추가; 홈 FEATURES; About 수정; 조회·퀴즈 페이지 | Pending |
| 3 | docs | `SVELTE.md` 라우트 표; `README.md` M2 데이터 주석; `CONVENTIONS.md` (필요 시) | Pending |

## 검사 명령

```bash
pnpm check && pnpm test && pnpm test:e2e
```

## 하지 않는 것

SPEC 의 Out of Scope 그대로. 버전 올리기·태그·`release.sh` 는 사용자 승인 사항.
CHANGELOG·CONTINUE 는 docs-update 단계에서 처리한다 (Phase 3 에서 손대지 않는다).
