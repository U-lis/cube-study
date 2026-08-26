/**
 * Phase 2 — 채점·세션 도메인.
 *
 * 여기서 보는 것은 **표현과 저장** 이다. 채점 자체는 `trace.test.ts` 가 본다.
 * 버퍼 문자를 이 파일에 리터럴로 박지 않는다 — 실제 `meta` 에서 읽는다. 그래야
 * 데이터를 갈아끼웠을 때 이 테스트가 함께 따라간다 (FR-TR-7).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// 진입점을 쓰는 것은 `Cube.random()` 때문이다. `initSolver()` 는 부르지 않는다 —
// 랜덤 스테이트 생성에 풀이기가 필요 없다.
import Cube from 'cubejs';
import { loadDataset } from '../../src/lib/data/loader.js';
import { parseStored, serialize } from '../../src/lib/domain/memorize.js';
import { faceletColors } from '../../src/lib/ui/facelets.js';
import {
	CORNER_CUBIE,
	CORNER_INDEX,
	CORNER_LETTERS,
	CORNER_ROTATION,
	EDGE_CUBIE,
	EDGE_INDEX,
	EDGE_LETTERS,
	EDGE_ROTATION
} from '../../src/lib/cube/speffz.js';
import type { EntryReading, TraceVerdict } from '../../src/lib/cube/trace.js';
import {
	buildMarks,
	caseConflicts,
	combineVerdicts,
	entrySegments,
	hasSeparator,
	isPass,
	joinBuffers,
	kindsOf,
	partsVerdictText,
	segmentIndex,
	conventionOf,
	formatMs,
	isTwistConvention,
	readingText,
	optionsFrom,
	parseRecords,
	pushRecord,
	sanitizeEntry,
	serializeRecords,
	twistEntries,
	verdictText,
	BUFFER_JOIN,
	CONVENTIONS,
	ENTRY_SEPARATOR,
	PART_LABELS,
	RECORD_KIND_LABELS,
	MARK_PALETTE,
	RECORDS_KEY,
	RECORDS_SCHEMA_VERSION,
	RECORD_LIMIT,
	type TraceRecord
} from '../../src/lib/domain/tracing.js';

const ds = await loadDataset();

/** 판독 결과 한 건. `readEntry` 의 산출 형태만 흉내 낸다 — 판독 자체는 엔진 테스트가 본다. */
const reading = (targets: string[], twists: string[]): EntryReading => ({
	targets,
	twists,
	roles: [...targets.map(() => 'target' as const), ...twists.map(() => 'twist' as const)],
	targetAt: targets.map((_, i) => i),
	twistAt: twists.map((_, i) => targets.length + i),
	separated: twists.length > 0,
	absorbed: 0
});

/** 기록 한 건. 버퍼는 데이터에서 가져온다. */
const rec = (over: Partial<TraceRecord> = {}): TraceRecord => ({
	at: 1755660000000,
	ms: 84210,
	pieceKind: 'corner',
	buffer: ds.meta.buffer,
	mode: 'memorize',
	twistConvention: 'A',
	targetCount: 8,
	correct: true,
	...over
});

describe('T2-1 optionsFrom — 버퍼는 데이터에서 온다 (FR-TR-7)', () => {
	it('bufferStickers 가 meta 그대로다', () => {
		expect(optionsFrom(ds.meta, 'corner', 'A').bufferStickers).toEqual(ds.meta.bufferStickers);
	});

	it('primarySticker 가 meta 그대로다', () => {
		expect(optionsFrom(ds.meta, 'corner', 'A').primarySticker).toBe(ds.meta.primarySticker);
	});

	it('관례를 그대로 전달한다', () => {
		expect(optionsFrom(ds.meta, 'corner', 'A').twistConvention).toBe('A');
		expect(optionsFrom(ds.meta, 'corner', 'B').twistConvention).toBe('B');
		expect(optionsFrom(ds.meta, 'edge', 'B').pieceKind).toBe('edge');
	});

	it('meta 를 바꾸면 옵션이 따라 바뀐다 (코드 수정 없이)', () => {
		// UFR 판(#24)을 흉내낸 가짜 meta. 이 저장소에 아직 없는 데이터셋이지만
		// 스키마가 같으므로 옵션 경로는 지금 확인할 수 있다.
		const other = { ...ds.meta, buffer: 'UFR', bufferStickers: ['F', 'J', 'M'], primarySticker: 'F' };
		const opts = optionsFrom(other, 'corner', 'A');
		expect(opts.bufferStickers).toEqual(['F', 'J', 'M']);
		expect(opts.primarySticker).toBe('F');
		// 원래 데이터와 겹치지 않는다 — 진짜로 갈아끼워졌다.
		expect(opts.bufferStickers).not.toEqual(ds.meta.bufferStickers);
	});
});

