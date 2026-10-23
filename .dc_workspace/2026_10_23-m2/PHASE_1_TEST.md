# Phase 1 TEST

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 |
|------|--------|
| `itemsOf(ds)` 가 27개를 반환한다 | unit |
| 각 행의 공식이 DF 버퍼↔타깃 교환 + M2 부수효과(C↔W, I↔S, 센터 180°)를 낸다 | unit |
| 각 행의 공식이 코너 조각에 영향을 주지 않는다 | unit |
| 패리티 행이 UB↔UL 교환 + 센터 복원을 낸다 | unit |
| `gradeM2` 정답 (같은 상태, 다른 공식 순서 포함) | unit |
| `gradeM2` 다른 행과 같은 상태 → `other` | unit |
| `gradeM2` 항등 → `identity` | unit |
| `gradeM2` 완전히 다른 공식 → `wrong` | unit |
| `gradeM2` 알 수 없는 무브 → `invalid-move` | unit |
| parse/serialize 라운드트립이 같은 값을 복원한다 | unit |
| 깨진 JSON 로드 시 기본값으로 복구한다 | unit |
| 버전 불일치 시 기본값으로 복구한다 | unit |
| B 면 공식 6개(M·E·P·F·O·G)의 54칸 상태가 원래 x-rotation 공식과 같다 | unit |
| 시드 고정 ~300 스크램블: 짝수 타깃 → 전체 풀림 | unit |
| 시드 고정 ~300 스크램블: 홀수 타깃 + 패리티 → UB↔UL 만 남음 | unit |

## 이 Phase 에서 실제로 해당하는 경계 케이스

- 패리티 행의 `order: 'parity'` — 홀짝 로직이 적용되지 않는다.
- C·W·I·S 짝수 번째: 짝의 행 id(`c2`, `w2`, `i2`, `s2`)를 찾는다.
- A·Q: 짝이 버퍼라 순번과 무관하다. 짝수 번째도 같은 행을 쓴다.
- `gradeM2` 에 빈 문자열 입력 → `identity`.
