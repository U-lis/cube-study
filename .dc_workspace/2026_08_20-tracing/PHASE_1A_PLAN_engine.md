# Phase 1A — 트레이싱 엔진 (engine)

**담당**: FR-TR-4~13, 24, 25; NFR-TR-4
**병렬**: 1B(스크램블 워커)·1C(3D 뷰어)와 동시에 진행한다. 공유 파일이 없다 (GLOBAL §4.3).
**워크트리**: `../cube-study-feature-tracing-1A` / 브랜치 `feat/tracing-1A`

## 목표

이 페이즈가 끝나면:
- `src/lib/cube/trace.ts` 가 스크램블 상태에서 타깃 열을 뽑고, 사용자의 메모를 실행 모델로 채점한다
- 코너 회전 방향 상수가 cubejs 물리로 검증된다
- SPEC 검증 기준표의 **378/378, 500/500, 400/400, 관례 B 1475·1209·1134, 비틀림 표기 2053** 이
  전부 Vitest 로 재현된다
- 화면 코드는 한 줄도 만들지 않는다. 이 페이즈의 산출물은 순수 함수뿐이다

## 선행 조건

- `pnpm test` 가 통과 상태여야 한다 (기존 단위 테스트 포함)
- `pnpm build` 가 성공 상태여야 한다

## 대응 SPEC

| FR/NFR | 내용 |
|---|---|
| FR-TR-4 | 스크램블 상태 → 타깃 열. `CubeState` 를 그대로 입력으로 받는다 |
| FR-TR-5 | 끊고 들어간 사이클은 닫힐 때 타깃을 하나 더 친다 |
| FR-TR-6 | 제자리 비틀림을 끊기 후보에 그대로 포함. 비틀림 전용 분기 금지 |
| FR-TR-7 | 버퍼·조각 종류를 매개변수로 받는다. 상수 금지 |
| FR-TR-8 | 코너·엣지 모두 지원. `pieceKind` 만 바뀐다 |
| FR-TR-9 | 코너 스티커 회전 방향 순서를 별도 상수로 |
| FR-TR-10 | 채점은 실행 모델. 문자열 비교 금지 |
| FR-TR-11 | 부분 채점 — 첫 어긋난 지점. 방향까지 본다 |
| FR-TR-12 | 타깃 수 초과 = 불필요한 끊기 (오답 아님) |
| FR-TR-13 | 패리티 = 타깃 수 홀수 |
| FR-TR-24 | 관례 A/B 를 같은 엔진의 옵션으로 |
| FR-TR-25 | 비틀림 표기는 문자 하나 |
| NFR-TR-4 | 화면 없이 단위 테스트로 전부 검증 |

## 수정·생성할 파일

### `src/lib/cube/speffz.ts` (수정)

`CORNER_ROTATION: Record<Cubie, Sticker[]>` 을 추가한다. 각 코너의 스티커 3개를 **큐비 바깥에서 볼 때
시계방향** 한 방향으로 통일해 적는다.

현재 `CORNER_FACELETS`(`speffz.ts:41-44`)는 `UFL`(U,L,F)과 `DBL`(D,L,B) 둘만 나머지와 반대 방향이다
(GLOBAL AD-3 의 표). `CORNER_FACELETS` 자체는 **고치지 않는다** — 데이터의 삼중항 756개와 대조된
좌표이고(`tests/unit/speffz.test.ts`), `colorKey` 가 정렬해 쓰므로 순서가 무의미하다.

주석에 다음을 적는다:
- 왜 별도 상수인가 (`colorKey` 는 정렬하지만 트레이싱은 방향을 인덱스 차로 읽는다)
- 프로토타입 초기 라운드트립 0/260 의 원인이었다는 사실
- 이 상수가 맞는지는 우리가 주장하지 않고 cubejs 면회전으로 확인한다는 규율 (`sim.ts:4-13` 과 같은 취지)

파생 헬퍼도 여기 둔다:

| 이름 | 시그니처 | 역할 |
|---|---|---|
| `rotationOf` | `(kind: PieceKind) => Record<Cubie, Sticker[]>` | 코너는 `CORNER_ROTATION`, 엣지는 `EDGE_FACELETS` 순서에서 파생한 2칸 배열 |
| `cubieOf` | `(kind: PieceKind) => Record<Sticker, Cubie>` | 기존 `CORNER_CUBIE`/`EDGE_CUBIE` 선택 |
| `primaryAxisSticker` | `(kind, cubie) => Sticker` | 그 큐비에서 U/D 색 스티커의 **원래** 자리. 풀린 facelet 문자열에서 읽는다 |

