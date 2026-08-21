# Phase 1.5 — 테스트 계획

## 실행 명령

```bash
pnpm install
pnpm test          # 1A + 1B + 1C + 기존 전부
pnpm check
pnpm build
pnpm test:e2e      # 기존 화면 회귀
```

---

## 통합 테스트 (`tests/unit/trace-integration.test.ts`, 신규)

병합 페이즈에서만 만드는 파일이다. 세 갈래가 서로를 처음 만나는 지점만 본다.

### T1.5-1. 좌표계 일치 (I-1)

| # | 검사 | 완료 조건 |
|---|---|---|
| 1 | 코너 스티커 24개 각각에 대해 `faceletToCubie(CORNER_INDEX[t]).cubie` 가 `CORNER_CUBIE[t]` 와 같은 큐비 | 24/24 |
| 2 | 엣지 스티커 24개에 대해 동일 | 24/24 |
| 3 | 센터 6칸이 각각 다른 큐비 | 6/6 |
| 4 | 임의 facelet 문자열에서, 뷰어 매핑으로 얻은 (큐비, 면) → 색이 원본 문자열의 그 인덱스 값과 같다 | 54/54 |

**완료 조건**: 전항 통과. 여기가 어긋나면 하이라이트가 엉뚱한 조각에 칠해진다.

### T1.5-2. 스크램블 → 상태 → 타깃 → 실행 (I-2)

`initSolver()` 를 부르지 않는다. 가짜 `solve()` 를 쓴다.

| # | 시나리오 | 완료 조건 |
|---|---|---|
| 1 | 임의 알고리즘 100개 각각에 대해 `scrambleFrom` → `core` → `applyToCorners` → `trace` → 실행 | 100/100 풀림 |
| 2 | 같은 것을 엣지로 | 100/100 |
| 3 | `core` 대신 `scramble` 을 넣어도 지금은 같은 결과 | 성립 (회전이 붙는 순간 갈린다는 주석 포함) |

### T1.5-3. 중복 선언·규약 (I-3)

| # | 명령 | 완료 조건 |
|---|---|---|
| 1 | `grep -rn "type PieceKind" src/` | `sim.ts` 한 곳 |
| 2 | `grep -rn "URFDLB" src/` | 면 순서 규약을 적은 주석들이 서로 모순되지 않는다 |
| 3 | `cat src/lib/index.ts` | 빈 barrel 유지 |

---

## 번들·런타임 검사 (I-4)

| # | 검사 | 완료 조건 |
|---|---|---|
| 1 | `tests/unit/bundle-worker.test.ts` | 통과 (워커 청크 분리) |
| 2 | `tests/unit/bundle-three.test.ts` | 통과 (`three` 초기 청크 부재) |
| 3 | `grep -rn "initSolver" src/` | `scramble.worker.ts` 한 곳 |
| 4 | 조회·기준공식·퀴즈 진입 스크립트 집합 | `three`·워커 청크 유입 0건 |
| 5 | 두 bundle 테스트의 총 실행 시간 | 30초 이하. 초과하면 한 파일로 합치고 빌드를 1회만 돈다 |

---

## 회귀 검사

| # | 대상 | 완료 조건 |
|---|---|---|
| 1 | `tests/unit/data-regression.test.ts` | 378 전수 통과 (`sim.ts` 리팩터 확인) |
| 2 | `tests/unit/speffz.test.ts` | 756 삼중항 통과 |
| 3 | `tests/unit/grade.test.ts`, `quiz.test.ts` | 통과 |
| 4 | `pnpm test:e2e` | 기존 스펙 전량 통과 (조회·기준공식·퀴즈·PWA) |
| 5 | `tests/unit/e2e-tags.test.ts` | 통과 |

---

## 완료 조건 종합

- [ ] T1.5-1 ~ T1.5-3 통과
- [ ] 번들·런타임 검사 5항 통과
- [ ] 회귀 검사 5항 통과
- [ ] `pnpm build` 성공
- [ ] 워크트리·브랜치 정리 완료
