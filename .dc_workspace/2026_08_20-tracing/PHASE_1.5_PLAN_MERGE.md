# Phase 1.5 — 병합 (MERGE)

**담당**: 1A(엔진) · 1B(스크램블 워커) · 1C(3D 뷰어) 통합
**작업 위치**: `../cube-study-feature-tracing` (브랜치 `feat/0.5.0`)

## 목표

이 페이즈가 끝나면:
- 세 갈래가 `feat/0.5.0` 에 병합되고 `pnpm test` / `pnpm check` / `pnpm build` 가 전부 통과한다
- 세 모듈이 **같은 규약** 을 쓰는지 통합 지점에서 확인된다 — 54칸 facelet 문자열, `PieceKind`
- 번들·런타임 검사 두 개가 함께 통과한다
- 화면은 아직 없다. Phase 3 이 조립한다

## 선행 조건

- Phase 1A, 1B, 1C 가 각자의 완료 체크리스트를 통과한 상태
- 각 워크트리에서 `pnpm test` / `pnpm build` 통과

## 병합 순서

의존이 없으므로 순서는 충돌 면적으로 정한다. 파일 수가 많은 것부터 넣고, `package.json`/`pnpm-lock.yaml`
을 건드리는 1C 를 마지막에 넣는다.

```bash
cd /home/ulismoon/Documents/cube-study-feature-tracing   # feat/0.5.0
git merge feat/tracing-1A
pnpm test && pnpm check
git merge feat/tracing-1B
pnpm test && pnpm check
git merge feat/tracing-1C
pnpm install          # 1C 가 three 를 넣었다
pnpm test && pnpm check && pnpm build
```

각 병합 직후 테스트를 돌린다. 세 개를 한꺼번에 넣고 깨지면 원인 갈래를 찾는 데 시간이 든다.

## 예측된 충돌과 처리

| 파일 | 예측 | 처리 |
|---|---|---|
| `pnpm-lock.yaml` | 1C 만 수정 → 충돌 없음. 다른 갈래가 실수로 의존성을 넣었다면 충돌 | 1C 의 것을 택하고 `pnpm install` 로 재생성. 임의 손편집 금지 |
| `package.json` | 1C 만 수정 → 충돌 없음 | 추가 의존성이 `three`, `@types/three` 뿐인지 확인 |
| `src/lib/cube/cubejs.d.ts` | 1B 만 수정 | 기존 `cubejs/lib/cube.js` 선언이 남아 있는지 확인 — `sim.ts:21` 이 그것을 쓴다 |
| `src/lib/cube/sim.ts` | 1A 만 수정 (`stateFromFacelets` 분리) | `data-regression.test.ts` 378 전수 통과로 확인 |
| `src/lib/index.ts` | 아무도 건드리지 않기로 했다 | 누가 export 를 추가했으면 되돌린다. 호출부는 경로로 직접 import 한다 |
| `tests/unit/bundle-*.test.ts` | 1B·1C 가 각각 다른 파일 | 두 파일이 각각 `pnpm build` 를 요구한다. 실행 시간을 재고, 30초를 넘으면 이 페이즈에서 하나로 합친다 |

## 통합 확인 (이 페이즈의 본론)

병합이 아니라 **규약이 맞는지** 를 본다. 세 갈래가 서로를 안 보고 만들어졌으므로 여기서 처음 만난다.

### I-1. 54칸 facelet 문자열이 세 경로에서 같은 것을 가리킨다

한 스크램블을 골라 (워커 없이 `cubejs/lib/cube.js` 로 직접 만들어도 된다):

1. `stateFromFacelets(s, 'corner')` → `trace()` 로 타깃 열을 뽑는다 (1A)
2. 같은 문자열 `s` 를 `faceletToCubie` 매핑으로 큐비·면에 배분한다 (1C)
3. 타깃 문자 하나를 골라 `CORNER_INDEX[t]` 로 facelet 인덱스를 얻고, 2에서 그 인덱스가 어느 큐비의 어느
   면에 갔는지 확인한다

**기대**: 그 큐비가 `CORNER_CUBIE[t]` 와 같다. 어긋나면 뷰어 좌표계와 앱 좌표계가 다른 것이고, 하이라이트가
엉뚱한 조각에 칠해진다. **Phase 5 에서 발견하면 훨씬 비싸다.**

### I-2. 스크램블 → 상태 → 타깃 열이 한 줄로 이어진다

`scrambleFrom` 이 만든 `core` 를 `sim.applyToCorners(sim.solvedCorners(), core)` 에 넣고 `trace()` 한 뒤,
그 메모를 실행 모델로 되돌리면 풀린다. 1B 와 1A 를 처음 잇는 확인이다.

풀이기가 필요하므로 이 확인은 **가짜 `solve()`** 로 한다 (임의 알고리즘의 역을 solve 결과로 준다).
`initSolver()` 를 단위 테스트에서 부르지 않는다 — 1.7초다.

### I-3. `PieceKind` 가 하나다

`grep -rn "type PieceKind\|'corner' | 'edge'" src/` 로 중복 선언이 없는지 본다. 정의는 `sim.ts:34` 하나여야
한다.

### I-4. 번들·런타임 검사가 함께 통과한다

- 워커 청크가 별도 파일 (1B)
- `three` 가 초기 청크에 없음 (1C)
- `grep -rn "initSolver" src/` 가 `scramble.worker.ts` 한 곳
- 조회·기준공식·퀴즈 화면의 초기 스크립트 집합이 0.4.2 대비 늘지 않았는가 — `three` 도 워커도 새어들지
  않았다는 확인

## 완료 체크리스트

- [ ] 세 갈래 병합 완료, 충돌 해소 내역이 커밋 메시지에 남았다
- [ ] `pnpm install` 후 `pnpm test` 전량 통과 (1A·1B·1C 의 테스트 전부)
- [ ] `pnpm check` 오류 0건
- [ ] `pnpm build` 성공 (프리렌더 포함)
- [ ] I-1 통과 — 뷰어 좌표계와 Speffz 좌표계가 같은 큐비를 가리킨다
- [ ] I-2 통과 — 스크램블 → 상태 → 타깃 열 → 실행 → 풀림
- [ ] I-3 통과 — `PieceKind` 중복 선언 0건
- [ ] I-4 통과 — 번들·런타임 검사 전부
- [ ] `src/lib/index.ts` 가 여전히 빈 barrel 이다
- [ ] 기존 화면(조회·기준공식·퀴즈)의 E2E 가 전부 통과한다 (`pnpm test:e2e`)
- [ ] 워크트리 3개 제거 (`git worktree remove`), 브랜치는 병합 후 정리

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|---|---|
| `pnpm-lock.yaml` 손편집 | `pnpm install` 로 재생성한다. 손으로 고친 lock 은 CI 에서만 터진다 |
| 세 개를 한꺼번에 병합 | 하나씩 넣고 테스트한다 |
| 좌표계 불일치를 화면에서 발견 | I-1 을 이 페이즈에서 한다. Phase 5 에서 찾으면 뷰어를 다시 만들게 된다 |
| 기존 화면 회귀를 안 봄 | 이번 변경은 `sim.ts`·`cubejs.d.ts` 를 건드린다. 퀴즈 채점이 `sim` 위에 있다 (`grade.ts:9`) |
| E2E 태그 규약 위반 | 이 페이즈는 E2E 를 만들지 않는다. `tests/unit/e2e-tags.test.ts` 는 그대로 통과해야 한다 |