`primaryAxisSticker` 는 색 이름을 코드에 박지 않는다 — 풀린 상태의 facelet 문자(`sim.ts:43`
`SOLVED_STRING`)가 U 면·D 면과 같은 값인지로 판단한다. 코너는 정확히 하나가 걸린다.
엣지는 걸리는 것이 0개(적도층)일 수 있으므로 엣지에는 쓰지 않는다 (FR-TR-25 가 엣지에 방향 표기를
요구하지 않는다).

### `src/lib/cube/sim.ts` (수정)

`permOf`(`sim.ts:68-91`)의 후반부 — facelet 문자열 → `CubeState` — 를 `stateFromFacelets(s, kind)` 로
분리해 export 한다. `permOf` 는 `cube.move(alg)` 후 이 함수를 부르는 형태가 된다. **동작은 바뀌지 않는다.**
기존 테스트(`tests/unit/sim.test.ts`, `data-regression.test.ts`)가 전부 그대로 통과해야 한다.

이 함수가 필요한 이유는 Phase 3 에서 워커가 준 `core` 와 3D 뷰어에 넘길 facelet 문자열을 **같은 원본**
하나에서 뽑기 위해서다. 알고리즘 문자열을 두 번 적용하면 원본이 둘이 된다.

### `src/lib/cube/trace.ts` (신규)

**엔진에 `'A'`·`'UBL'`·`'UF'` 같은 리터럴이 한 글자도 없어야 한다.** 기본값으로도 두지 않는다.
`sim.ts:157-160` 의 `identifyCase` 는 기본값에 버퍼가 박혀 있는데, 그 방식을 따라가지 않는다.

타입은 GLOBAL §3.1 을 그대로 쓴다.

#### 생성 — `trace(state, opts): TraceResult`

핵심 루프는 GLOBAL AD-4 의 의사코드다. σ = `state` 로 두면:

```
targets = []
visited = Set<Cubie>()            // 타깃으로 지목한 큐비
buffer  = Set(opts.bufferStickers)

// 1. 버퍼 사이클
T = σ(primarySticker)
while (T ∉ buffer) { push(T); visited.add(cubie(T)); T = σ(T) }

// 2~3. 끊기
while (남은 미해결 큐비가 있다) {
  B = pickBreakIn(candidates)     // 미해결·미방문·버퍼 아님 (+ 관례 B 면 제자리비틀림 제외)
  push(B); visited.add(cubie(B))
  T = σ(B)
  while (true) { push(T); visited.add(cubie(T)); if (cubie(T) === cubie(B)) break; T = σ(T) }
}
```

**정지 조건이 `T === B` 가 아니라 `cubie(T) === cubie(B)` 인 것이 이 페이즈의 전부다.**

- 길이 3짜리 일반 사이클 → `B, σB, σ²B, B` 로 타깃 4개. 마지막이 버퍼에 파킹해둔 조각의 회수다 (FR-TR-5).
- 제자리 비틀린 코너 → 스티커 순열이 같은 큐비 안의 3-사이클이므로 `B, σB` 에서 σB 가 이미 B 의 큐비 →
  타깃 **2개**. 실전 동작이 그대로 나온다 (FR-TR-6).

비틀림 전용 분기를 쓰지 않는다. `if (twisted)` 가 이 루프 안에 등장하면 설계 위반이다.

#### 관례 A/B — 끊기 후보 필터 하나

`twistConvention === 'B'` 면 후보에서 "제자리 비틀림 큐비"(큐비는 제자리인데 스티커 순열이 항등이 아닌
큐비)를 뺀다. 그 외 로직은 동일하다.

`twists` 는 **생성한 타깃 열을 실행하고 남은 잔여 상태** 에서 뽑는다 (GLOBAL AD-5). 초기 상태에서 뽑으면
버퍼 비틀림(코너 80.9% / 엣지 77%)이 목록에서 빠져 관례 B 검증 1475/1475 가 통과하지 않는다.

관례 A 에서는 `twists` 가 항상 빈 배열이다.