describe('T2-2 기록 파싱·직렬화', () => {
	it('null 은 빈 배열', () => expect(parseRecords(null)).toEqual([]));
	it('빈 문자열은 빈 배열', () => expect(parseRecords('')).toEqual([]));
	it('깨진 JSON 은 빈 배열 (던지지 않는다)', () => {
		expect(() => parseRecords('invalid json')).not.toThrow();
		expect(parseRecords('invalid json')).toEqual([]);
	});
	it('스키마 버전 불일치는 빈 배열', () => {
		const raw = JSON.stringify({ schemaVersion: RECORDS_SCHEMA_VERSION + 1, records: [rec()] });
		expect(parseRecords(raw)).toEqual([]);
	});
	it('정상 3건은 필드를 전부 보존해 복원한다', () => {
		const rs = [rec({ ms: 1 }), rec({ ms: 2, correct: false }), rec({ ms: 3, pieceKind: 'edge' })];
		const back = parseRecords(serializeRecords(rs));
		expect(back).toEqual(rs);
		expect(Object.keys(back[0]).sort()).toEqual(
			['at', 'buffer', 'correct', 'mode', 'ms', 'pieceKind', 'targetCount', 'twistConvention'].sort()
		);
	});
	it('records 가 배열이 아니면 빈 배열', () => {
		expect(parseRecords(JSON.stringify({ schemaVersion: RECORDS_SCHEMA_VERSION, records: 3 }))).toEqual([]);
		expect(parseRecords(JSON.stringify({ schemaVersion: RECORDS_SCHEMA_VERSION }))).toEqual([]);
		expect(parseRecords('[]')).toEqual([]);
		expect(parseRecords('null')).toEqual([]);
	});
	it('buffer 가 없는 항목은 그 항목만 버린다', () => {
		const broken = { ...rec() } as Partial<TraceRecord>;
		delete broken.buffer;
		const raw = JSON.stringify({
			schemaVersion: RECORDS_SCHEMA_VERSION,
			records: [broken, rec({ ms: 7 })]
		});
		expect(parseRecords(raw)).toEqual([rec({ ms: 7 })]);
	});
	it('모르는 값의 열거형 필드도 그 항목만 버린다', () => {
		const raw = JSON.stringify({
			schemaVersion: RECORDS_SCHEMA_VERSION,
			records: [rec({ mode: 'zzz' as never }), rec({ twistConvention: 'C' as never }), rec()]
		});
		expect(parseRecords(raw)).toEqual([rec()]);
	});
	it('round-trip 이 동일하다', () => {
		const rs = [rec({ ms: 10 }), rec({ ms: 20 })];
		expect(parseRecords(serializeRecords(rs))).toEqual(rs);
	});
	it('저장 JSON 에 지금 스키마 버전이 들어간다', () => {
		expect(JSON.parse(serializeRecords([rec()])).schemaVersion).toBe(RECORDS_SCHEMA_VERSION);
	});

	it('스키마 v1 기록은 버린다 (뜻이 바뀌었다)', () => {
		// v2 에서 `pieceKind` 에 `both` 가 들어가고 `targetCount` 가 합계가 됐다.
		// 필드 이름은 그대로라 형태 검사로는 안 걸린다 — 버전이 유일한 근거다.
		expect(RECORDS_SCHEMA_VERSION).toBeGreaterThan(1);
		expect(parseRecords(JSON.stringify({ schemaVersion: 1, records: [rec()] }))).toEqual([]);
	});
});

describe('T2-3 상한과 순서', () => {
	const many = (n: number) => Array.from({ length: n }, (_, i) => rec({ ms: i }));

	it('50건에 1건을 더하면 가장 오래된 것이 빠진다', () => {
		const full = many(RECORD_LIMIT);
		const next = pushRecord(full, rec({ ms: 999 }));
		expect(next).toHaveLength(RECORD_LIMIT);
		expect(next.at(-1)).toEqual(full.at(-2));
		expect(next).not.toContainEqual(full.at(-1));
	});
	it('추가 후 첫 원소가 방금 넣은 기록이다', () => {
		expect(pushRecord(many(3), rec({ ms: 999 }))[0].ms).toBe(999);
	});
	it('60건짜리 저장물은 50건으로 잘린다', () => {
		const raw = JSON.stringify({ schemaVersion: RECORDS_SCHEMA_VERSION, records: many(60) });
		expect(parseRecords(raw)).toHaveLength(RECORD_LIMIT);
		expect(JSON.parse(serializeRecords(many(60))).records).toHaveLength(RECORD_LIMIT);
	});
	it('빈 배열에 추가하면 1건', () => {
		expect(pushRecord([], rec())).toHaveLength(1);
	});
});

