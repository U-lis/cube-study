/**
 * Phase 2 — 채점·세션 도메인.
 *
 * 여기서 보는 것은 **표현과 저장** 이다. 채점 자체는 `trace.test.ts` 가 본다.
 * 버퍼 문자를 이 파일에 리터럴로 박지 않는다 — 실제 `meta` 에서 읽는다. 그래야
 * 데이터를 갈아끼웠을 때 이 테스트가 함께 따라간다 (FR-TR-7).
 */
import { describe, expect, it } from 'vitest';
// 진입점을 쓰는 것은 `Cube.random()` 때문이다. `initSolver()` 는 부르지 않는다 —
// 랜덤 스테이트 생성에 풀이기가 필요 없다.
import Cube from 'cubejs';
import { loadDataset } from '../../src/lib/data/loader.js';
import { parseStored, serialize } from '../../src/lib/domain/memorize.js';
import { stateFromFacelets } from '../../src/lib/cube/sim.js';
import type { TraceVerdict } from '../../src/lib/cube/trace.js';
import {
	conventionCompare,
	formatMs,
	optionsFrom,
	parseRecords,
	pushRecord,
	serializeRecords,
	verdictText,
	RECORDS_KEY,
	RECORDS_SCHEMA_VERSION,
	RECORD_LIMIT,
	type TraceRecord
} from '../../src/lib/domain/tracing.js';

const ds = await loadDataset();

/** 시드 고정 LCG. 통계 판정이 실행마다 흔들리면 그것은 검사가 아니다. */
function lcg(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

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
	it('저장 JSON 에 schemaVersion 1 이 들어간다', () => {
		expect(JSON.parse(serializeRecords([rec()])).schemaVersion).toBe(1);
		expect(RECORDS_SCHEMA_VERSION).toBe(1);
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
		expect(RECORDS_SCHEMA_VERSION).toBe(1);
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

describe('T2-6 conventionCompare (FR-TR-24)', () => {
	const opts = optionsFrom(ds.meta, 'corner', 'A');
	/** 무작위 상태 표본. `Cube.random()` 은 풀이기 초기화 없이 돈다. */
	const states = (() => {
		const rnd = lcg(20260820);
		const real = Math.random;
		Math.random = rnd;
		try {
			return Array.from({ length: 1200 }, () => stateFromFacelets(Cube.random().asString(), 'corner'));
		} finally {
			Math.random = real;
		}
	})();

	it('비틀림이 없으면 두 관례의 타깃 수가 같다', () => {
		const same = states.map((s) => conventionCompare(s, opts)).filter((r) => r.a === r.b);
		expect(same.length).toBeGreaterThan(0);
	});
	it('비틀림이 있으면 A 가 더 많다', () => {
		const diff = states.map((s) => conventionCompare(s, opts)).filter((r) => r.a !== r.b);
		expect(diff.length).toBeGreaterThan(0);
		expect(diff.every((r) => r.a > r.b)).toBe(true);
	});
	it('어떤 상태에서도 A >= B 다', () => {
		expect(states.every((s) => { const r = conventionCompare(s, opts); return r.a >= r.b; })).toBe(true);
	});
	it('비틀림 표본의 평균이 SPEC 측정치 근방이다 (A 8.79 / B 6.37, ±0.2)', () => {
		const diff = states.map((s) => conventionCompare(s, opts)).filter((r) => r.a !== r.b);
		const avg = (xs: number[]) => xs.reduce((p, q) => p + q, 0) / xs.length;
		expect(Math.abs(avg(diff.map((r) => r.a)) - 8.79)).toBeLessThan(0.2);
		expect(Math.abs(avg(diff.map((r) => r.b)) - 6.37)).toBeLessThan(0.2);
	});
	it('패리티는 두 관례에서 동일하다', () => {
		expect(states.every((s) => { const r = conventionCompare(s, opts); return r.a % 2 === r.b % 2; })).toBe(true);
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
