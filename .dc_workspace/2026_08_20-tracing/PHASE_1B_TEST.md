# Phase 1B — 테스트 계획

## 테스트 커버리지 목표

`scramble.ts` 순수부는 분기 전량. 워커·큐는 빌드 산출물 검사와 정적 검사로 대신한다 — Vitest node
환경에는 `Worker` 가 없고, 실제 동작은 Phase 3 의 E2E 가 확인한다.

## 실행 명령

```bash
pnpm test tests/unit/scramble.test.ts
pnpm test tests/unit/bundle-worker.test.ts   # pnpm build 를 먼저 돌려야 한다
pnpm build && pnpm test
```

---

## 단위 테스트 (`tests/unit/scramble.test.ts`)

풀이기를 부르지 않는다. `initSolver()` 는 1.7초라 단위 테스트에서 돌릴 물건이 아니다. 대신 `solve()` 를
흉내내는 가짜 큐브(`{ solve: () => 'R U R\' U\'' , asString: ... }`)를 넘긴다. `scrambleFrom` 이 순수부인
이유가 여기 있다.

### T1B-1. `scrambleFrom` — 뒤집기 (FR-TR-1)

| # | 입력 | 기대 |
|---|---|---|
| 1 | `solve()` 가 `"R U R' U'"` | `scramble === "U R U' R'"` (`invertAlg` 규약, `notation.ts:19`) |
| 2 | `solve()` 가 `"B' D2 B"` | `scramble === "B' D2 B"` (self-inverse. 버그가 아니다, HANDOFF §4.5) |
| 3 | `solve()` 가 빈 문자열 (이미 풀림) | `scramble === ""`, throw 없음 |
| 4 | `solve()` 가 throw | 그대로 전파된다 (순수부가 에러 표현을 정하지 않는다) |
| 5 | 결과에 `2` 가 붙은 무브 | 토글해도 그대로 |

### T1B-2. 왕복 — 스크램블이 그 상태를 재현한다 (FR-TR-1)

`cubejs/lib/cube.js`(풀이기 없는 쪽)만 쓴다.

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 임의 알고리즘 `alg` 로 만든 큐브에 대해 `scrambleFrom({ solve: () => invertAlg(alg) })` | `scramble` 을 새 큐브에 적용한 `asString()` 이 원본과 일치 |
| 2 | 1번을 100회 반복 (무작위 알고리즘) | 100/100 |

### T1B-3. `{ scramble, core }` 규약 (FR-TR-3)

| # | 입력 | 기대 |
|---|---|---|
| 1 | 회전 없는 스크램블 | `core === scramble` |
| 2 | 앞에 `y2` 가 붙은 문자열 | `core` 에 회전이 없다, `scramble` 에는 남는다 |
| 3 | wide 무브(`Rw`)가 섞인 문자열 | `core` 에서 분리된다 (또는 명시적으로 미지원 throw — 어느 쪽이든 결정적) |
| 4 | 두 필드가 항상 존재한다 | `core` 가 `undefined` 인 경로 0건 |

**완료 조건**: #1 이 성립하고 #4 가 전 경로에서 참. 지금은 #1 이 실제 경로다.

### T1B-4. 큐 동작 (`ScrambleSource` 의 순수 로직)

`Worker` 를 가짜 객체로 주입할 수 있게 만들어 테스트한다(생성자 인자 또는 protected 팩토리). 못 하면
이 절은 Phase 3 E2E 로 미루고 사유를 PLAN 에 적는다.

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | `start()` 전 `take()` | `null` (throw 없음) |
| 2 | `ready` 전 `take()` | `null`, `ready === false` |
| 3 | `scramble` 메시지 8건 수신 | `queue.length === 8` |
| 4 | `take()` 1회 | `queue.length === 7`, 보충 요청 1건 발신 |
| 5 | `dispose()` | `terminate()` 호출, `queue.length === 0`, 이후 `take()` 는 `null` |
| 6 | `error` 메시지 수신 | `error` 에 문구가 담기고 큐는 유지 |

---

## 빌드 산출물 검사 (`tests/unit/bundle-worker.test.ts`)

`pnpm build` 산출물(`.svelte-kit/output/client/` 및 `build/`)을 읽는다. 빌드가 없으면 테스트를 skip 하지
말고 **실패** 시킨다 — 조용히 빠지는 검사는 검사가 아니다 (`tests/unit/e2e-tags.test.ts:3-9` 와 같은 규율).

| # | 검사 | 완료 조건 |
|---|---|---|
| 1 | 워커 청크가 별도 파일로 존재한다 | `initSolver` 문자열을 포함한 청크 파일이 1개 이상 |
| 2 | 그 청크가 앱 진입 청크가 아니다 | `app.html` 이 참조하는 초기 스크립트 목록에 없다 |
| 3 | 소스에서 `initSolver` 호출은 워커 파일에만 있다 | `grep -rn "initSolver" src/` 가 `scramble.worker.ts` 한 곳 |
| 4 | 앱 코드는 `cubejs` 진입점을 import 하지 않는다 | `grep -rn "from 'cubejs'" src/` 가 `scramble.worker.ts` 한 곳 |
| 5 | PWA precache manifest 에 워커 청크가 포함된다 | 오프라인에서 스크램블 생성이 죽지 않는다 (NFR-TR-3) |

**#1 의 마커**: `solve.js` 에만 있는 식별자를 쓴다. `initSolver` 는 `cube.js` 에 없고 `solve.js` 에만
있다(`node_modules/cubejs/lib/solve.js` 확인). 번들러가 이름을 줄일 수 있으므로 마커가 사라지면
`pruning`·`moveTable` 같은 다른 식별자 또는 청크 파일명 규칙으로 바꾸되, **검사가 통과하도록 기준을 낮추지
않는다** — 무엇으로 확인했는지 테스트 주석에 남긴다.

**#1 은 번들 크기를 재지 않는다.** solve.js 가 메인 청크에 함께 들어가도 실패가 아니다 (SPEC NFR-TR-1
개정). 이 검사가 보는 것은 "워커가 별도 청크로 갈라졌는가" 하나다.

---

## 완료 조건 종합

- [ ] T1B-1 ~ T1B-4 통과 (T1B-4 를 미뤘다면 사유가 PLAN 에 적혀 있다)
- [ ] 빌드 산출물 검사 5항 통과
- [ ] `grep -rn "initSolver" src/` 가 `scramble.worker.ts` 한 곳
- [ ] `pnpm build` 성공 (프리렌더 포함)
- [ ] 기존 단위 테스트 회귀 0건