describe('T2-4 암기 진도와의 분리 (AD-13)', () => {
	it('저장 키가 암기 체크의 것과 다르다', () => {
		expect(RECORDS_KEY).not.toBe('memorize.checked');
	});
	it('트레이싱 기록을 암기 파서에 넣으면 빈 상태다', () => {
		const parsed = parseStored(serializeRecords([rec()]));
		expect(parsed.setup.size).toBe(0);
		expect(parsed.direct.size).toBe(0);
	});
	it('암기 저장물을 기록 파서에 넣으면 빈 배열이다', () => {
		const raw = serialize({ setup: new Set(['AB']), direct: new Set(['CD']) });
		expect(parseRecords(raw)).toEqual([]);
	});
	it('두 스키마 버전이 서로 독립된 export 다', async () => {
		// 암기 쪽 버전은 export 되지 않는다 — 둘이 한 상수를 공유할 길 자체가 없다.
		const mod = await import('../../src/lib/domain/memorize.js');
		expect(Object.keys(mod)).not.toContain('SCHEMA_VERSION');
		// 기록 스키마를 올려도 암기 진도는 그대로다. 두 버전이 따로 움직인다는 것이
		// 이 분리의 전부다 — 여기서 같은 수를 기대하면 그 독립이 깨진 것이다.
		expect(parseStored(serialize({ setup: new Set(['AB']), direct: new Set() }))).toEqual({
			setup: new Set(['AB']),
			direct: new Set()
		});
	});
});

describe('T2-4b conventionOf · readingText (요구 1)', () => {
	it('비틀림 선언이 없으면 끊어서 처리로 적는다', () => {
		expect(CONVENTIONS[conventionOf(false)]).toBe(CONVENTIONS.A);
	});

	it('비틀림 선언이 있으면 따로 처리로 적는다', () => {
		expect(CONVENTIONS[conventionOf(true)]).toBe(CONVENTIONS.B);
	});

	it('두 값이 서로 다르고 둘 다 알려진 관례다', () => {
		expect(conventionOf(true)).not.toBe(conventionOf(false));
		expect(isTwistConvention(conventionOf(true))).toBe(true);
		expect(isTwistConvention(conventionOf(false))).toBe(true);
	});

	it('선언이 없으면 전부 타깃으로 읽었다고 적는다', () => {
		expect(readingText(reading([], []))).toBe('전부 타깃으로 읽었습니다');
	});

	it('선언을 문자로 밝힌다', () => {
		expect(readingText(reading(['K'], ['B']))).toContain('B');
		expect(readingText(reading(['K'], ['B']))).toContain('비틀림');
	});

	it('축하·배지 표현이 없다 (NFR-TR-5)', () => {
		for (const text of [readingText(reading([], [])), readingText(reading(['K'], ['B']))])
			for (const word of ['축하', '배지', '연속', '점수']) expect(text).not.toContain(word);
	});
});

describe('T2-5 verdictText (NFR-TR-5)', () => {
	const ALL: TraceVerdict[] = [
		{ kind: 'correct' },
		{ kind: 'correct-extra', extra: 2 },
		{ kind: 'wrong-at', index: 2, reason: 'wrong-orientation', expected: 'K' },
		{ kind: 'wrong-at', index: 0, reason: 'wrong-piece', expected: 'K' },
		{ kind: 'wrong-at', index: 4, reason: 'already-solved', expected: null },
		{ kind: 'wrong-at', index: 1, reason: 'buffer-sticker', expected: null },
		{ kind: 'incomplete', remaining: ['UBL', 'DFR'] },
		{ kind: 'twist-mismatch', missing: ['K'], unexpected: [] },
		{ kind: 'invalid-letter', index: 3, letter: 'z' }
	];

	it('모든 종류에 문구가 있다', () => {
		for (const v of ALL) expect(verdictText(v), v.kind).not.toBe('');
	});
	it('wrong-at 의 인덱스는 1부터 센다', () => {
		expect(verdictText({ kind: 'wrong-at', index: 2, reason: 'wrong-piece', expected: null })).toMatch(/^3번째/);
		expect(verdictText({ kind: 'invalid-letter', index: 0, letter: 'z' })).toMatch(/^1번째/);
	});
	it('correct-extra 를 오답이라 말하지 않는다 (FR-TR-12)', () => {
		const t = verdictText({ kind: 'correct-extra', extra: 2 });
		expect(t).not.toMatch(/오답|틀렸/);
		expect(t).toContain('2');
	});
	it('축하·배지·점수 표현이 없다', () => {
		for (const v of ALL)
			for (const bad of ['축하', '대단', '연속', '배지', '점수'])
				expect(verdictText(v), `${v.kind} / ${bad}`).not.toContain(bad);
	});
	it('twist-mismatch 의 빈 목록도 문장이 끊기지 않는다', () => {
		expect(verdictText({ kind: 'twist-mismatch', missing: [], unexpected: ['K'] })).toContain('K');
	});
	it('모르는 종류는 던진다 (switch 가 exhaustive 하다)', () => {
		// 타입 오류는 컴파일이 잡는다(`never` 대입). 실행 시점의 마지막 방어를 확인한다.
		expect(() => verdictText({ kind: 'nope' } as unknown as TraceVerdict)).toThrow();
	});
});

