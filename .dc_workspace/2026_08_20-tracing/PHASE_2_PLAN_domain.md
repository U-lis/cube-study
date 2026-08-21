# Phase 2 — 채점·세션 도메인 (domain)

**담당**: FR-TR-12, 13, 19, 20, 21, 23(저장), 24; 제약(기록 스키마)
**의존**: Phase 1.5 완료. `trace.ts` 가 있어야 한다
**병렬 불가**: `trace.ts` 위에 올라간다

## 목표

이 페이즈가 끝나면:
- 화면이 쓸 채점 결과 표현(문구 포함)과 관례 A/B 비교가 준비된다
- 세션 설정과 소요 시간 기록이 localStorage 에 저장·복원된다. **암기 진도와 분리된 키·스키마** 다
- 화면은 아직 없다. Vitest 로 전부 검증된다

## 선행 조건

- Phase 1.5 통과 (`pnpm test` / `pnpm build` 성공)

## 대응 SPEC

| FR/제약 | 내용 |
|---|---|
| FR-TR-12 | 타깃 수 초과 = 불필요한 끊기. 오답이 아니다 |
| FR-TR-13 | 패리티 표시 |
| FR-TR-19 | 훈련 대상 — 코너만 / 엣지만 / 코너 → 엣지 |
| FR-TR-20 | 정답 타깃 열 하나를 예시로. 정답이 여럿임을 함께 알린다 |
| FR-TR-21 | 훈련 모드 둘 (보고 따라가기 / 외운 다음 입력하기) |
| FR-TR-23 | 소요 시간 기록·표시 |
| FR-TR-24 | 관례 선택. 결과 화면에 두 관례의 타깃 수를 함께 |
| 제약 | 기록 필드 고정, 키·스키마 분리, 보관 상한 |

## 수정·생성할 파일

### `src/lib/domain/tracing.ts` (신규) — 순수 함수

Svelte·localStorage·`browser` 를 import 하지 않는다 (`memorize.ts` 와 같은 규율).

| 함수 | 시그니처 | 역할 |
|---|---|---|
| `optionsFrom` | `(meta: DatasetMeta, pieceKind: PieceKind, convention: TwistConvention) => TraceOptions` | 데이터셋 `meta` 에서 버퍼 정보를 읽어 엔진 옵션을 만든다. **버퍼가 코드에 등장하는 유일한 경계이며, 여기서도 리터럴이 아니라 `meta` 필드다** |
| `verdictText` | `(v: TraceVerdict) => string` | 판정 문구. 사실만 적는다 |
| `conventionCompare` | `(state, opts) => { a: number; b: number }` | 같은 상태를 관례 A·B 로 트레이싱한 타깃 수 (FR-TR-24) |
| `parseRecords` | `(raw: string \| null) => TraceRecord[]` | 방어적 파싱. 스키마 불일치·깨진 JSON → 빈 배열 |
| `serializeRecords` | `(rs: TraceRecord[]) => string` | 상한 적용 후 직렬화 |
| `pushRecord` | `(rs: TraceRecord[], r: TraceRecord) => TraceRecord[]` | 최근 것이 앞. 상한 초과분 폐기 |
| `formatMs` | `(ms: number) => string` | `84210 → "1:24.21"` |

`optionsFrom` 이 `meta.buffer`/`bufferStickers`/`primarySticker`(`src/lib/domain/types.ts:143-148`)를 읽는다.
엔진은 여전히 버퍼를 모른다 (FR-TR-7).

`verdictText` 문구는 dry 하게 쓴다 (NFR-TR-5, 기존 NFR-9). `grade.ts:60-76` 의 `verdictText` 와 같은 톤이다.
축하·배지·점수 표현을 쓰지 않는다.

| Verdict | 문구 예 |
|---|---|
| `correct` | `정답` |
| `correct-extra` | `풀립니다. 불필요한 끊기가 {n}회 있습니다` |
| `wrong-at` (`wrong-orientation`) | `{i}번째 타깃 — 조각은 맞지만 방향이 다릅니다` |
| `wrong-at` (`wrong-piece`) | `{i}번째 타깃 — 다른 조각입니다` |
| `wrong-at` (`already-solved`) | `{i}번째 타깃 — 이미 해결된 조각으로 끊었습니다` |
| `wrong-at` (`buffer-sticker`) | `{i}번째 타깃 — 버퍼 스티커는 타깃이 될 수 없습니다` |
| `incomplete` | `아직 {n}개 조각이 남았습니다` |
| `twist-mismatch` | `비틀림 선언이 다릅니다 — 빠짐 {…}, 없는 것 {…}` |
| `invalid-letter` | `{i}번째 문자가 이 세션의 조각 종류가 아닙니다` |

