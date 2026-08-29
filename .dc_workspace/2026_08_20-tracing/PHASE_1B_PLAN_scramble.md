# Phase 1B — 스크램블 Worker (scramble)

**담당**: FR-TR-1, 2, 3; NFR-TR-1, 3
**병렬**: 1A(엔진)·1C(3D 뷰어)와 동시에 진행한다. 공유 파일이 없다 (GLOBAL §4.3).
**워크트리**: `../cube-study-feature-tracing-1B` / 브랜치 `feat/tracing-1B`

## 목표

이 페이즈가 끝나면:
- Web Worker 가 `Cube.initSolver()` 를 백그라운드에서 돌리고 랜덤 스테이트 스크램블을 만들어 큐에 쌓는다
- 메인 스레드는 `initSolver()` 를 부르지 않는다
- 워커를 `terminate()` 하면 메모리가 반납된다
- 화면 코드는 만들지 않는다. `/trace` 라우트는 Phase 3 이 만든다

## 선행 조건

- `pnpm test` / `pnpm build` 통과 상태

## 대응 SPEC

| FR/NFR | 내용 |
|---|---|
| FR-TR-1 | `cubejs` 의 `Cube.random()` → `.solve()` → 뒤집기. 자체 Kociemba 구현 금지 |
| FR-TR-2 | Web Worker 에서 생성. 진입 시 `initSolver()`, 완료 후 5~10개 선적재, 소비 시 보충. 준비 전 요청은 "준비 중" |
| FR-TR-3 | `{ scramble, core }` 를 함께 낸다 |
| NFR-TR-1 | 풀이기는 Worker 안에서만 초기화하고 화면 이탈 시 `terminate()` 로 반납 |
| NFR-TR-3 | 런타임 네트워크 요청 추가 금지 |

## 왜 Worker 인가 — 번들이 아니라 런타임이다

SPEC NFR-TR-1 이 개정됐다. 근거를 오해하면 설계가 뒤틀리므로 먼저 못을 박는다.

| | 실측 | 결론 |
|---|---|---|
| `solve.js` 크기 | raw 28.8KB / **gzip 7.1KB** | 번들 크기는 제약이 **아니다** |
| `Cube.initSolver()` | **1695ms, heap +37MB, RSS +102MB** | 이것이 이유다 |

- 메인 스레드에 있으면 1.7초 멈추고 100MB 를 계속 붙든다. 조회·퀴즈만 쓰는 사용자도 떠안는다
- Worker 면 `terminate()` 로 통째 반납된다
- **`solve.js` 코드가 메인 청크에 섞이는 것은 허용한다.** 금지 대상은 메인 스레드에서의 `initSolver()` 호출 하나다
- 구현은 Vite 표준 패턴이면 끝난다. **수동 청크 분할·설정 트릭·번들 후처리를 넣지 않는다**

## 수정·생성할 파일

### `src/lib/cube/cubejs.d.ts` (수정)

지금은 `cubejs/lib/cube.js` 만 선언한다(`cubejs.d.ts:7-18`). 워커가 쓰는 패키지 진입점 API 를 추가한다.

```ts
declare module 'cubejs' {
  export default class Cube {
    constructor(other?: Cube);
    move(alg: string): Cube;
    asString(): string;
    solve(maxDepth?: number): string;
    static random(): Cube;
    static initSolver(): void;
  }
}
```

기존 `cubejs/lib/cube.js` 선언은 **그대로 둔다.** 앱 코드(`sim.ts:21`)는 계속 그쪽을 가리킨다.

파일 상단 주석(`cubejs.d.ts:1-6`)을 갱신한다. "번들이 커지니까 진입점을 피한다" 가 아니라
"우리는 상태 적용만 쓴다. 풀이기는 워커에서만 초기화한다 — 1695ms·+102MB 이기 때문이다" 로 근거를 바꾼다.
근거가 틀린 주석은 다음 사람을 잘못된 최적화로 끌고 간다.