describe('T2-7 formatMs', () => {
	it('1분을 넘으면 분:초.센티', () => expect(formatMs(84210)).toBe('1:24.21'));
	it('1분 미만은 초.센티', () => expect(formatMs(9999)).toBe('9.99'));
	it('0 은 0.00', () => expect(formatMs(0)).toBe('0.00'));
	it('한 시간을 넘겨도 자릿수가 깨지지 않는다', () => {
		expect(formatMs(3600000)).toBe('60:00.00');
		expect(formatMs(3661230)).toBe('61:01.23');
	});
	it('초가 한 자리여도 분 뒤에서는 두 자리로 채운다', () => {
		expect(formatMs(63000)).toBe('1:03.00');
	});
	it('음수는 0 으로 본다 (시계가 뒤로 간 값을 표에 싣지 않는다)', () => {
		expect(formatMs(-5)).toBe('0.00');
	});
});

// ─────────────────────────────────────────────────────────────
// Phase 4 — 입력 정리 (T4-1, T4-2 의 순수부)
// ─────────────────────────────────────────────────────────────

/** 갈래 묶음. 문자열을 그대로 넘기면 타입이 넓어져 오타가 안 잡힌다. */
const CORNER_ONLY = kindsOf('corner');
const EDGE_ONLY = kindsOf('edge');
const BOTH = kindsOf('both');

describe('T4-0 sanitizeEntry (FR-TR-18)', () => {
	const many = { max: 99 };

	it('코너 세션은 대문자로 맞춘다', () => {
		expect(sanitizeEntry('kbd', CORNER_ONLY, many)).toEqual(['K', 'B', 'D']);
	});

	it('엣지 세션은 소문자로 맞춘다', () => {
		expect(sanitizeEntry('KBD', EDGE_ONLY, many)).toEqual(['k', 'b', 'd']);
	});

	it('알파벳이 아닌 문자는 구분자로 보고 버린다', () => {
		expect(sanitizeEntry('K B, D\n', CORNER_ONLY, many)).toEqual(['K', 'B', 'D']);
	});

	it('24글자 밖의 문자는 받지 않는다', () => {
		// Speffz 는 A~X 다. Y·Z 는 어느 조각도 지목하지 않는다.
		expect(sanitizeEntry('KYZB', CORNER_ONLY, many)).toEqual(['K', 'B']);
	});

	it('버퍼 문자도 그대로 통과한다 (잠금 없음)', () => {
		// 한 줄 입력에서 버퍼는 비틀림 선언으로 정당하게 쓰인다. 잠글 자리가
		// 문맥에 따라 갈리면 사용자가 예측할 수 없어 아예 잠그지 않는다.
		const buffer = ds.meta.bufferStickers;
		expect(sanitizeEntry([...buffer, 'K'].join(''), CORNER_ONLY, many)).toEqual([...buffer, 'K']);
	});

	it('상한을 넘으면 자른다', () => {
		expect(sanitizeEntry('KBDLM', CORNER_ONLY, { max: 2 })).toEqual(['K', 'B']);
	});

	it('상한이 0 이면 빈 열이다', () => {
		expect(sanitizeEntry('KBD', CORNER_ONLY, { max: 0 })).toEqual([]);
	});

	it('빈 문자열은 빈 열이다', () => {
		expect(sanitizeEntry('', CORNER_ONLY, many)).toEqual([]);
	});
});

/**
 * 요구 2 — `both` 한 판을 한 줄로 치고 한 번에 채점한다.
 *
 * 여기서 보는 것은 **구분자의 규칙** 이다. 채점 자체는 `trace.test.ts` 가 보고,
 * 화면 조립은 `tests/e2e/trace-*.spec.ts` 가 본다.
 */