#### 비틀림 표기 — `twistLetter(state, cubie, opts): Sticker`

- 코너: `primaryAxisSticker` 로 그 큐비의 U/D 색 스티커의 원래 자리를 얻고, 잔여 상태에서 **그 스티커가
  지금 앉아 있는 자리** 의 문자를 돌려준다. 제자리 비틀림 상태는 둘뿐이라 문자 하나로 방향까지 특정된다.
- 엣지: 그 큐비의 두 문자 중 `EDGE_INDEX` 순서상 앞 문자로 정규화한다. 뒤집힘 상태가 하나뿐이라
  큐비 지목으로 충분하다 (FR-TR-25).
- 방향 마커(`K'`)를 만들지 않는다.

#### 실행 모델 — `applyTarget(state, t, opts): CubeState`

타깃 하나 = "지금 버퍼에 있는 조각과 타깃 자리의 조각을 맞바꾼다. 버퍼 조각의 primary 스티커가 `t` 자리에
오도록 방향을 맞춘다." 스티커 치환으로 표현하면 버퍼 큐비의 스티커 k개와 타깃 큐비의 스티커 k개를
회전 순서(`rotationOf`)에 맞춰 짝지어 교환하는 것이다. `CORNER_ROTATION` 이 여기서 쓰인다 — 순서가
어긋나면 방향이 틀어지고 라운드트립이 전부 깨진다.

`sim.ts` 의 `apply(state, alg)` 를 쓰지 않는다. 타깃 실행은 무브가 아니다 — 우리가 알고리즘을 모르는 채로
효과만 정의한다(SPEC "케이스 데이터에 의존하지 않는다"). 자체 큐브 물리를 들이는 것이 아니라, 스티커
치환 규칙 하나를 정의하는 것이다.

#### 채점 — `gradeMemo(state, input, opts): TraceVerdict`

타깃을 하나씩 적용하며 각 단계에서 판정한다 (GLOBAL AD-7 의 표).

| 상황 | 허용 | 아니면 |
|---|---|---|
| 버퍼 조각이 아직 갈 곳이 있다 | 그 조각의 목적지 스티커 하나뿐 (방향까지) | 큐비가 다르면 `wrong-piece`, 큐비는 맞고 스티커가 다르면 `wrong-orientation` |
| 버퍼 조각이 방금 제자리에 들어갔다 (사이클 닫힘) | 미해결·미방문 큐비의 아무 스티커 | 이미 해결·방문한 큐비면 `already-solved` |
| 어느 단계든 | 버퍼 스티커는 타깃이 될 수 없다 | `buffer-sticker` (HANDOFF §4.1) |

전부 적용한 뒤:
- 관례 A: 전부 풀렸으면 정답
- 관례 B: 남은 어긋남이 **전부 제자리 비틀림** 이고 사용자가 선언한 집합과 **정확히 일치** 하면 정답.
  버퍼 비틀림도 선언 대상에 포함한다 (GLOBAL AD-8). 불일치는 `twist-mismatch` 로 `missing`/`unexpected`
  를 함께 돌려준다
- 풀렸는데 타깃 수가 `trace()` 산출보다 많으면 `correct-extra` (FR-TR-12). 끊기 지점을 무작위로 골라도
  타깃 수는 불변이므로(400/400) "적음" 은 정답이 될 수 없다
- 안 풀렸으면 `incomplete` 에 남은 큐비 목록

**`trace()` 결과와 문자열 비교하는 코드를 쓰지 않는다.** 한 스크램블에 유효한 메모가 평균 11가지(최대 21)
있다 (FR-TR-10). 비교는 개수(`correct-extra` 판정) 한 곳에만 쓴다.

#### 패리티

`parity = targets.length % 2 === 1`. 관례와 무관하다 — 비틀림 하나가 타깃 2개라 홀짝이 안 바뀐다
(FR-TR-24). 근거는 HANDOFF.md §4.6 이다: M2 도 3-style 커뮤테이터도 EVEN 이라 ODD 순열을 못 품는다.

### `tests/unit/trace.test.ts` (신규) / `tests/unit/speffz.test.ts` (보강)

PHASE_1A_TEST.md 참조.

## 구현 순서

