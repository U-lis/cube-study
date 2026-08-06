# corner-UBL.json 교체 안내 (schemaVersion 2 → 3)

## 무엇이 바뀌나

**데이터만 교체. 코드 변경 불필요.** 기존 스키마의 모든 필드가 그대로 유지됩니다.

| | v2 (현재) | v3 (신규) |
|---|---|---|
| 케이스 수 | 378 | 378 (동일) |
| **anchor 수** | **10개** | **6개** |
| anchor 목록 | LB TU SC NG UN WM NU KD UB KS | **GC TC BU IV KS KG** |
| setup 평균 | 11.25수 | 11.19수 |
| **직접 처리 케이스** | **6개** (CU CW UC UW WC WU) | **0개** |
| direct | 변동 없음 | 변동 없음 |

`direct` 쪽은 알고리즘·strict·A/B 파트 모두 **완전히 동일**합니다. 바뀐 건 `setup` 계열뿐입니다.

## 왜 바꾸나

v2의 anchor 중 `UN`과 `NU`가 **서로 역이고 알고리즘이 문자 단위로 동일**했습니다:

```
UN = U R U' L2 U R' U' L2
NU = L2 U R U' L2 U R' U'   ← invert(UN) 과 완전 동일
```

anchor 선정(greedy set-cover)에 **역트릭 경유 경로**를 추가하니 10개 → 6개로 줄었습니다.
평균 길이는 오히려 미세하게 감소(11.25 → 11.19수). 외울 기준공식이 4개 줄어드는 순수 이득입니다.

**상위 2개(GC 164개 + TC 106개)만으로 270/378 커버.**

### 직접 처리 케이스 제거

v2에는 어느 기준으로도 안 닿아 전용 알고리즘을 쓰던 6케이스(`CU CW UC UW WC WU`)가
있었습니다. v3에서는 이들도 **기존 anchor + 3수 셋업**으로 도출됩니다 (무브 수는 13수로 동일).

따라서 **`setup.anchor`가 `"(직접)"`인 케이스는 이제 존재하지 않습니다.**
관련 예외 처리 코드가 있다면 제거해도 됩니다. (남겨둬도 무해)

셋업 길이 분포: 0수 6개 / 1수 54개 / 2수 312개 / 3수 6개

## 새로 추가된 필드

### `cases[].setup.usesInverse` (boolean)

`true`면 "역 케이스를 기준으로 풀고 전체를 뒤집은 것". 378개 중 **186개**가 해당.

**중요**: `setup.alg`에는 **뒤집기와 무브 상쇄가 모두 적용된 최종 실행형**이 들어 있습니다.
앱은 지금처럼 `setup.alg`를 그대로 표시하면 됩니다. 사용자가 실행 중에 뒤집기를 계산할 일 없음.

이 플래그는 **구조 설명용**입니다. 학습 화면에서 "이건 `YX`를 풀고 뒤집은 것"이라고
알려주면 이해에 도움이 됩니다. UI에 안 써도 무방합니다.

### `setup.strict.alg`의 표현

`usesInverse: true`인 경우 strict 형태는 **`S · anchor⁻¹ · S'`**로 표시됩니다.
즉 같은 기준공식을 거꾸로 돌리는 구조. `cancel(strict.alg) === alg`는 여전히 378/378 성립합니다.

### `meta` 추가 필드

- `schemaVersion: 3`
- `anchorCount: 6`
- `anchorLearnOrder`: `["GC","TC","BU","IV","KS","KG"]` — 담당 케이스 많은 순.
  기준 목록을 정렬할 때 이 배열 순서를 그대로 쓰면 됩니다.
- `anchorNote`: fold 경위 설명
- `avgMoves`: `{ direct: 9.02, setup: 11.19 }`

## 앱 코드에서 확인할 것

anchor 키를 **하드코딩한 곳이 있으면** 수정 필요합니다:

- `"LB"`, `"TU"`, `"SC"` 등 v2 anchor 이름을 문자열로 참조하는 코드
- anchor 개수를 10으로 가정한 UI (그리드 레이아웃 등)
- "상위 3개로 243개 커버" 같은 안내 문구 → **"상위 2개로 270개"**로 갱신
- `anchor === "(직접)"` 분기 (이제 해당 케이스 없음)

`Object.keys(data.anchors)`나 `meta.anchorLearnOrder`로 동적 처리하고 있다면 **수정 불필요**합니다.

## 검증

`corner-UBL.json` 기준 **1512/1512 통과**:

1. 각 알고리즘이 해당 케이스를 실제로 푸는가 (direct + setup)
2. 엣지 무영향인가
3. `moves` 값이 실제 무브 수와 일치하는가
4. `cancel(strict.alg) === alg` 인가
5. 역트릭 (`XY` 뒤집기 = `YX`)
6. `sameAlg` 플래그 정합성

기존 `test_sim.mjs`는 v1 파일명(`3style_ubl_data.json`)을 참조하므로,
파일명을 `corner-UBL.json`으로 바꾸거나 테스트 스크립트의 경로를 수정하세요.