describe('요구 2 구분자 파싱', () => {
	const many = { max: 99 };

	it('구분자 앞은 코너, 뒤는 엣지로 맞춘다', () => {
		// 앞은 소문자로, 뒤는 대문자로 쳐도 구분자가 갈래를 정한다.
		expect(sanitizeEntry(`kb${ENTRY_SEPARATOR}KB`, BOTH, many)).toEqual([
			'K',
			'B',
			ENTRY_SEPARATOR,
			'k',
			'b'
		]);
	});

	it('갈래가 하나면 구분자를 버린다', () => {
		expect(sanitizeEntry(`KB${ENTRY_SEPARATOR}KB`, CORNER_ONLY, many)).toEqual([
			'K',
			'B',
			'K',
			'B'
		]);
	});

	it('구분자는 한 번만 선다', () => {
		const out = sanitizeEntry(`K${ENTRY_SEPARATOR}c${ENTRY_SEPARATOR}i`, BOTH, many);
		expect(out.filter((c) => c === ENTRY_SEPARATOR)).toHaveLength(1);
		expect(out).toEqual(['K', ENTRY_SEPARATOR, 'c', 'i']);
	});

	it('상한은 글자만 센다 — 구분자는 자리를 뺏지 않는다', () => {
		const out = sanitizeEntry(`KBD${ENTRY_SEPARATOR}ci`, BOTH, { max: 2 });
		expect(out).toEqual(['K', 'B', ENTRY_SEPARATOR]);
	});

	it('구분자로 가른 두 열이 갈래별로 나온다', () => {
		expect(entrySegments(['K', 'B', ENTRY_SEPARATOR, 'c', 'i'], BOTH)).toEqual([
			{ kind: 'corner', letters: ['K', 'B'] },
			{ kind: 'edge', letters: ['c', 'i'] }
		]);
	});

	it('구분자가 없으면 엣지 열이 비어 있다', () => {
		expect(entrySegments(['K', 'B'], BOTH)).toEqual([
			{ kind: 'corner', letters: ['K', 'B'] },
			{ kind: 'edge', letters: [] }
		]);
	});

	it('구분자를 지우면 다시 코너 갈래다 (패드가 되돌아가는 근거)', () => {
		const split = ['K', ENTRY_SEPARATOR, 'c'];
		expect(hasSeparator(split)).toBe(true);
		expect(segmentIndex(split, BOTH)).toBe(1);
		const undone = split.slice(0, 1);
		expect(hasSeparator(undone)).toBe(false);
		expect(segmentIndex(undone, BOTH)).toBe(0);
	});

	it('갈래가 하나면 구분자를 지나도 번호가 늘지 않는다', () => {
		expect(segmentIndex(['K', ENTRY_SEPARATOR, 'B'], CORNER_ONLY)).toBe(0);
	});

	it('대소문자는 교차 검증으로만 쓴다 — 어긋난 글자를 센다', () => {
		// 구분자가 정본이라 판정은 그대로 가고, 어긋난 글자 수만 따로 알린다.
		expect(caseConflicts(`kb${ENTRY_SEPARATOR}ci`, BOTH)).toBe(2);
		expect(caseConflicts(`KB${ENTRY_SEPARATOR}ci`, BOTH)).toBe(0);
		expect(caseConflicts(`KB${ENTRY_SEPARATOR}CI`, BOTH)).toBe(2);
	});

	it('갈래가 하나면 셀 것이 없다', () => {
		expect(caseConflicts('kb', CORNER_ONLY)).toBe(0);
	});

	it('구분자는 24글자 어느 쪽에도 없다', () => {
		expect(CORNER_LETTERS).not.toContain(ENTRY_SEPARATOR);
		expect(EDGE_LETTERS).not.toContain(ENTRY_SEPARATOR);
	});
});

