<!-- dotclaude-config
working_directory: .dc_workspace
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-tracing
doc_dir: 2026_08_20-tracing
-->

# 트레이싱 훈련 - 아키텍처 및 전역 설계

SPEC.md 의 FR-TR-1~25 / NFR-TR-1~6 을 구현하기 위한 아키텍처 결정과 페이즈 분해.

**목표 버전**: 0.5.0
**대상 이슈**: #25 (트레이싱 훈련), #13 (3D 뷰어), #22 (스크램블 생성)

---

## 1. 기능 개요

| 항목 | 내용 |
|------|------|
| 목적 | 스크램블을 보고 타깃 열을 뽑아내는 **트레이싱** 을 실물 큐브 없이 훈련한다 |
| 문제 | 지금 앱은 "케이스 `FU` 의 알고리즘" 은 알려주지만 "스크램블에서 `FU` 를 알아내는 것" 은 다루지 않는다. 실전 메모의 대부분이 이 작업이다 |
| 해결 | 랜덤 스테이트 스크램블 → 3D 큐브 표시 → 사용자가 타깃 열 입력 → 실행 모델로 채점 |
| 핵심 제약 | 채점은 문자열 비교가 아니다(정답 평균 11가지). 엔진에 버퍼·조각 상수가 없다. 뒷면이 회전 없이 새지 않는다 |

기존 기능(조회·기준공식·퀴즈·암기 체크)은 건드리지 않는다. 트레이싱은 `/trace` 라우트 하나와
`src/lib/cube/` 아래 신규 모듈로 들어간다.

---

## 2. 아키텍처 결정

### AD-1. 트레이싱 엔진은 순수 함수, 버퍼는 매개변수 (FR-TR-7, NFR-TR-4)

`src/lib/cube/trace.ts` 신설. 시그니처:

```ts
trace(state: CubeState, opts: TraceOptions): TraceResult
```

`TraceOptions` 는 `{ pieceKind, bufferStickers, primarySticker, twistConvention, pickBreakIn }` 이다.
`'A'`·`'UBL'`·`'UF'` 같은 리터럴이 `trace.ts` 에 한 글자도 없어야 한다.

근거: 프로토타입이 코드 수정 없이 데이터 교체만으로 코너 UBL / UFR 양쪽에서 378/378 을 냈다(SPEC FR-TR-7).
버퍼 정보의 출처는 데이터셋 `meta` 하나이며 스키마에 이미 자리가 있다 —
`src/lib/domain/types.ts:143-148` 의 `DatasetMeta.buffer` / `bufferStickers` / `primarySticker`.
`sim.ts:157-160` 의 `identifyCase` 가 이미 같은 방식(기본값은 호출부가 아니라 옵션)으로 쓰고 있으나
그쪽은 기본값에 `'A'`/`'UBL'` 이 박혀 있다 — **`trace.ts` 는 기본값조차 두지 않는다.**