### `src/lib/cube/scramble.ts` (신규) — 워커의 순수부

Worker 컨텍스트에 의존하지 않는 부분만 담는다. node 에서 단위 테스트가 돈다.

| 함수 | 시그니처 | 역할 |
|---|---|---|
| `scrambleFrom` | `(cube: CubeLike) => { scramble: string; core: string }` | `cube.solve()` 결과를 `invertAlg` 로 뒤집어 스크램블을 만든다 |
| `splitCore` | `(scramble: string) => { scramble: string; core: string }` | 방향 회전(`x y z` 및 wide)을 분리한다. 지금은 입력에 회전이 없어 `core === scramble` 이지만 규약을 지금 만든다 |

`invertAlg` 는 이미 있다 (`src/lib/cube/notation.ts:22`). 새로 만들지 않는다.

**`core` 규약이 왜 지금 필요한가**: 방향 회전은 `isSolved()` 를 유지하면서 `asString()` 의 facelet 배치를
바꾼다. 회전이 섞인 문자열로 타깃을 계산하면 문자가 통째로 틀어진다 (FR-TR-3). 이번 범위에서는 방향
무작위화를 붙이지 않지만(FR-TR-17 이 카메라로 대체), 규약을 나중에 만들면 그때 조용히 깨진다.

`solve()` 실패(빈 문자열·throw)는 여기서 잡아 `null` 을 돌려주지 않는다 — throw 를 그대로 올리고 워커가
`{ type: 'error' }` 로 바꾼다. 순수부가 에러 표현을 정하지 않는다.

### `src/lib/cube/scramble.worker.ts` (신규)

**`initSolver()` 를 부르는 유일한 파일이다.**

```ts
import Cube from 'cubejs';                       // 진입점 — 풀이기 포함
import { scrambleFrom } from './scramble.js';

let ready = false;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    Cube.initSolver();                            // 실측 1695ms
    ready = true;
    self.postMessage({ type: 'ready' });
  } else if (msg.type === 'request') {
    if (!ready) return;                           // 메인이 ready 전에 요청할 일은 없지만 방어한다
    for (let i = 0; i < msg.n; i++) { ... self.postMessage({ type: 'scramble', ... }); }
  }
};
```

프로토콜은 GLOBAL §3.2 표를 따른다. 생성은 1건씩 `postMessage` 한다 — n건을 모아 보내면 첫 스크램블이
n×27ms 만큼 늦어진다.

`cubejs` 의 자체 async API(`lib/async.js`)를 쓰지 않는다. `window.Worker` 와 워커 URI 를 전제하므로
번들러와 싸우게 된다. 우리 워커가 20줄이면 끝난다.

### `src/lib/ui/scramble.svelte.ts` (신규) — 수명과 큐

`$state` 싱글턴이 아니라 **화면이 생성·파괴하는 클래스** 다. 워커 수명이 화면 수명이기 때문이다
(GLOBAL AD-9). `memorize.svelte.ts` 같은 모듈 스코프 싱글턴으로 만들면 `/trace` 를 떠나도 워커가 산다.

```ts
export class ScrambleSource {
  ready = $state(false);
  queue = $state<{ scramble: string; core: string }[]>([]);
  error = $state<string | null>(null);

  start(): void      // Worker 생성 + { type: 'init' } 전송. browser 가드 안에서만
  take(): { scramble, core } | null   // 큐에서 하나 꺼내고 보충 요청
  dispose(): void    // worker.terminate() + 큐 비움
}
```

| 항목 | 값 | 근거 |
|---|---|---|
| 큐 목표 길이 | 8 | FR-TR-2 의 "5~10개" |
| 보충 시점 | `take()` 때마다 부족분 요청 | 생성 27ms 라 즉시 채워진다 |
| `ready` 전 `take()` | `null` 반환 → 화면이 "준비 중" 표시 | FR-TR-2 |

Worker 생성은 Vite 표준 패턴 한 줄이다:

```ts
new Worker(new URL('../cube/scramble.worker.ts', import.meta.url), { type: 'module' })
```