describe('요구 2 both 채점 — 갈래별 판정, 기록 한 건', () => {
	const pass: TraceVerdict = { kind: 'correct' };
	const extra: TraceVerdict = { kind: 'correct-extra', extra: 2 };
	const wrong: TraceVerdict = {
		kind: 'wrong-at',
		index: 1,
		reason: 'wrong-piece',
		expected: null
	};

	it('둘 다 맞으면 정답이다', () => {
		expect(
			combineVerdicts([
				{ kind: 'corner', verdict: pass },
				{ kind: 'edge', verdict: pass }
			])
		).toEqual(pass);
	});

	it('한쪽만 틀리면 그 판정이 그대로 올라온다', () => {
		expect(
			combineVerdicts([
				{ kind: 'corner', verdict: pass },
				{ kind: 'edge', verdict: wrong }
			])
		).toEqual(wrong);
	});

	it('불필요한 끊기는 갈래를 넘어 합쳐진다', () => {
		expect(
			combineVerdicts([
				{ kind: 'corner', verdict: extra },
				{ kind: 'edge', verdict: extra }
			])
		).toEqual({ kind: 'correct-extra', extra: 4 });
	});

	it('갈래가 둘이면 어느 쪽인지 문구에 남는다', () => {
		const text = partsVerdictText([
			{ kind: 'corner', verdict: pass },
			{ kind: 'edge', verdict: wrong }
		]);
		expect(text).toContain(PART_LABELS.corner);
		expect(text).toContain(PART_LABELS.edge);
		expect(text).toContain(verdictText(wrong));
	});

	it('갈래가 하나면 이름을 붙이지 않는다', () => {
		expect(partsVerdictText([{ kind: 'corner', verdict: pass }])).toBe(verdictText(pass));
	});

	it('풀리는 판정 둘만 통과로 센다', () => {
		expect(isPass(pass)).toBe(true);
		expect(isPass(extra)).toBe(true);
		expect(isPass(wrong)).toBe(false);
		expect(isPass({ kind: 'incomplete', remaining: [] })).toBe(false);
	});

	it('기록은 한 판에 한 건이고 pieceKind 에 both 가 들어간다', () => {
		const r = rec({ pieceKind: 'both', targetCount: 20 });
		const rs = pushRecord([], r);
		expect(rs).toHaveLength(1);
		expect(parseRecords(serializeRecords(rs))).toEqual(rs);
	});

	it('both 기록의 버퍼 칸에 두 버퍼가 함께 남는다', () => {
		const joined = joinBuffers([ds.meta.buffer, edgeBuffer.buffer]);
		expect(joined).toContain(ds.meta.buffer);
		expect(joined).toContain(edgeBuffer.buffer);
		expect(joined.split(BUFFER_JOIN)).toHaveLength(2);
		// 형태 검사를 통과해야 저장에서 되살아난다.
		expect(parseRecords(serializeRecords([rec({ pieceKind: 'both', buffer: joined })]))).toHaveLength(1);
	});

	it('갈래가 하나면 버퍼 칸이 그대로다', () => {
		expect(joinBuffers([ds.meta.buffer])).toBe(ds.meta.buffer);
	});

	it('both 는 기록 목록에서 두 조각을 함께 부른다', () => {
		expect(RECORD_KIND_LABELS.both).toContain(PART_LABELS.corner);
		expect(RECORD_KIND_LABELS.both).toContain(PART_LABELS.edge);
	});

	it('kindsOf 가 구분자의 앞뒤 순서를 정한다', () => {
		expect(kindsOf('both')).toEqual(['corner', 'edge']);
		expect(kindsOf('corner')).toEqual(['corner']);
		expect(kindsOf('edge')).toEqual(['edge']);
	});
});

