# Phase 2 — 테스트 계획

## 테스트 커버리지 목표

`domain/tracing.ts` 의 분기 전량. `tracing.svelte.ts`(runes 의존)는 단위 테스트 대상이 아니다 —
Phase 3~4 의 E2E 가 본다.

## 실행 명령

```bash
pnpm test tests/unit/tracing.test.ts
pnpm build
```

---

## 단위 테스트 (`tests/unit/tracing.test.ts`)

### T2-1. `optionsFrom` — 버퍼는 데이터에서 온다 (FR-TR-7)

`loadDataset()` 으로 실제 `meta` 를 읽는다. 버퍼 문자를 테스트에 리터럴로 박지 않는다.

| # | 검사 | 완료 조건 |
|---|---|---|
| 1 | `optionsFrom(ds.meta, 'corner', 'A').bufferStickers` | `ds.meta.bufferStickers` 와 동일 |
| 2 | `primarySticker` | `ds.meta.primarySticker` 와 동일 |
| 3 | `twistConvention` 전달 | `'A'`/`'B'` 그대로 |
| 4 | `meta` 를 UFR 판으로 바꾼 가짜 객체를 넘김 | 옵션이 따라 바뀐다 (코드 수정 없이) |
| 5 | `tracing.ts` 소스에 버퍼 리터럴 | 0건 |

### T2-2. 기록 파싱·직렬화 (제약)

| # | 입력 | 기대 |
|---|---|---|
| 1 | `null` | `[]` |
| 2 | `""` | `[]` |
| 3 | `"invalid json"` | `[]` (throw 없음) |
| 4 | `schemaVersion` 불일치 | `[]` |
| 5 | 정상 JSON 3건 | 3건 복원, 필드 전부 보존 |
| 6 | `records` 가 배열이 아님 | `[]` |
| 7 | 항목에 `buffer` 가 없음 | 그 항목 폐기 (또는 전체 폐기 — 결정적이면 된다) |
| 8 | round-trip | `parseRecords(serializeRecords(rs))` 가 `rs` 와 동일 |
| 9 | 저장 JSON | `schemaVersion: 1` 포함 |

### T2-3. 상한과 순서 (제약)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 50건에 1건 추가 | 길이 50, 가장 오래된 것이 빠진다 |
| 2 | 추가 후 첫 원소 | 방금 넣은 기록 |
| 3 | 60건짜리 저장물을 파싱 | 50건으로 잘린다 |
| 4 | 빈 배열에 추가 | 길이 1 |

### T2-4. 암기 진도와의 분리 (제약, AD-13)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | `RECORDS_KEY` | `'memorize.checked'` 가 아니다 |
| 2 | 트레이싱 기록 JSON 을 `memorize.parseStored` 에 넣음 | 빈 상태 반환 (섞이지 않는다) |
| 3 | `memorize` 저장물을 `parseRecords` 에 넣음 | `[]` |
| 4 | 두 스키마 버전 상수가 서로 독립된 export | true |

### T2-5. `verdictText` (FR-TR-11, 12, 20; NFR-TR-5)

| # | Verdict | 완료 조건 |
|---|---|---|
| 1 | 전 종류 (`correct`, `correct-extra`, `wrong-at` × 4 사유, `incomplete`, `twist-mismatch`, `invalid-letter`) | 전부 문구가 나온다. 빈 문자열 0건 |
| 2 | `wrong-at` 의 인덱스 | 표시 문구가 1부터 센다 |
| 3 | `correct-extra` | "오답" 이라고 말하지 않는다 (FR-TR-12) |
| 4 | 전 문구 | `축하`·`대단`·`연속`·`배지`·`점수` 문자열 0건 (NFR-TR-5) |
| 5 | switch | 새 Verdict 종류를 추가하면 타입 오류가 난다 (exhaustive) |

### T2-6. `conventionCompare` (FR-TR-24)

| # | 검사 | 완료 조건 |
|---|---|---|
| 1 | 비틀림 없는 상태 | `a === b` |
| 2 | 비틀림 있는 상태 | `a > b` |
| 3 | 무작위 200 상태 | 전부 `a >= b` |
| 4 | 코너 평균 | A 8.79 / B 6.37 근방 (비틀림 있는 표본 기준, ±0.2) |
| 5 | 패리티 | 두 관례에서 동일 (200/200) |

### T2-7. `formatMs`

| # | 입력 | 기대 |
|---|---|---|
| 1 | `84210` | `"1:24.21"` |
| 2 | `9999` | `"9.99"` |
| 3 | `0` | `"0.00"` |
| 4 | `3600000` 이상 | 자릿수가 깨지지 않는다 |

---

## 정적 검사

| # | 명령 | 완료 조건 |
|---|---|---|
| 1 | `grep -n "svelte\|localStorage\|browser" src/lib/domain/tracing.ts` | 0건 |
| 2 | `grep -nE "'(A\|E\|R\|UBL\|UF\|DF)'" src/lib/domain/tracing.ts` | 0건 |
| 3 | `grep -n "localStorage" src/lib/ui/tracing.svelte.ts` | 전부 `if (browser)` 또는 `$effect()` 안 |
| 4 | `grep -n "memorize" src/lib/ui/tracing.svelte.ts` | 0건 |
| 5 | `pnpm build` | 성공 (프리렌더 포함) |

## 완료 조건 종합

- [ ] T2-1 ~ T2-7 전량 통과
- [ ] 정적 검사 5항 통과
- [ ] 기존 테스트 회귀 0건
