# corner-UBL 데이터 스키마 이력

기록용 보관소다. **앱이 읽는 파일은 `src/lib/data/corner-UBL.json` 하나뿐**이며,
여기 있는 파일은 어디에서도 import 되지 않는다 (번들에 들어가지 않는다).

`corner-UBL.v3.json` 은 현재 배포본과 같은 내용이다.
`corner-UBL.v1.json` / `.v2.json` 은 `.dc_workspace/handoff/3style_ubl_data.orig.json`
/ `.v2.json` 을 그대로 복사한 것이다.

## 버전별 차이

| | v1 | v2 | v3 (현재) |
|---|---|---|---|
| `meta.schemaVersion` | 없음 | 2 | 3 |
| 케이스 | 378 | 378 | 378 |
| 기준공식 | 10 (LB TU SC NG UN WM NU KD UB KS) | 10 (동일) | **6 (GC TC BU IV KS KG)** |
| 기준 없는 케이스 | 6 (CU CW UC UW WC WU) | 6 (동일) | **0** |
| setup 평균 | 11.25수 | 11.25수 | 11.19수 |
| `strict` (상쇄 전 구조형) | 없음 | 추가 | 유지 |
| `sameAlg`, `inverseTrick` | 없음 | 추가 | 유지 |
| `setup.usesInverse` | 없음 | 없음 | **추가 (188/378 이 true)** |
| `meta.anchorLearnOrder` 등 | 없음 | 없음 | **추가** |

`direct` 계열 알고리즘은 v1 → v2 → v3 내내 **한 건도 바뀌지 않았다**. 바뀐 것은
파생 필드와 `setup` 계열뿐이다.

## v2 → v3 에서 실제로 문제가 됐던 것

교체 안내(`MIGRATION-v2-to-v3.md`)에 "코드 변경 불필요"라고 적혀 있지만, 실제로는
아래 두 가지 때문에 코드를 고쳐야 했다.

### 1. 기준공식의 방향

v3 는 역트릭을 접어 기준을 10개에서 6개로 줄였다. 그 대가로 378 중 **188 케이스가
기준공식을 거꾸로 돌린다** (`setup.usesInverse: true`). 6개 기준 중 self-inverse 는
하나도 없으므로, 방향을 틀리면 다른 케이스를 푸는 알고리즘이 된다.

따라서 기준 이름만 보여주거나 `anchors[name].alg` 를 그대로 쓰면 **틀린다**.
방향 처리는 `src/lib/domain/anchor.ts` 한 곳에 모아뒀다.

### 2. `strict.cancels` 의 의미 변경

교체 안내에 언급이 없지만 정의가 바뀌었다.

- v2: 상쇄로 **줄어든 무브 수** (`strict.moves - moves` 와 항상 일치)
- v3: **완전히 소멸한 무브 쌍의 수** (`R R'` 은 1, `U U → U2` 는 0)

v3 파일 기준으로 756/756 이 후자와 일치한다. 앱은 이 필드를 쓰지 않지만 검증
테스트가 쓰고 있었다 (`tests/unit/data-v2.test.ts`).

## 앱이 읽을 수 있는 하한

**schemaVersion 2 이상.** v1 은 `strict`(상쇄 전 구조형) 필드가 아예 없는데,
표기 생성과 무브 수 표시가 전부 여기에 걸려 있어서 로드되지 않는다. v1 은 순수
기록용이다.

`tests/unit/schema-compat.test.ts` 가 v2 와 배포본을 같은 도메인 함수에 먹여
이 하한을 지키고 있는지 확인한다.

## 데이터를 또 교체할 때

`meta` 의 선택 필드와 `setup.usesInverse` 만 늘었을 뿐 v2 형태의 파일도 그대로
로드된다. 코드는 기준의 **개수·이름·순서·방향을 하드코딩하지 않는다**:

- 목록과 순서 — `meta.anchorLearnOrder` 를 쓰고, 없으면 `anchors` 의 키 순서
- 방향 — `setup.usesInverse` (없으면 정방향)
- 기준 없는 케이스 — `setup.anchor === '(직접)'` 분기는 남아 있고, 해당 케이스가
  0건이면 관련 UI 가 자동으로 사라진다

교체 후 `npm run check && npx vitest run && npm run build && npx playwright test` 로
확인한다. 테스트도 기대값을 데이터에서 읽으므로, 내부적으로 모순이 없는 파일이면
숫자를 고칠 일이 없다.