describe('T4-0 twistEntries (FR-TR-24, AD-8)', () => {
	it('버퍼 큐비의 비틀림에 표시가 붙는다', () => {
		const buffer = ds.meta.bufferStickers[0];
		const [entry] = twistEntries([buffer], 'corner', ds.meta.buffer);
		expect(entry).toEqual({ letter: buffer, isBuffer: true });
	});

	it('버퍼가 아닌 문자에는 붙지 않는다', () => {
		const other = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		expect(twistEntries([other], 'corner', ds.meta.buffer)[0].isBuffer).toBe(false);
	});

	it('같은 큐비의 다른 스티커도 버퍼로 잡힌다 (방향이 달라도 조각은 같다)', () => {
		// 버퍼 스티커는 셋 다 같은 큐비다. 비틀림 표기는 그중 어느 자리든 될 수 있다.
		for (const s of ds.meta.bufferStickers)
			expect(twistEntries([s], 'corner', ds.meta.buffer)[0].isBuffer).toBe(true);
	});

	it('빈 목록은 빈 배열이다', () => {
		expect(twistEntries([], 'corner', ds.meta.buffer)).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────
// Phase 5 — buildMarks (T5-1)
// ─────────────────────────────────────────────────────────────

/** 엣지 버퍼. 데이터셋(#16)이 없으므로 좌표에서 만든다 — 리터럴을 적지 않는다. */
const edgeBuffer = (() => {
	const letter = EDGE_LETTERS[0];
	const cubie = EDGE_CUBIE[letter];
	return {
		buffer: cubie,
		bufferStickers: EDGE_ROTATION[cubie],
		primarySticker: letter
	};
})();

/** 칠해진 칸의 인덱스. */
const painted = (marks: ReturnType<typeof buildMarks>): number[] =>
	marks.flatMap((m, i) => (m ? [i] : []));

describe('T5-1 buildMarks (FR-TR-16, 7)', () => {
	it('빈 입력 열이면 한 칸도 안 칠해진다', () => {
		expect(painted(buildMarks('corner', []))).toEqual([]);
		expect(painted(buildMarks('edge', []))).toEqual([]);
	});

	it('버퍼 조각은 입력에 없는 한 칠해지지 않는다 — 실물에 그런 표시가 없다', () => {
		// 코너: 버퍼 UBL 의 세 칸. 엣지: 위 edgeBuffer 의 두 칸.
		const target = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		const marks = buildMarks('corner', [target]);
		for (const s of CORNER_ROTATION[ds.meta.buffer]) expect(marks[CORNER_INDEX[s]]).toBeNull();
		const eTarget = EDGE_LETTERS.find((l) => !edgeBuffer.bufferStickers.includes(l))!;
		const eMarks = buildMarks('edge', [eTarget]);
		for (const s of EDGE_ROTATION[edgeBuffer.buffer]) expect(eMarks[EDGE_INDEX[s]]).toBeNull();
	});

	it('코너 타깃 하나면 그 조각의 3칸 전부가 현재 타깃 색이다', () => {
		const target = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		const marks = buildMarks('corner', [target]);
		const cells = CORNER_ROTATION[CORNER_CUBIE[target]].map((s) => CORNER_INDEX[s]);
		expect(cells).toHaveLength(3);
		for (const i of cells) expect(marks[i]).toEqual(MARK_PALETTE.current);
	});

	it('엣지 타깃 하나면 2칸 전부다', () => {
		const target = EDGE_LETTERS.find((l) => !edgeBuffer.bufferStickers.includes(l))!;
		const marks = buildMarks('edge', [target]);
		const cells = EDGE_ROTATION[EDGE_CUBIE[target]].map((s) => EDGE_INDEX[s]);
		expect(cells).toHaveLength(2);
		for (const i of cells) expect(marks[i]).toEqual(MARK_PALETTE.current);
	});

	it('타깃 5개면 마지막 하나가 현재, 앞 4개가 지나간 조각이다', () => {
		const entered = CORNER_LETTERS.filter((l) => !ds.meta.bufferStickers.includes(l)).slice(0, 5);
		const marks = buildMarks('corner', entered);
		entered.forEach((letter, n) => {
			const want = n === 4 ? MARK_PALETTE.current : MARK_PALETTE.visited;
			for (const s of CORNER_ROTATION[CORNER_CUBIE[letter]])
				expect(marks[CORNER_INDEX[s]], `${letter}`).toEqual(want);
		});
	});

	it('타깃 25개도 상한 없이 전부 칠해진다', () => {
		// 24글자를 다 쓰고 하나 더 얹는다. 지나간 조각에는 개수 상한이 없다.
		const entered = [...EDGE_LETTERS, EDGE_LETTERS[0]];
		expect(entered).toHaveLength(25);
		const marks = buildMarks('edge', entered);
		// 엣지 24문자는 12큐비 × 2칸 = 24칸. 큐브의 엣지 칸 전부다.
		expect(painted(marks)).toHaveLength(24);
	});

	it('같은 큐비가 두 번 나오면 마지막 것이 현재로 이긴다 (결정적)', () => {
		const letter = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		// 같은 큐비의 다른 스티커. 방향은 달라도 조각은 같다.
		const sibling = CORNER_ROTATION[CORNER_CUBIE[letter]].find((s) => s !== letter)!;
		const other = CORNER_LETTERS.find(
			(l) => CORNER_CUBIE[l] !== CORNER_CUBIE[letter] && !ds.meta.bufferStickers.includes(l)
		)!;
		const marks = buildMarks('corner', [letter, other, sibling]);
		for (const s of CORNER_ROTATION[CORNER_CUBIE[letter]])
			expect(marks[CORNER_INDEX[s]]).toEqual(MARK_PALETTE.current);
		for (const s of CORNER_ROTATION[CORNER_CUBIE[other]])
			expect(marks[CORNER_INDEX[s]]).toEqual(MARK_PALETTE.visited);
	});

	it('반환 배열은 언제나 54칸이다', () => {
		for (const entered of [[], ['K'], CORNER_LETTERS])
			expect(buildMarks('corner', entered)).toHaveLength(54);
	});

	it('모든 Mark 이 color 와 outline 을 함께 갖는다 (색 단독 금지)', () => {
		const marks = buildMarks('corner', CORNER_LETTERS);
		const hits = marks.filter((m) => m !== null);
		expect(hits.length).toBeGreaterThan(0);
		for (const m of hits) {
			expect(typeof m!.color).toBe('string');
			expect(['solid', 'dashed', 'double']).toContain(m!.outline);
		}
	});

	it('두 종류의 색이 서로 다르다', () => {
		const { current, visited } = MARK_PALETTE;
		expect(new Set([current.color, visited.color]).size).toBe(2);
	});

	it('두 종류의 테두리가 서로 다르다 — 색을 못 봐도 구분된다', () => {
		const { current, visited } = MARK_PALETTE;
		expect(new Set([current.outline, visited.outline]).size).toBe(2);
	});

	it('하이라이트 색이 스티커 6색과 겹치지 않는다', () => {
		// 풀린 큐브의 54칸을 칠하면 그 색 집합이 곧 이 배색의 6색이다.
		const scheme = new Set(faceletColors(ds.meta.colorScheme, new Cube().asString()));
		expect(scheme.size).toBe(6);
		for (const m of Object.values(MARK_PALETTE)) expect(scheme.has(m.color)).toBe(false);
	});

	it('팔레트를 바꾸면 그 값이 그대로 나간다 (화면이 정하고 뷰어가 받는다)', () => {
		const custom = {
			current: { color: '#222222', outline: 'double' as const },
			visited: { color: '#333333', outline: 'dashed' as const }
		};
		const target = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		const marks = buildMarks('corner', [target], custom);
		expect(marks[CORNER_INDEX[target]]).toEqual(custom.current);
	});

	it('모르는 문자는 조용히 무시한다 (입력 정리가 앞에 있다)', () => {
		expect(() => buildMarks('corner', ['Z'])).not.toThrow();
		expect(painted(buildMarks('corner', ['Z']))).toEqual([]);
	});
});

describe('T5-1 정적 검사 — 버퍼 리터럴이 없다 (FR-TR-7)', () => {
	const src = readFileSync('src/lib/domain/tracing.ts', 'utf8');

	it('버퍼 스티커·큐비 문자를 소스에 적지 않는다', () => {
		const hits = src
			.split('\n')
			.map((line, i) => [i + 1, line] as const)
			.filter(([, line]) => /'(A|E|R|UBL|UFR|UF|DF)'/.test(line));
		expect(hits.map(([n, line]) => `${n}: ${line.trim()}`)).toEqual([]);
	});

	it('화면·저장소에 의존하지 않는다', () => {
		expect(/svelte|localStorage|document|window/.test(src)).toBe(false);
	});

	it('정답을 만들어 문자열로 비교하는 코드가 없다 (AD-7)', () => {
		// `verdictText` 는 판정을 문구로 옮길 뿐이고, 채점은 `gradeMemo` 하나뿐이다.
		expect(/gradeMemo/.test(src)).toBe(false);
	});
});

describe('T5-1 정적 검사 — 뒷면을 새게 하는 코드가 없다 (FR-TR-15)', () => {
	const viewer = readFileSync('src/lib/cube/cube3d.ts', 'utf8');
	const wrapper = readFileSync('src/lib/ui/Cube3D.svelte', 'utf8');
	const page = readFileSync('src/routes/trace/+page.svelte', 'utf8');

	/**
	 * 주석을 걷어낸 코드만 본다. 이 저장소의 주석은 "미니맵·전개도를 만들지 않는다"
	 * 처럼 **금지어 자체를 인용** 하는 일이 많다. 그 문장을 못 쓰게 하면 규율의 근거가
	 * 코드에서 사라진다 — 검사하려는 것은 구현이지 산문이 아니다.
	 */
	const code = (src: string): string =>
		src
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^\s*\/\/.*$/gm, '');

	it('뷰어에 반투명이 없다', () => {
		// 반투명은 뒷면을 앞면 위로 비쳐 보이게 한다 — 회전 없이 뒷면을 아는 길이다.
		expect(/transparent|opacity|blending/i.test(code(viewer))).toBe(false);
		expect(/transparent|opacity/i.test(code(wrapper))).toBe(false);
	});

	it('뷰어가 깊이 검사를 끄지 않는다', () => {
		// `depthTest: false` 는 반투명 없이도 뒤에 있는 것을 앞으로 끌어낸다.
		expect(/depthTest|depthWrite|renderOrder/.test(code(viewer))).toBe(false);
	});

	it('미니맵·전개도가 없다', () => {
		for (const src of [viewer, wrapper, page].map(code)) {
			expect(/미니맵|전개도|minimap|unfold/i.test(src)).toBe(false);
			// 캔버스는 하나뿐이다. 두 번째 캔버스가 곧 미니맵이다.
			expect((src.match(/<canvas/g) ?? []).length).toBeLessThanOrEqual(1);
		}
	});

	it('훈련 중에는 하이라이트가 없다 — buildMarks 는 결과 단계에서만 돈다', () => {
		/*
		 * 규칙이 좁아졌다. 버퍼 표시까지 걷어냈으므로(요구: 실물 큐브에 그런 표시가
		 * 없다) 훈련 중 큐브에는 강조가 하나도 없다. 남은 호출은 화면 전체에 하나뿐이고
		 * 그 하나가 결과 단계의 것이다.
		 *
		 * `marks` 파생식을 통째로 떠서 본다. 식이 사라지거나 모양이 바뀌면 정규식이
		 * 비어 나오고 첫 단언에서 걸린다 — 검사가 조용히 무력해지는 것이 이 종류의
		 * 검사에서 가장 흔한 고장이다.
		 */
		const src = code(page);
		expect((src.match(/buildMarks\(/g) ?? []).length).toBe(1);
		const derived = /let marks = \$derived\(([\s\S]*?)\n\t\);/.exec(src)?.[1] ?? '';
		expect(derived).not.toBe('');
		expect(derived).toContain("stage === 'result'");
		// 그 밖의 단계는 빈 배열이다. 'tracing' 이 이 식에 등장하면 다시 칠하는 것이다.
		expect(derived).toContain('NO_MARKS');
		expect(derived).not.toContain("'tracing'");
	});
});
