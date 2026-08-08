# Spec Validation Report

## Status: PASSED

## 검증 항목

### 요구사항 커버리지
- [x] SPEC의 FR-1~22 전부 페이즈에 배정됨 (미커버 0, 번호 공백 0)
- [x] SPEC의 NFR-1~9 전부 페이즈에 배정됨
- [x] 페이즈 간 중복 담당 0건
- [x] SPEC에 없는 요구사항 참조 0건

| Phase | 담당 |
|---|---|
| 1 | FR-1, 2, 13, 14, 15 / NFR-6 |
| 2 | FR-3~12 / NFR-1, 4, 5, 7, 9 |
| 3 | FR-16~19 |
| 4 | FR-20~22 / NFR-2, 3, 8 |

### PLAN-TEST 정합
- [x] 4개 PLAN 각각에 대응 TEST 존재
- [x] 각 PLAN의 완료 기준이 TEST의 완료 조건과 대응
- [x] SPEC 검증 체크리스트 18항목이 TEST 문서에 분산 수용됨

### 파일 참조 정확성
- [x] 문서가 참조하는 `handoff/` 자산 11건 전부 실재 확인

### 의존성
- [x] Phase 1 → 2 → 3 → 4 직렬. 순환 없음
- [x] 병렬 페이즈 없음 → `PHASE_k.5_PLAN_MERGE.md` 불필요
- [x] Phase 2가 Phase 1의 `sim.ts`·`loader.ts`·`types.ts`에 의존함이 명시됨
- [x] Phase 3이 Phase 2의 `Alg.svelte`·`settings`에 의존함이 명시됨
- [x] Phase 4가 Phase 2의 `--mono` 토큰과 `settings`를 확장함이 명시됨

## 수정된 이슈

| # | 이슈 | 조치 |
|---|---|---|
| 1 | NFR-6(로더 확장성)이 Phase 4에 배정. 실제 구현은 Phase 1의 `loader.ts` | Phase 1로 이동. Phase 1 TEST에 검증 항목 추가 |
| 2 | NFR-7(한국어 UI/영문 표기)이 Phase 4에 배정. 실제로는 Phase 2에서 UI 문구가 처음 생성됨 | Phase 2로 이동 |
| 3 | `--mono` 토큰 정의 페이즈가 불명확. Phase 2의 `Alg.svelte`가 이미 사용하는데 NFR-3은 Phase 4 담당 | Phase 2에서 정의, Phase 4는 테마 색만 추가하도록 명시 |
| 4 | `settings.svelte.ts`가 Phase 2 산출물인데 `theme` 필드는 Phase 4 소관 | Phase 2를 부분 구현(mode/notation)으로 명시하고 Phase 4에서 `theme` 추가로 기술 |

## 알려진 유보 사항

| # | 항목 | 사유 |
|---|---|---|
| 1 | E2E 테스트 실행 가능 여부 | Playwright 브라우저 바이너리 다운로드 성공에 의존. 실패 시 단위·컴포넌트 테스트 + 수동 체크리스트로 대체 (Phase 4 PLAN 4-6에 기술) |
| 2 | Phase 3 T3-1 #9의 엣지 오염 알고리즘 | 테스트 작성 시 시뮬레이터로 조건 충족을 먼저 확인한 뒤 상수로 고정 |

## 결론

구현 착수 가능. `/dotclaude:code 1`부터 진행한다.