**타깃 인덱스는 1부터 센다.** 사용자가 세는 방식이다.

### 타입 (같은 파일)

```ts
export type TrainKind = 'corner' | 'edge' | 'both';
export type TrainMode = 'follow' | 'memorize';

export interface TraceRecord {
  at: number; ms: number;
  pieceKind: PieceKind; buffer: Cubie;
  mode: TrainMode; targetCount: number; correct: boolean;
}

export const RECORD_LIMIT = 50;
export const RECORDS_SCHEMA_VERSION = 1;
export const RECORDS_KEY = 'trace.records';
```

**관례(A/B)를 기록 필드에 넣지 않는다.** SPEC 이 필드를 고정했다. 넣고 싶어지는 이유(관례가 타깃 수를
바꾼다)는 타당하지만 범위 밖이며, 필요해지면 스키마 v2 마이그레이션이 된다 (#23).

### `src/lib/ui/tracing.svelte.ts` (신규) — 상태 싱글턴

`settings.svelte.ts:33-43` 의 `$effect.root()` + `$effect()` 자동 저장 패턴을 따른다.

| 필드 | 키 | 기본 |
|---|---|---|
| `pieceKind: TrainKind` | `trace.pieceKind` | `'corner'` |
| `mode: TrainMode` | `trace.mode` | `'follow'` |
| `convention: 'A' \| 'B'` | `trace.convention` | `'A'` |
| `records: TraceRecord[]` | `trace.records` | `[]` |

메서드: `add(r: TraceRecord)`, `recent(n: number)`, `clear()`.

**`memorize.svelte.ts` 에 얹지 않는다.** `memorize.ts:51` 의 `parseStored` 는 `schemaVersion` 불일치 시
저장물을 전부 버린다 — 같은 키를 쓰면 트레이싱 스키마를 올릴 때 암기 진도가 날아간다 (GLOBAL AD-13).

localStorage 접근은 전부 `if (browser)` 또는 `$effect()` 안이다 (프리렌더에서 죽는다).

## 구현 순서

1. 타입 + `parseRecords`/`serializeRecords`/`pushRecord` + 테스트 (TDD)
2. `optionsFrom` + 테스트 — `meta` 에서 버퍼가 나오는지
3. `verdictText` + 테스트 (전 Verdict 분기)
4. `conventionCompare` + 테스트
5. `formatMs`
6. `tracing.svelte.ts` 싱글턴
7. `pnpm build` 로 프리렌더 확인

## 완료 체크리스트

- [ ] `pnpm test` / `pnpm check` / `pnpm build` 통과
- [ ] `grep -n "svelte\|localStorage" src/lib/domain/tracing.ts` 0건
- [ ] `grep -nE "'(A|E|R|UBL|UF)'" src/lib/domain/tracing.ts` 0건 — 버퍼는 `meta` 에서만 온다
- [ ] `parseRecords(null)` / 깨진 JSON / 스키마 불일치가 전부 빈 배열
- [ ] 기록 상한 50건 초과 시 오래된 것부터 버린다
- [ ] `RECORDS_KEY !== 'memorize.checked'` 이고 스키마 버전이 독립이다
- [ ] 트레이싱 기록을 저장해도 `memorize.checked` 가 그대로다
- [ ] `verdictText` 가 모든 Verdict 종류를 다룬다 (누락 시 타입 오류가 나도록 switch 를 exhaustive 하게)
- [ ] 문구에 축하·배지·점수 표현이 없다 (NFR-TR-5)
- [ ] `conventionCompare` 가 같은 상태에서 A ≥ B 를 만족한다

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|---|---|
| 암기 진도 소실 | 키·스키마 분리를 테스트로 못 박는다 |
| 기록 무한 증가 | 상한 50. `pushRecord` 가 자른다 |
| 관례를 기록에 추가 | SPEC 이 필드를 고정했다. 넣지 않는다 |
| 채점 로직을 여기서 다시 구현 | 채점은 `trace.ts` 다. 이 파일은 표현만 담당한다 |
| 문구가 사용자 인덱스와 어긋남 | 표시용 인덱스는 1부터. 내부 인덱스는 0부터. 변환 지점을 한 곳으로 |
| 프리렌더에서 localStorage 접근 | `if (browser)` 가드 (`settings.svelte.ts:16`) |
