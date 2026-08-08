# handoff — 초기 지급 자료

다른 세션에서 논의·생성되어 이 프로젝트로 넘어온 원본 자료. **재생성 불가 자산이므로 삭제 금지.**

| 파일 | 내용 |
|---|---|
| `INSTRUCTIONS.md` | 무엇을 만들지 (기능 요구사항) |
| `HANDOFF.md` | 왜 이렇게 만드는지 (설계 배경, 도메인 지식) |
| `3style_ubl_data.orig.json` | 지급 원본 데이터 378케이스 (schemaVersion 없음) |
| `3style_ubl_data.v2.json` | 위에 strict 필드를 추가한 것 (schemaVersion 2) |
| `add_strict.py` | orig → v2 생성 스크립트 (재현용) |
| `sim/` | 큐브 시뮬레이터 참조 구현 (아래 참조) |

## v2에서 추가된 것

원본 필드는 **일절 수정하지 않았고**, 아래 파생 필드만 추가했다.

- `direct.strict` / `setup.strict` — `{alg, moves, cancels}`.
  `alg`는 상쇄를 적용하지 않은 구조형(`S A B A' B' S'`), 기존 최상위 `alg`는 상쇄를 적용한 실행형.
  `cancel(strict.alg) == alg` 가 direct 378 / setup 378 전부 성립(스크립트에서 assert).
- `direct.strict.aSelfInverse` / `bSelfInverse` — `A' == A`인지 여부. 296/378(78%)이 해당하며,
  UI에서 A칸과 A'칸이 글자까지 동일하게 보이는 문제의 판별에 쓴다.
- `sameAlg` — direct와 setup 알고리즘이 완전히 같은 케이스(29개). 모드 토글이 무반응으로 보이는 경우.
- `inverseTrick` — 역트릭 성립 여부. **direct는 378/378이지만 setup은 62/378만 성립**한다.
  원본 INSTRUCTIONS.md는 이 구분 없이 "378/378"이라고만 적고 있어 주의가 필요하다.

## 검증된 사실 (스크립트로 전수 확인)

- 378케이스 = 이론 유효 조합(버퍼 3스티커 제외 21개 중 동일 큐비 제외)과 완전 일치
- 42개 큐비쌍 × 정확히 9케이스
- `target`↔`stickers` 정합, `moves` 필드 = 실제 토큰 수, `anchors[].count` = 실제 집계 — 전부 일치
- LB+TU+SC 누적 243케이스(64%)
- 표기 문자집합은 ` ' 2 B D F L R U` 뿐. **비ASCII 0** (프라임은 전부 ASCII `'`)
- direct 평균 9.02수 (문서 표기 8.9와 다름), setup 평균 11.25수
- pure 144 / conj 234. 상쇄가 발생하는 것은 **conj 168개뿐이고 pure 144개는 전부 무상쇄**

## sim/ — 큐브 시뮬레이터

2차 지급분. 퀴즈 채점과 데이터 검증에 그대로 쓸 수 있는 검증된 구현이다.

| 파일 | 설명 |
|---|---|
| `cube-sim.js` | **JS 참조 구현. 이걸 쓴다.** ES 모듈, 의존성 없음 |
| `cube_perms.json` | 무브 치환 테이블 (14KB) |
| `test_sim.mjs` | 원본 데이터 전수 검증 → **1134/1134 통과** |
| `test_v2.mjs` | v2 파생 필드 전수 검증 → **5292/5292 통과** |
| `bld_sim.py` | Python 원본. 참고용이며 보통 볼 일 없다 |

실행: `cd sim && node test_sim.mjs && node test_v2.mjs`

### 핵심 규약 — Python 코드를 그대로 옮기면 어긋난다

`state`는 `{ 위치: 그_위치에_있는_원래_스티커 }` 객체다. 풀린 상태는 `{ A:'A', B:'B', ... }`.
무브 적용은 `newState[pos] = oldState[table[pos]]`이며, `cube_perms.json`의 테이블에는
**역치환이 미리 적용되어 있어** 단순 조회로 동작한다.
Python 원본은 `new[pos] = old[M⁻¹(pos)]` 규약이라 JSON 추출 시 뒤집어 저장했다.

### 지원 무브

`cornerMoves` / `edgeMoves` 모두 **27종**을 지원한다:
`U L F R B D` + **`M E S` 슬라이스** × (정방향 / `'` / `2`).
코너 3-style 378케이스는 이 중 18종만 쓰지만, **M2 엣지 확장 시 시뮬레이터를 고칠 필요가 없다.**

### 주요 API

- `identifyCase(alg)` — 알고리즘이 어떤 케이스를 푸는지 역판정. `"LB"` 또는 3-cycle이 아니면 `null`.
  **퀴즈 채점의 핵심.** 문자열 비교가 아니라 실제 효과로 판정하므로 사용자가 다른 유효한
  커뮤테이터를 써도 정답 처리된다.
- `isEdgeNeutral(alg)` — 엣지를 전혀 안 건드리는지. 부분 정답 판정에 쓴다.
- `affectedCubies(state, kind)` — 영향받은 큐비 집합. 오염된 엣지를 사용자에게 보여줄 때 쓴다.
- `invertAlg` / `cancelMoves` / `moveCount` — 시뮬레이터 없이도 쓰는 표기 유틸.

`invertAlg("B' D2 B")`가 `"B' D2 B"`를 반환하는 것은 **self-inverse이지 버그가 아니다.**

### 역트릭 정정 (중요)

`inverseTrick.setup` 필드가 62/378인 것은 **"뒤집은 결과가 저장된 역케이스의 setup.alg와
문자열로 같은가"**를 뜻한다. 시뮬레이터로 확인한 결과:

- `setup.alg`를 뒤집으면 역케이스를 **378/378 전부 정확히 푼다**
- 문자열이 다른 316건은 틀린 것이 아니라 **같은 케이스에 도달하는 다른 셋업 경로**다
  (예: `KG`→`GK`는 양쪽 다 anchor LB이지만 셋업 무브가 다르다)

즉 역트릭은 direct와 setup 양쪽에서 유효하다. 원본 INSTRUCTIONS.md:45의 "378/378 성립"이 옳다.

## 원칙

INSTRUCTIONS.md와 HANDOFF.md가 못박은 대로, **이 데이터의 알고리즘을 재계산하거나
"더 짧은 것으로" 교체하지 않는다.** 모든 알고리즘은 큐브 시뮬레이터로 3중 검증
(메모 방향 / 코너 해결 / 엣지 무영향)을 통과한 값이다.