`if (browser)` 밖에서 부르지 않는다. SSR/프리렌더에서 `Worker` 는 없다 (`settings.svelte.ts:16` 과 같은 가드).

`dispose()` 는 Phase 3 의 `onDestroy` 가 부른다. 이 페이즈에서는 메서드만 만든다.

### `tests/unit/scramble.test.ts`, `tests/unit/bundle-worker.test.ts` (신규)

PHASE_1B_TEST.md 참조. **빌드 산출물 검사는 1C 와 별도 파일** 에 둔다 — 같은 파일을 두 워크트리가 쓰면
병합 충돌이 난다 (GLOBAL §4.5).

## 구현 순서

1. `cubejs.d.ts` 선언 추가 + 주석 근거 갱신
2. `scramble.ts` (순수부) + 단위 테스트 — 풀이기 없이 도는 부분부터
3. `scramble.worker.ts`
4. `scramble.svelte.ts` (큐·수명)
5. `bundle-worker.test.ts` — 빌드 산출물에서 워커 청크 분리와 `initSolver` 호출 위치 확인
6. `pnpm build` 로 프리렌더 통과 확인 (워커 생성이 `browser` 가드 밖으로 새면 여기서 죽는다)

## 완료 체크리스트

- [ ] `pnpm test` 전량 통과, `pnpm check` 오류 0건, `pnpm build` 성공
- [ ] `grep -rn "initSolver" src/ | grep -v scramble.worker.ts` 결과 **0건** (NFR-TR-1)
- [ ] `grep -rn "from 'cubejs'" src/ | grep -v scramble.worker.ts` 결과 0건 — 앱 코드는 계속 `cubejs/lib/cube.js` 를 쓴다
- [ ] 빌드 산출물에 워커 청크가 **별도 파일** 로 존재한다
- [ ] `scrambleFrom` 이 만든 스크램블을 새 큐브에 적용하면 원래 상태와 같은 facelet 문자열이 나온다
- [ ] `{ scramble, core }` 두 필드를 항상 함께 낸다. `core` 만 상태 계산에 쓰인다는 것이 주석에 적혀 있다
- [ ] `ready` 전 `take()` 가 `null` 을 돌려준다 (throw 하지 않는다)
- [ ] `dispose()` 후 `queue` 가 비고 워커 참조가 `null` 이다
- [ ] Worker 생성 코드가 `if (browser)` 안에 있다
- [ ] 런타임 네트워크 요청 0건 (import 가 전부 로컬·번들 경로) (NFR-TR-3)
- [ ] 자체 Kociemba 구현·TNoodle 포팅·pruning table 파일이 저장소에 없다 (FR-TR-1)

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|---|---|
| 번들 크기를 줄이려고 청크를 손으로 자름 | 하지 않는다. gzip 7.1KB 다. Vite 표준 패턴 한 줄로 끝낸다 |
| `initSolver()` 가 메인 스레드로 샘 | grep 검사를 완료 조건에 넣는다. 1.7초 프리즈 + 100MB 가 그대로 사용자에게 간다 |
| 워커를 모듈 스코프 싱글턴으로 만듦 | 화면을 떠나도 100MB 가 남는다. 클래스로 만들고 화면이 소유한다 |
| SSR/프리렌더에서 `Worker` 참조 | `if (browser)` 가드. `+layout.ts` 가 `prerender = true` 다 |
| `core` 를 나중에 만들기로 미룸 | 지금 만든다. 회전이 붙는 순간 타깃이 통째로 틀어지고 원인을 찾기 어렵다 |
| `solve()` 가 드물게 실패 | throw 를 워커가 잡아 `{ type: 'error' }` 로 바꾼다. 화면은 다음 스크램블로 넘어간다 |
| 시드 재현 기능 추가 | Out of Scope (#22). `Math.random` 을 치환하지 않는다 |
| 최소 길이 가드·MBLD 스크램블 추가 | Out of Scope (#22) |