1. `speffz.ts` 에 `CORNER_ROTATION` 추가 → **먼저 검증 테스트(T1A-1)를 쓴다.** 여기가 틀리면 나머지가
   전부 조용히 틀린다
2. `sim.ts` 의 `stateFromFacelets` 분리 → 기존 테스트 전량 통과 확인
3. `trace.ts` 의 타입과 `applyTarget` (실행 모델) → 왕복 테스트로 방향 규약 확인
4. `trace()` 생성 루프 → 378 케이스 왕복(T1A-3)
5. 라운드트립 500 / 끊기 무작위 400 (T1A-4, T1A-5)
6. 버퍼·조각 교체 (T1A-6)
7. 관례 B + 비틀림 표기 (T1A-7, T1A-8)
8. `gradeMemo` (T1A-9)

## 완료 체크리스트

- [ ] `pnpm test` 전량 통과 (기존 테스트 포함, 회귀 0건)
- [ ] `pnpm exec tsc --noEmit` 오류 0건 / `pnpm check` 통과
- [ ] `pnpm build` 성공
- [ ] `grep -nE "'(A|E|R|C|M|J|UBL|UFR|UF|DF)'" src/lib/cube/trace.ts` 결과 0건 (FR-TR-7)
- [ ] `grep -n "corner-UBL\|loadDataset" src/lib/cube/trace.ts` 결과 0건 (케이스 데이터 비의존)
- [ ] `trace.ts` 에 Svelte / SvelteKit / localStorage import 0건 (NFR-TR-4)
- [ ] `trace.ts` 의 `twist` 언급이 관례 옵션 처리와 `twists` 산출 밖에 없다 (FR-TR-6)
- [ ] 378 케이스 왕복 **378/378**
- [ ] 무작위 상태 라운드트립 **500/500**
- [ ] 끊기 무작위 **400/400**, 타깃 수 불변
- [ ] 코너 UBL / 코너 UFR 양쪽에서 위 세 항목 통과 (엔진 코드 수정 없이 옵션만 교체)
- [ ] 엣지 UF / DF 양쪽에서 라운드트립·끊기 무작위 통과
- [ ] 관례 B — 코너 **1475/1475**, 엣지 **1209/1209 · 1134/1134**
- [ ] 비틀림 표기 — 제자리 비틀린 코너 **2053/2053** 이 문자 하나로 특정된다
- [ ] 평균 타깃 수가 SPEC 실측과 일치: 코너 UBL 8.13 / 코너 UFR 8.16 / 엣지 UF 12.23 / 엣지 DF 11.99 (±0.15)
- [ ] 홀수 타깃 비율 50±2% (비틀림 특례가 없다는 신호. 특례가 있으면 44.4% 로 떨어졌다)

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|---|---|
| `CORNER_ROTATION` 방향을 잘못 적음 | 상수보다 검증 테스트를 먼저 쓴다. cubejs 면회전 6개로 인덱스 보존을 확인한다 (T1A-1). 프로토타입 0/260 이 이것이었다 |
| 끊기 사이클 정지 조건을 스티커로 씀 | `cubie(T) === cubie(B)` 다. 스티커로 쓰면 비틀림이 4타깃이 되고 라운드트립이 168건 깨진다 |
| 비틀림 특례 분기 추가 | 홀수 타깃 비율 통계 테스트가 잡는다 (50.6% ↔ 44.4%) |
| 엔진에 버퍼 기본값을 넣음 | `TraceOptions` 의 `bufferStickers`/`primarySticker` 는 **필수** 필드다. optional 로 만들지 않는다 |
| 관례 B 의 `twists` 를 초기 상태에서 뽑음 | 잔여 상태에서 뽑는다. 버퍼 비틀림 80.9% 가 빠져 1475/1475 가 안 나온다 |
| 채점을 문자열 비교로 되돌림 | 정답이 평균 11가지다. 비교는 개수 판정 한 곳뿐 |
| `sim.ts` 리팩터가 기존 회귀를 깸 | `stateFromFacelets` 분리는 순수 추출이다. `data-regression.test.ts` 378 전수가 그대로 통과해야 한다 |
| 무브 물리를 저장소로 들여옴 | `applyTarget` 은 무브가 아니라 스티커 치환 규칙이다. 무브 테이블을 만들지 않는다 (README "무브 정의를 저장소로 다시 들여오지 말 것") |