대안 기각: 데이터셋 객체 자체를 엔진에 넘기기 — 엔진이 케이스 데이터에 의존하게 되고(SPEC 제약 "케이스
데이터에 의존하지 않는다"), 엔진 단위 테스트가 5MB JSON 로드를 매번 끌고 온다. `TraceOptions` 는
테스트에서 리터럴 4줄로 만들 수 있어야 한다.

### AD-2. 상태 표현은 `CubeState` 를 그대로 쓴다 (FR-TR-4)

새 상태 표현을 만들지 않는다. `src/lib/cube/sim.ts:35` 의 `CubeState = Record<Sticker, Sticker>`
(위치 → 그 자리에 온 스티커의 원래 자리)가 트레이싱 입력으로 그대로 쓰인다.

다만 지금은 `permOf(alg, kind)` 가 **알고리즘 문자열** 에서만 상태를 만든다(`sim.ts:68-91`).
Worker 가 내놓는 것은 스크램블 문자열이므로 `sim.applyToCorners(sim.solvedCorners(), core)` 로 충분하지만,
54칸 facelet 문자열에서 바로 상태를 만드는 경로도 필요하다(3D 뷰어와 상태를 같은 원본에서 뽑기 위해).
`permOf` 의 후반부(facelet 문자열 → `CubeState`)를 `stateFromFacelets(s, kind)` 로 분리해 export 한다.
동작은 바뀌지 않는다 — 순수 리팩터다.

### AD-3. 코너 회전 방향 순서를 상수로 추가한다 (FR-TR-9)

`speffz.ts` 의 `CORNER_FACELETS`(`src/lib/cube/speffz.ts:41-44`)는 큐비 8개 중 **`UFL` 과 `DBL` 두 개가
나머지와 반대 회전 방향** 이다. 나열 순서를 면으로 풀면 이렇다:

| 큐비 | 면 순서 (현재 데이터) | 일관 방향인가 |
|---|---|---|
| `UBL` | U L B | ✅ |
| `UBR` | U B R | ✅ |
| `UFR` | U R F | ✅ |
| `UFL` | U **L F** | ❌ (일관이면 U F L) |
| `DFL` | D L F | ✅ |
| `DFR` | D F R | ✅ |
| `DBR` | D R B | ✅ |
| `DBL` | D **L B** | ❌ (일관이면 D B L) |

지금 코드는 `colorKey` 가 정렬해버려(`sim.ts:46-50`) 무해하지만, 방향을 인덱스 차이로 읽는 트레이싱은
여기서 깨진다. 프로토타입 초기 라운드트립 0/260 의 원인이다(SPEC FR-TR-9).

`speffz.ts` 에 `CORNER_ROTATION: Record<Cubie, Sticker[]>` 을 추가한다. 방향 정의는 "큐비 바깥에서 볼 때
시계방향" 하나로 통일한다. 이 상수가 맞는지는 **cubejs 로 검증한다** — 면 4분회전 6개 각각에 대해
"회전 전 큐비의 i번째 스티커가 회전 후 큐비의 i번째 스티커로 간다" 가 성립해야 한다(PHASE_1A_TEST T1A-1).
우리가 물리를 적어두는 것이 아니라, 우리가 적은 순서를 cubejs 의 물리로 확인하는 구조다
(`sim.ts:4-13`, README "무브의 물리는 우리가 안 들고 있다" 와 같은 규율).

`CORNER_FACELETS` 자체는 고치지 않는다. 색 조합 식별(`colorKey`)은 정렬하므로 순서가 무의미하고,
데이터의 `target1`/`target2` 삼중항 756개와 대조된 좌표(`tests/unit/speffz.test.ts`)를 흔들 이유가 없다.

엣지는 스티커가 2개라 회전 순서 문제가 없다 — `EDGE_FACELETS` 는 그대로 쓴다.

### AD-4. 사이클 추적의 정지 조건은 **스티커가 아니라 큐비** 다 (FR-TR-5, FR-TR-6)

엔진의 핵심 루프 하나가 FR-TR-5(끊고 들어간 사이클의 추가 타깃)와 FR-TR-6(제자리 비틀림)을 동시에
설명한다. σ = `state` 라 할 때:

```
1. 버퍼 사이클:  T ← σ(primary)
                 σ(T) 가 bufferStickers 에 들 때까지 T 를 뱉고 T ← σ(T)
                 (버퍼 조각이 집에 들어가면 손이 빈다. 뱉지 않고 끝낸다)

2. 끊기:         미해결·미방문 큐비의 스티커 B 를 고른다  ← pickBreakIn
                 B 를 뱉는다
                 T ← σ(B) 부터 뱉으며 진행하되,
                 **뱉은 T 가 B 와 같은 큐비의 스티커면 거기서 멈춘다**   ← FR-TR-5

3. 미해결 큐비가 남아 있으면 2 로 돌아간다
```

정지 조건이 "`T === B`" 가 아니라 "`T` 가 `B` 의 큐비" 인 것이 전부다.

- 길이 3짜리 일반 사이클: `B, σB, σ²B, B` → 타깃 4개 (= 사이클 길이 + 1). 마지막 `B` 가 버퍼에
  파킹해둔 조각의 회수다. 이걸 빼면 메모를 실행해도 안 풀린다(프로토타입 라운드트립 실패 168건).
- 제자리 비틀린 코너: 스티커 순열이 같은 큐비 안의 3-사이클이므로 `B, σB` 에서 σB 가 이미 B 의 큐비다
  → 타깃 **2개**. 실전에서 비틀림을 문자 2개로 먹는 동작이 그대로 재현된다.

즉 비틀림 전용 분기가 없다. 엔진에 `if (twisted)` 가 등장하면 설계 위반이다.

### AD-5. 비틀림 관례 A/B 는 **끊기 후보 필터** 하나로 갈린다 (FR-TR-24)

`twistConvention: 'A' | 'B'` 옵션은 AD-4 의 2단계에서 후보 집합만 바꾼다.

| | 끊기 후보 | 결과 |
|---|---|---|
| A (기본) | 미해결·미방문 큐비 전부 | 비틀림이 타깃 열에 흡수된다 |
| B | 위에서 **제자리 비틀림 큐비를 뺀다** | 비틀림이 남는다 → `twists` 목록으로 보고 |

`twists` 는 초기 상태가 아니라 **생성한 타깃 열을 실행하고 남은 잔여 상태** 에서 뽑는다. 버퍼가 비틀린 채
남는 경우(코너 80.9% / 엣지 77%, SPEC FR-TR-24)를 규칙 하나로 담기 위해서다 — 방향 합이 보존되므로
다른 비틀림을 남기면 버퍼가 보정을 떠안는다. 초기 상태에서 뽑으면 버퍼 비틀림이 목록에서 빠진다.

패리티(FR-TR-13)는 `targets.length % 2 === 1` 이며 관례와 무관하다. 비틀림 하나가 타깃 2개라 홀짝이
안 바뀐다(SPEC FR-TR-24, 코너·엣지 전 표본 일치).

### AD-6. 끊기 지점 선택은 주입 함수로 뺀다 (FR-TR-10, 검증표 400/400)

`pickBreakIn?: (candidates: Sticker[]) => Sticker`. 기본값은 `candidates[0]`(Speffz 문자 순).

근거: "끊기 지점을 무작위로 20회 골라도 전부 유효하고 타깃 수가 같다 400/400" 을 단위 테스트로
재현하려면 선택을 밖에서 흔들 수 있어야 한다. `quiz.ts:55-59` 의 `pickNext(..., rand)` 와 같은 규율이다 —
난수를 안에서 부르면 테스트가 확률에 기대게 된다(`quiz.ts:16-17`).

### AD-7. 채점은 실행 모델이며 단계별로 판정한다 (FR-TR-10, 11, 12)

`trace.ts` 가 생성기와 함께 실행 모델을 갖는다. 타깃 하나 = "지금 버퍼에 있는 조각과 그 자리의 조각을
맞바꾼다".

```ts
applyTarget(state, t, opts): CubeState        // 타깃 하나 적용
gradeMemo(state, input, opts): TraceVerdict   // 전체 채점
```

단계 판정 규칙:

| 상황 | 허용되는 타깃 |
|---|---|
| 버퍼에 든 조각이 아직 갈 곳이 있다 | 그 조각의 목적지 스티커 **하나뿐** (방향까지) |
| 버퍼 조각이 제자리에 들어간 직후 (사이클 닫힘) | 미해결·미방문 큐비의 **아무 스티커** |

방향을 안 보면 채점이 성립하지 않는다 — 378 = 42 큐비쌍 × 9 방향이고, 세 번째 조각의 방향이 강제되어
27이 아니라 9다(HANDOFF.md §4.3). 큐비만 맞고 스티커가 틀린 입력은 오답이며, 어긋난 **첫 지점** 을
인덱스로 짚는다(FR-TR-11).

최종 판정:

| Verdict | 조건 |
|---|---|
| `correct` | 실행 후 전부 풀림(A) 또는 남은 어긋남이 선언한 비틀림 집합과 정확히 일치(B) |
| `correct-extra` | 위를 만족하되 타깃 수가 엔진 산출보다 많음 → 불필요한 끊기 (FR-TR-12, 오답 아님) |
| `wrong-at` | 인덱스 i 에서 어긋남 + 사유 |
| `incomplete` | 입력이 끝났는데 안 풀림 |
| `twist-mismatch` | 관례 B 에서 선언한 비틀림 집합이 잔여와 다름 |
| `invalid-letter` | 버퍼 스티커·조각 종류 불일치·미지 문자 |

타깃 수가 스크램블이 정한 값보다 **적을** 수는 없다(끊기 지점을 무작위로 골라도 타깃 수 불변, 400/400).
그래서 `correct-extra` 는 "많음" 한 방향만 본다.

### AD-8. 비틀림 표기는 U/D 스티커가 앉은 자리의 문자 (FR-TR-25)

- **코너**: 그 큐비의 U 색 또는 D 색 스티커가 **지금 앉아 있는 자리** 의 Speffz 문자를 쓴다. 코너는
  U/D 색 스티커를 정확히 하나 가지며 제자리 비틀림 상태는 둘뿐이라 문자 하나로 방향까지 특정된다
  (제자리 비틀린 코너 2053건 전부 특정 가능, SPEC FR-TR-25).
  "어느 스티커가 U/D 색인가" 는 풀린 facelet 문자열에서 읽는다(`sim.ts:43` 의 `SOLVED_STRING`).
  색 이름을 코드에 박지 않는다.
- **엣지**: 제자리 뒤집힘은 상태가 하나뿐이므로 큐비를 지목하면 된다. 표시는 `EDGE_INDEX` 순서상
  앞 문자로 정규화하고, **입력은 그 큐비의 두 문자를 모두 받는다**(같은 큐비로 정규화해 비교).
- 버퍼 비틀림도 같은 규칙으로 적힌다. 버퍼 스티커 문자는 타깃 열에 나올 수 없어 충돌하지 않는다
  (HANDOFF.md §4.1).
- 방향 마커(`K'`)를 쓰지 않는다.

**채점은 버퍼 항목을 포함한 완전 일치를 요구한다.** FR-TR-24 가 "비틀림 목록에 버퍼가 포함될 수 있어야
한다" 고 명시했고, 버퍼가 80.9% 확률로 비틀린 채 남는 이상 이것을 빼면 관례 B 훈련의 절반이 사라진다.
결과 화면은 버퍼 비틀림을 별도로 표시해 "왜 이게 목록에 있는가" 를 설명한다.

### AD-9. 스크램블 Worker 의 수명은 화면의 수명이다 (FR-TR-1, 2, NFR-TR-1)

```
/trace 진입 → Worker 생성 → initSolver()  (실측 1695ms, heap +37MB, RSS +102MB)
            → ready 통지 → 스크램블 8개 선생성해 큐에 적재
소비될 때마다 → 1개 보충 요청 (생성 실측 27ms)
/trace 이탈 → worker.terminate()  → 메모리 통째 반납
```

**Worker 를 쓰는 이유는 번들 크기가 아니다.** `solve.js` 는 gzip 7.1KB 다(SPEC NFR-TR-1). 이유는 둘이다 —
(1) 메인 스레드 1.7초 블로킹 회피, (2) 화면을 벗어날 때 100MB 반납. 조회·퀴즈만 쓰는 사용자가 그
메모리를 떠안으면 안 된다.

따라서 **`solve.js` 코드가 메인 청크에 섞이는 것은 허용한다.** 금지 대상은 메인 스레드에서의
`initSolver()` 호출 하나뿐이다. 구현은 Vite 표준 패턴이면 충분하다:

```ts
new Worker(new URL('./scramble.worker.ts', import.meta.url), { type: 'module' })
```

수동 청크 분할·설정 트릭·번들 후처리를 넣지 않는다. `cubejs` 자체 async API(`lib/async.js`)도 쓰지
않는다 — `window.Worker` 와 워커 URI 를 전제하므로 우리가 워커를 직접 짜는 편이 짧다.

기존 앱 코드는 계속 `cubejs/lib/cube.js` 를 직접 가리킨다(`src/lib/cube/cubejs.d.ts:1-6`). 이유가
번들 크기에서 "풀이기를 안 쓴다" 로 바뀔 뿐, 가리키는 대상은 그대로다. 워커만 패키지 진입점(`cubejs`)을 쓴다.

준비 전에 요청이 오면 화면은 "준비 중" 을 표시한다(FR-TR-2).

### AD-10. `{ scramble, core }` 규약을 지금 지킨다 (FR-TR-3)

Worker 는 `{ scramble, core }` 를 함께 낸다. 지금은 `Cube.random().solve()` 의 뒤집기에 방향 회전이
섞이지 않아 두 값이 같지만, 규약을 지금 만들어두지 않으면 나중에 wide/rotation 을 붙일 때
`asString()` 배치가 틀어져 타깃이 통째로 어긋난다.

- `scramble` — 표시용
- `core` — 상태 계산용. `sim.applyToCorners/Edges` 에 넣는 쪽은 **항상 `core`** 다.

이번 범위에서 방향 무작위화는 스크램블에 붙이지 않고 카메라 각도로 대체한다(FR-TR-17).

### AD-11. 3D 뷰어는 프레임워크 무관 모듈 + 얇은 Svelte 래퍼 (FR-TR-14~16, NFR-TR-2, 6)

- `src/lib/cube/cube3d.ts` — `three` 를 쓰는 뷰어 본체. Svelte 를 import 하지 않는다.
  `createCubeView(canvas, opts)` 가 `{ setFacelets, setHighlights, setOrientation, resize, dispose }` 를 돌려준다.
- `src/lib/ui/Cube3D.svelte` — `onMount` 안에서 `await import()` 로 `cube3d.ts` 를 부르고 캔버스만 넘긴다.

`three` 지연 로드는 이 동적 import 하나로 끝난다(NFR-TR-2). `loader.ts:53-57` 의 `loadAlternatives` 와
같은 방식이다. `three` 가 초기 청크에 없다는 것은 빌드 산출물로 확인한다.

이슈 #13 의 결론을 그대로 따른다:

| 결정 | 내용 |
|---|---|
| 라이브러리 | `three` 직접 조립. `cubing.js` 는 면별 임의 색이 안 되어 탈락 |
| 지오메트리 | 큐비마다 `BoxGeometry`, 면별 material 6개. 순서는 **`+X -X +Y -Y +Z -Z`** |
| material | **mask 별 캐시 금지.** 큐비마다 색이 다르므로 공유하면 한 큐비를 칠할 때 다른 큐비가 같이 바뀐다 |
| 조작 | `OrbitControls` + damping |

렌더 루프는 `three` 가 돈다 — NFR-TR-6 이 명시한 예외다. 그 외 상태는 전부 `$state` 로 다룬다.

### AD-12. 뷰어 API 는 "무슨 색을 어디에" 만 받는다 (FR-TR-16, 22)

```ts
setFacelets(colors: string[])          // 54칸. 전 면 회색도 이 경로 (FR-TR-22)
setHighlights(marks: (Mark|null)[])    // 54칸. 버퍼 / 현재 타깃 / 지나간 조각
```

뷰어는 버퍼도 타깃도 트레이싱도 모른다. 무엇을 어떤 색으로 칠할지는 화면(Phase 5)이 정한다.
지나간 조각은 개수가 계속 늘어나므로(코너 평균 8 + 엣지 평균 12) 강조는 **개수 제한 없는 배열** 이다.

색 값은 데이터셋 `meta.colorScheme`(`types.ts:150`)에서 읽는다. 색을 코드에 박지 않는다.

`Mark` 는 색과 **테두리 종류** 를 함께 갖는다 — 하이라이트를 색으로만 구분하지 않는다(FR-TR-16).
테두리는 스티커 면 위에 얹는 `EdgesGeometry` 라인으로 그린다.

**힌트 스티커·반투명·미니맵·전개도 보조 표시를 이 화면에 두지 않는다(FR-TR-15).** 뒷면 정보가
회전 없이 새어나가면 훈련하려는 기술 자체가 사라진다. 이 금지는 Phase 5 의 E2E 로 못을 박는다.

### AD-13. 기록은 암기 체크와 키·스키마를 분리한다 (제약)

`src/lib/domain/memorize.ts:51` 의 `parseStored` 는 `schemaVersion` 불일치 시 저장물을 **전부 버린다.**
같은 키에 얹으면 트레이싱 스키마를 올릴 때 암기 진도가 날아간다.

- 키: `"trace.records"` (암기 체크는 `"memorize.checked"`)
- 스키마 버전: 독립. `trace.records` 의 `schemaVersion` 은 1 부터 시작한다
- 보관 상한: 최근 50건. 초과분은 오래된 것부터 버린다

저장 필드는 `{ at, ms, pieceKind, buffer, mode, twistConvention, targetCount, correct }` 다.

**`twistConvention` 은 설계 검토 후 SPEC 에 추가됐다.** 관례가 타깃 수를 평균 2.4개 바꾸므로 이 값이
없으면 기록끼리 비교가 성립하지 않는다 — `buffer` 를 넣는 것과 같은 논리다. 나중에 넣으면 스키마 v2
마이그레이션이 되고 그때 쌓인 기록이 위태로워진다. 솔브 레코드·약점 통계·추이 그래프는 이번 범위 밖이다(#23).

### AD-14. `/trace` 는 프리렌더를 유지하고 요소 개수를 고정한다

`src/routes/+layout.ts` 가 `prerender = true` 다. `/trace` 도 예외를 두지 않는다 — 예외를 만들면
`adapter-static`(`strict: true`, `vite.config.ts`)의 검사가 갈라진다.

Worker 생성과 `three` 로드는 전부 `onMount`(브라우저) 안이므로 프리렌더는 통과한다. 다만 이 저장소가
이미 두 번 밟은 함정이 있다(`.dc_workspace/2026_08_08-memorize-check/GLOBAL.md` AD-4,
`src/routes/+page.svelte:33-46`):

> **SSR 과 CSR 렌더의 요소 구성·개수·크기가 동일하고, 값만 나중에 채운다.**

| 요소 | SSR 초기 | CSR |
|---|---|---|
| 3D 캔버스 | 고정 종횡비 자리(회색) | 같은 자리에 캔버스가 붙는다. 크기 불변 |
| 24글자 입력 패드 | 전부 렌더(disabled) | 활성화만 바뀐다. 버튼을 `{#if}` 로 제거하지 않는다 |
| 타이머 | `0.00` + `tabular-nums` + `min-width` | 숫자만 바뀐다 |
| 기록 목록 | 렌더하지 않음(빈 상태) | `{#if browser && records.length}` 이중 방어 |

---

## 3. 데이터 모델

### 3.1 엔진 타입 (`src/lib/cube/trace.ts`)

```ts
export type TwistConvention = 'A' | 'B';

export interface TraceOptions {
  pieceKind: PieceKind;              // sim.ts 의 'corner' | 'edge'
  bufferStickers: Sticker[];         // 예: ['A','E','R'] — 호출부가 meta 에서 읽어 넘긴다
  primarySticker: Sticker;           // 예: 'A'
  twistConvention?: TwistConvention;  // 기본 'A'
  pickBreakIn?: (candidates: Sticker[]) => Sticker;  // 기본 candidates[0]
}

export interface TraceResult {
  targets: Sticker[];
  twists: Sticker[];    // 관례 A 에서는 항상 빈 배열
  breakIns: number;     // 끊고 들어간 횟수
  parity: boolean;      // targets.length % 2 === 1
}

export interface MemoInput {
  targets: Sticker[];
  twists: Sticker[];    // 관례 A 에서는 빈 배열이어야 한다
}

export type TraceVerdict =
  | { kind: 'correct' }
  | { kind: 'correct-extra'; extra: number }
  | { kind: 'wrong-at'; index: number; reason: WrongReason; expected: Sticker | null }
  | { kind: 'incomplete'; remaining: Cubie[] }
  | { kind: 'twist-mismatch'; missing: Sticker[]; unexpected: Sticker[] }
  | { kind: 'invalid-letter'; index: number; letter: string };

export type WrongReason =
  | 'wrong-piece'        // 다른 큐비를 지목했다
  | 'wrong-orientation'  // 큐비는 맞고 스티커(방향)가 틀렸다
  | 'already-solved'     // 이미 해결·방문한 큐비로 끊었다
  | 'buffer-sticker';    // 버퍼 스티커를 타깃으로 썼다
```

### 3.2 Worker 프로토콜 (`src/lib/cube/scramble.worker.ts`)

| 방향 | 메시지 | 비고 |
|---|---|---|
| main → worker | `{ type: 'init' }` | 진입 즉시. `Cube.initSolver()` |
| worker → main | `{ type: 'ready' }` | 초기화 완료 (실측 ~1.7s) |
| main → worker | `{ type: 'request'; n: number }` | 큐 보충 |
| worker → main | `{ type: 'scramble'; scramble: string; core: string }` | 1건씩 |
| worker → main | `{ type: 'error'; message: string }` | 생성 실패 |

큐 목표 길이 8, 소비 시 1건 보충. `terminate()` 는 화면 이탈 시 메인이 부른다.

### 3.3 뷰어 API (`src/lib/cube/cube3d.ts`)

```ts
export interface Mark { color: string; outline: 'solid' | 'dashed' | 'double' }

export interface CubeView {
  setFacelets(colors: string[]): void;        // 54칸, 면 순서 URFDLB
  setHighlights(marks: (Mark | null)[]): void; // 54칸
  setOrientation(index: number): void;         // 0..23
  resize(): void;
  dispose(): void;
}

export function createCubeView(canvas: HTMLCanvasElement): Promise<CubeView>;
```

### 3.4 기록 (localStorage 키 `"trace.records"`)

```json
{
  "schemaVersion": 1,
  "records": [
    { "at": 1755660000000, "ms": 84210, "pieceKind": "corner",
      "buffer": "UBL", "mode": "memorize", "targetCount": 8, "correct": true }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `at` | `number` | `Date.now()`. 표시용 시각 — **측정에는 쓰지 않는다**(FR-TR-23) |
| `ms` | `number` | `performance.now()` 차이 |
| `pieceKind` | `'corner' \| 'edge'` | |
| `buffer` | `string` | `meta.buffer`. 같은 스크램블도 버퍼가 다르면 정답이 다르다 |
| `mode` | `'follow' \| 'memorize'` | 보고 따라가기 / 외운 다음 입력하기 |
| `targetCount` | `number` | |
| `correct` | `boolean` | |

### 3.5 세션 설정 (`src/lib/ui/tracing.svelte.ts`)

| 키 | 값 | 기본 | FR |
|---|---|---|---|
| `"trace.pieceKind"` | `'corner' \| 'edge' \| 'both'` | `'corner'` | FR-TR-19 |
| `"trace.mode"` | `'follow' \| 'memorize'` | `'follow'` | FR-TR-21 |
| `"trace.convention"` | `'A' \| 'B'` | `'A'` | FR-TR-24 |

`settings.svelte.ts` 에 얹지 않는다. 표시 취향(`ui.*`)과 훈련 설정은 라이프사이클이 다르다 —
직전 기능이 같은 이유로 `memorize.svelte.ts` 를 분리했다.

---

## 4. 페이즈 분해

### 4.1 개요

| Phase | 범위 | 담당 FR/NFR | 병렬 |
|---|---|---|---|
| **1A** | 트레이싱 엔진 — `speffz` 회전 상수, `trace.ts`, 실행 모델·채점 | FR-TR-4~13, 24, 25; NFR-TR-4 | 1B·1C 와 동시 |
| **1B** | 스크램블 Worker — 워커, 큐, `{scramble, core}` | FR-TR-1~3; NFR-TR-1, 3 | 1A·1C 와 동시 |
| **1C** | 3D 뷰어 — `cube3d.ts`, `Cube3D.svelte`, 지연 로드 | FR-TR-14~16(그리기), 17; NFR-TR-2, 6 | 1A·1B 와 동시 |
| **1.5** | 병합 — 세 갈래 통합, 빌드·번들·타입 검증 | (통합) | 병합 전용 |
| **2** | 채점·세션 도메인 — `domain/tracing.ts`, `ui/tracing.svelte.ts`, 기록 | FR-TR-12, 13, 20, 24; 제약(기록) | 순차 |
| **3** | 훈련 화면 골격 — `/trace`, 세션 설정, 회색→시작, 타이머, 두 모드 | FR-TR-17~19, 21~23; NFR-TR-1(terminate), 5 | 순차 |
| **4** | 입력과 결과 — 24글자 패드, 두 구획, 키보드, 채점 결과 | FR-TR-18, 20, 24, 25; NFR-TR-5 | 순차 |
| **5** | 하이라이트와 누출 방지 | FR-TR-15, 16 | 순차 |

**총 8 페이즈** (병렬 3 + 병합 1 + 순차 4).

### 4.2 왜 1A/1B/1C 를 병렬로 두는가

SPEC 이 든 근거가 그대로 유효하다 — 3D 가 임계 경로이고(가장 오래 걸리며 눈으로만 확인된다), 엔진은
화면 없이 단위 테스트로 전부 검증된다(NFR-TR-4). 셋은 서로의 산출물을 **런타임에** 필요로 하지 않는다.
셋이 만나는 곳은 Phase 3 의 화면 하나뿐이고, 거기서 오가는 통화는 **54칸 facelet 문자열** 하나다.

### 4.3 의존 관계 분석

**파일 수준** — 겹치는 파일이 0개다.

| Phase | 신규 | 수정 |
|---|---|---|
| 1A | `src/lib/cube/trace.ts`, `tests/unit/trace.test.ts` | `src/lib/cube/speffz.ts`, `src/lib/cube/sim.ts`, `tests/unit/speffz.test.ts` |
| 1B | `src/lib/cube/scramble.ts`, `src/lib/cube/scramble.worker.ts`, `src/lib/ui/scramble.svelte.ts`, `tests/unit/scramble.test.ts` | `src/lib/cube/cubejs.d.ts` |
| 1C | `src/lib/cube/cube3d.ts`, `src/lib/ui/Cube3D.svelte`, `tests/unit/cube3d.test.ts` | `package.json`, `pnpm-lock.yaml` |

**모듈 수준** — import 방향에 순환·전방 의존이 없다.

- 1A 는 `speffz.ts`·`sim.ts` 만 import 한다. 워커도 뷰어도 모른다.
- 1B 는 `cubejs` 패키지 진입점만 import 한다. `trace.ts` 를 import 하지 않는다 (워커는 상태를 계산하지 않는다).
- 1C 는 `three` 만 import 한다. 색 배열을 받을 뿐 큐브 상태를 모른다.
- 셋 다 Phase 3 이 조립한다.

**테스트 수준** — 공유 픽스처가 없다.

- 1A: `tests/unit/trace.test.ts` + `speffz.test.ts` 보강. 데이터는 기존 `corner-UBL.json`(378 왕복 검증용).
- 1B: `tests/unit/scramble.test.ts`. 워커의 순수부(`scramble.ts`)만 node 에서 돌린다.
- 1C: `tests/unit/cube3d.test.ts` — `three` 없이 도는 순수부(색 매핑, 24방향 카메라)만.
- 빌드 산출물 검사는 각자 **다른 파일** 에 둔다: 1B `tests/unit/bundle-worker.test.ts`,
  1C `tests/unit/bundle-three.test.ts`. 한 파일에 합치면 두 워크트리가 같은 파일을 쓴다.

### 4.4 병렬 판정

| 기준 | 결과 |
|---|---|
| 공유 파일 없음 | ✅ 위 표에서 교집합 0 |
| 런타임 의존 없음 | ✅ 셋 다 Phase 3 이 처음 조립 |
| 독립 테스트 가능 | ✅ 각자 `pnpm test` 로 자기 파일만 돌려 통과 |

### 4.5 충돌 예측

| 범주 | 예측 | 대응 |
|---|---|---|
| 머지 충돌 | `pnpm-lock.yaml` — 1C 만 `three`/`@types/three` 를 넣는다. 다른 갈래가 손대지 않으면 충돌 없다 | 1A·1B 는 의존성을 추가하지 않는다. 넣어야 할 일이 생기면 병합 페이즈로 미룬다 |
| 머지 충돌 | `package.json` — 1C 만 수정 | 스크립트 추가 금지. 필요하면 1.5 에서 한다 |
| 머지 충돌 | `src/lib/index.ts` 는 빈 barrel 이다. 세 갈래가 동시에 export 를 추가하면 충돌한다 | **아무도 건드리지 않는다.** 호출부는 경로로 직접 import 한다 (기존 코드와 동일) |
| 통합 지점 | 54칸 facelet 문자열의 면 순서 — `URFDLB`, 각 면 좌상→우하 (`speffz.ts:5-7`) | 세 갈래 모두 이 규약을 문서 상단에 적고 어기지 않는다. 1.5 에서 한 스크램블로 세 경로가 같은 결론을 내는지 확인 |
| 통합 지점 | `PieceKind` 타입 — `sim.ts:34` 에 이미 있다 | 새로 선언하지 않는다. 1A 도 1B 도 `sim.ts` 것을 쓴다 |
| 테스트 조정 | 빌드 산출물 검사가 각각 `pnpm build` 를 부른다 (느리다) | 파일을 나눠 독립성을 지키되, 1.5 에서 실행 시간을 재고 필요하면 한 번만 빌드하도록 합친다 |
| CI | `tests/unit/e2e-tags.test.ts` 가 새 E2E 파일의 `@viewport` 태그를 검사한다 | E2E 를 만드는 Phase 3~5 에서만 걸린다. 1A~1C 는 E2E 를 만들지 않는다 |

### 4.6 워크트리

```
feat/0.5.0 (베이스)
├── git worktree add ../cube-study-feature-tracing-1A feat/tracing-1A feat/0.5.0
├── git worktree add ../cube-study-feature-tracing-1B feat/tracing-1B feat/0.5.0
└── git worktree add ../cube-study-feature-tracing-1C feat/tracing-1C feat/0.5.0
```

Phase 1.5 가 `feat/0.5.0` 에서 셋을 순서대로 병합한다(1A → 1B → 1C).

---

## 5. 파일 목록

### 신규 생성

| 파일 | 역할 | Phase |
|---|---|---|
| `src/lib/cube/trace.ts` | 트레이싱 엔진 + 실행 모델 + 채점 (순수) | 1A |
| `src/lib/cube/scramble.ts` | 워커의 순수부 — `Cube` 인스턴스에서 `{scramble, core}` 생성 | 1B |
| `src/lib/cube/scramble.worker.ts` | Web Worker 진입점. `initSolver` 는 여기서만 부른다 | 1B |
| `src/lib/ui/scramble.svelte.ts` | 워커 수명·큐 관리 (`$state`, `terminate`) | 1B |
| `src/lib/cube/cube3d.ts` | `three` 뷰어 본체 (Svelte 무관) | 1C |
| `src/lib/ui/Cube3D.svelte` | 캔버스 래퍼. `three` 동적 import | 1C |
| `src/lib/domain/tracing.ts` | 채점 결과 문구, 관례 A/B 비교, 기록 파싱·직렬화 (순수) | 2 |
| `src/lib/ui/tracing.svelte.ts` | 세션 설정·기록 싱글턴 | 2 |
| `src/lib/ui/StickerPad.svelte` | 24글자 온스크린 패드 | 4 |
| `src/routes/trace/+page.svelte` | 훈련 화면 | 3 |
| `tests/unit/trace.test.ts` | 엔진 단위 테스트 (검증표 전량) | 1A |
| `tests/unit/scramble.test.ts` | 스크램블 순수부 | 1B |
| `tests/unit/bundle-worker.test.ts` | Worker 청크 분리 + `initSolver` 호출 위치 | 1B |
| `tests/unit/cube3d.test.ts` | 색 매핑·24방향 카메라 (순수부) | 1C |
| `tests/unit/bundle-three.test.ts` | `three` 가 초기 청크에 없음 | 1C |
| `tests/unit/tracing.test.ts` | 채점 문구·기록 스키마 | 2 |
| `tests/e2e/trace-session.spec.ts` | 세션 흐름·타이머·회색 시작 | 3 |
| `tests/e2e/trace-input.spec.ts` | 패드 입력·채점 결과 | 4 |
| `tests/e2e/trace-noleak.spec.ts` | 뒷면 누출 금지·하이라이트 | 5 |

### 수정

| 파일 | 변경 | Phase |
|---|---|---|
| `src/lib/cube/speffz.ts` | `CORNER_ROTATION` 추가 (FR-TR-9) | 1A |
| `src/lib/cube/sim.ts` | `stateFromFacelets` 분리·export | 1A |
| `src/lib/cube/cubejs.d.ts` | `cubejs` 진입점의 `random`/`initSolver`/`solve` 선언 추가, 주석의 근거를 런타임 비용으로 갱신 | 1B |
| `package.json`, `pnpm-lock.yaml` | `three`, `@types/three` 추가 | 1C |
| `src/routes/+layout.svelte` | 상단 내비에 "트레이싱" 추가 (`+layout.svelte:63-67`) | 3 |
| `tests/unit/speffz.test.ts` | `CORNER_ROTATION` 검증 추가 | 1A |

### 변경하지 않는다

| 파일 | 이유 |
|---|---|
| `src/lib/data/corner-UBL.json` | 트레이싱은 케이스 데이터를 런타임에 읽지 않는다. 378 왕복 검증에만 쓴다 |
| `src/lib/domain/memorize.ts` | 저장 키·스키마를 분리한다 (AD-13) |
| `src/lib/domain/grade.ts` | 퀴즈 채점이다. 트레이싱 채점과 섞지 않는다 |
| `src/lib/cube/speffz.ts` 의 `CORNER_FACELETS` | 데이터 756 삼중항과 대조된 좌표다 (AD-3) |
| `src/lib/index.ts` | 빈 barrel 유지. 병렬 충돌 지점이다 |
| `src/lib/data/loader.ts` | `DatasetKey` 가 이미 버퍼를 받는다. 이번엔 UFR/엣지 데이터를 넣지 않는다(#24, #16) |

---

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| 코너 회전 순서를 잘못 적어 라운드트립이 통째로 실패 (프로토타입 0/260) | `CORNER_ROTATION` 을 cubejs 면회전으로 검증하는 테스트를 상수와 **같은 페이즈에** 넣는다 (T1A-1) |
| 끊기 사이클의 마지막 타깃 누락 (프로토타입 168건) | 정지 조건을 "스티커 일치" 가 아니라 "큐비 일치" 로 적는다 (AD-4). 500/500 라운드트립이 이것만으로 갈린다 |
| 비틀림 특례 분기가 슬며시 들어옴 | `grep -n "twist" src/lib/cube/trace.ts` 결과가 관례 옵션 처리와 `twists` 산출 밖으로 나가지 않는지 체크리스트로 확인. 홀수 타깃 비율 50±2% 를 통계 테스트로 건다 |
| 엔진에 버퍼 리터럴 유입 | `grep -nE "'(A\|E\|R\|UBL\|UFR\|UF\|DF)'" src/lib/cube/trace.ts` 0건을 완료 조건에 넣는다 (FR-TR-7) |
| `initSolver()` 가 메인 스레드에서 불림 | 워커 파일 밖에서 `initSolver` 문자열이 나오면 실패하는 테스트를 둔다. 실측 1695ms·+102MB 가 그대로 사용자에게 간다 |
| 워커를 반납하지 않아 100MB 가 남음 | `onDestroy` 에서 `terminate()`. E2E 로 화면 이탈 후 `performance.memory` 대신 **워커 종료 자체** 를 관측한다(테스트 가능한 신호로 바꾼다) |
| `three` 가 초기 청크로 새어 들어옴 | `Cube3D.svelte` 밖 어디서도 `three` 를 정적 import 하지 않는다. 빌드 산출물 검사(1C) |
| 뒷면 정보 누출 (FR-TR-15) | 반투명·힌트·미니맵을 만들지 않는다. E2E 가 캔버스 외 DOM 에 스티커 문자·색 정보가 없음을 확인 (Phase 5) |
| mask 별 material 캐시로 큐비 색이 서로 물듦 | 큐비마다 material 6개를 개별 생성. `dispose()` 에서 전부 해제 (#13 결론) |
| 프리렌더/하이드레이션 레이아웃 점프 | AD-14 표. 캔버스 자리·패드 버튼 개수·타이머 폭을 SSR 에서 확정 |
| 암기 진도 소실 | 저장 키와 스키마 버전 분리 (AD-13). E2E 로 트레이싱 기록을 남긴 뒤 암기 체크가 살아있는지 확인 |
| 기록 무한 증가 | 상한 50건. 초과분 폐기를 단위 테스트로 확인 |
| 정답이 하나라고 오해한 채점 구현 | 채점은 실행 모델만 쓴다. `trace()` 산출과 **문자열 비교하는 코드가 없어야** 한다 (AD-7) |
| 관례 B 에서 버퍼 비틀림 누락 | `twists` 를 잔여 상태에서 뽑는다 (AD-5). 코너 1475/1475 검증이 이것 없이는 통과하지 않는다 |
| 스크램블 준비 전 사용자가 시작 | "준비 중" 표시 + 시작 버튼 비활성 (FR-TR-2) |
