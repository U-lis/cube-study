# handoff — 초기 지급 자료

다른 세션에서 논의·생성되어 이 프로젝트로 넘어온 원본 자료. **재생성 불가 자산이므로 삭제 금지.**

| 파일 | 내용 |
|---|---|
| `INSTRUCTIONS.md` | 무엇을 만들지 (기능 요구사항) |
| `HANDOFF.md` | 왜 이렇게 만드는지 (설계 배경, 도메인 지식) |
| `3style_ubl_data.orig.json` | 지급 원본 데이터 378케이스 (schemaVersion 없음) |
| `3style_ubl_data.v2.json` | 위에 strict 필드를 추가한 것 (schemaVersion 2) |
| `add_strict.py` | orig → v2 생성 스크립트 (재현용) |

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

## 원칙

INSTRUCTIONS.md와 HANDOFF.md가 못박은 대로, **이 데이터의 알고리즘을 재계산하거나
"더 짧은 것으로" 교체하지 않는다.** 모든 알고리즘은 큐브 시뮬레이터로 3중 검증
(메모 방향 / 코너 해결 / 엣지 무영향)을 통과한 값이다.
