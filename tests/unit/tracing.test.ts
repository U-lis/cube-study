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
import { stateFromFacelets } from '../../src/lib/cube/sim.js';
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
import type { TraceVerdict } from '../../src/lib/cube/trace.js';
import {
	buildMarks,
	conventionCompare,
	formatMs,
	optionsFrom,
	parseRecords,
	pushRecord,
	sanitizeEntry,
	serializeRecords,
	twistEntries,
	verdictText,
	MARK_PALETTE,
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

// ─────────────────────────────────────────────────────────────
// Phase 4 — 입력 정리 (T4-1, T4-2 의 순수부)
// ─────────────────────────────────────────────────────────────

describe('T4-0 sanitizeEntry (FR-TR-18)', () => {
	const many = { max: 99 };

	it('코너 세션은 대문자로 맞춘다', () => {
		expect(sanitizeEntry('kbd', 'corner', many)).toEqual(['K', 'B', 'D']);
	});

	it('엣지 세션은 소문자로 맞춘다', () => {
		expect(sanitizeEntry('KBD', 'edge', many)).toEqual(['k', 'b', 'd']);
	});

	it('알파벳이 아닌 문자는 구분자로 보고 버린다', () => {
		expect(sanitizeEntry('K B, D\n', 'corner', many)).toEqual(['K', 'B', 'D']);
	});

	it('24글자 밖의 문자는 받지 않는다', () => {
		// Speffz 는 A~X 다. Y·Z 는 어느 조각도 지목하지 않는다.
		expect(sanitizeEntry('KYZB', 'corner', many)).toEqual(['K', 'B']);
	});

	it('blocked 문자를 걸러낸다 (타깃 구획의 버퍼)', () => {
		const blocked = ds.meta.bufferStickers;
		const text = [...blocked, 'K'].join('');
		expect(sanitizeEntry(text, 'corner', { blocked, max: 99 })).toEqual(['K']);
	});

	it('blocked 를 주지 않으면 버퍼 문자도 통과한다 (관례 B 의 비틀림 구획)', () => {
		const buffer = ds.meta.bufferStickers[0];
		expect(sanitizeEntry(buffer, 'corner', many)).toEqual([buffer]);
	});

	it('상한을 넘으면 자른다', () => {
		expect(sanitizeEntry('KBDLM', 'corner', { max: 2 })).toEqual(['K', 'B']);
	});

	it('상한이 0 이면 빈 열이다', () => {
		expect(sanitizeEntry('KBD', 'corner', { max: 0 })).toEqual([]);
	});

	it('빈 문자열은 빈 열이다', () => {
		expect(sanitizeEntry('', 'corner', many)).toEqual([]);
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
	it('빈 입력 열이면 버퍼 조각만 칠해진다 (코너 3칸)', () => {
		const marks = buildMarks('corner', ds.meta, []);
		const ix = painted(marks);
		expect(ix).toHaveLength(3);
		expect(new Set(ix)).toEqual(
			new Set(CORNER_ROTATION[ds.meta.buffer].map((s) => CORNER_INDEX[s]))
		);
		expect(ix.every((i) => marks[i]!.color === MARK_PALETTE.buffer.color)).toBe(true);
	});

	it('코너 타깃 하나면 그 조각의 3칸 전부가 현재 타깃 색이다', () => {
		const target = CORNER_LETTERS.find((l) => !ds.meta.bufferStickers.includes(l))!;
		const marks = buildMarks('corner', ds.meta, [target]);
		const cells = CORNER_ROTATION[CORNER_CUBIE[target]].map((s) => CORNER_INDEX[s]);
		expect(cells).toHaveLength(3);
		for (const i of cells) expect(marks[i]).toEqual(MARK_PALETTE.current);
	});

	it('엣지 타깃 하나면 2칸 전부다', () => {
		const target = EDGE_LETTERS.find((l) => !edgeBuffer.bufferStickers.includes(l))!;
		const marks = buildMarks('edge', edgeBuffer, [target]);
		const cells = EDGE_ROTATION[EDGE_CUBIE[target]].map((s) => EDGE_INDEX[s]);
		expect(cells).toHaveLength(2);
		for (const i of cells) expect(marks[i]).toEqual(MARK_PALETTE.current);
	});

	it('타깃 5개면 마지막 하나가 현재, 앞 4개가 지나간 조각이다', () => {
		const entered = CORNER_LETTERS.filter((l) => !ds.meta.bufferStickers.includes(l)).slice(0, 5);
		const marks = buildMarks('corner', ds.meta, entered);
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
		const marks = buildMarks('edge', edgeBuffer, entered);
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
		const marks = buildMarks('corner', ds.meta, [letter, other, sibling]);
		for (const s of CORNER_ROTATION[CORNER_CUBIE[letter]])
			expect(marks[CORNER_INDEX[s]]).toEqual(MARK_PALETTE.current);
		for (const s of CORNER_ROTATION[CORNER_CUBIE[other]])
			expect(marks[CORNER_INDEX[s]]).toEqual(MARK_PALETTE.visited);
	});

	it('반환 배열은 언제나 54칸이다', () => {
		for (const entered of [[], ['K'], CORNER_LETTERS])
			expect(buildMarks('corner', ds.meta, entered)).toHaveLength(54);
	});

	it('모든 Mark 이 color 와 outline 을 함께 갖는다 (색 단독 금지)', () => {
		const marks = buildMarks('corner', ds.meta, CORNER_LETTERS);
		const hits = marks.filter((m) => m !== null);
		expect(hits.length).toBeGreaterThan(0);
		for (const m of hits) {
			expect(typeof m!.color).toBe('string');
			expect(['solid', 'dashed', 'double']).toContain(m!.outline);
		}
	});

	it('세 종류의 색이 서로 다르다', () => {
		const { buffer, current, visited } = MARK_PALETTE;
		expect(new Set([buffer.color, current.color, visited.color]).size).toBe(3);
	});

	it('세 종류의 테두리가 서로 다르다 — 색을 못 봐도 구분된다', () => {
		const { buffer, current, visited } = MARK_PALETTE;
		expect(new Set([buffer.outline, current.outline, visited.outline]).size).toBe(3);
	});

	it('하이라이트 색이 스티커 6색과 겹치지 않는다', () => {
		// 풀린 큐브의 54칸을 칠하면 그 색 집합이 곧 이 배색의 6색이다.
		const scheme = new Set(faceletColors(ds.meta.colorScheme, new Cube().asString()));
		expect(scheme.size).toBe(6);
		for (const m of Object.values(MARK_PALETTE)) expect(scheme.has(m.color)).toBe(false);
	});

	it('팔레트를 바꾸면 그 값이 그대로 나간다 (화면이 정하고 뷰어가 받는다)', () => {
		const custom = {
			buffer: { color: '#111111', outline: 'solid' as const },
			current: { color: '#222222', outline: 'double' as const },
			visited: { color: '#333333', outline: 'dashed' as const }
		};
		const marks = buildMarks('corner', ds.meta, [], custom);
		expect(marks[CORNER_INDEX[ds.meta.primarySticker]]).toEqual(custom.buffer);
	});

	it('모르는 문자는 조용히 무시한다 (입력 정리가 앞에 있다)', () => {
		expect(() => buildMarks('corner', ds.meta, ['Z'])).not.toThrow();
		expect(painted(buildMarks('corner', ds.meta, ['Z']))).toHaveLength(3);
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

	it('화면이 정답 경로를 하이라이트로 넘기지 않는다', () => {
		// `buildMarks` 에 넘기는 것은 사용자의 입력뿐이어야 한다. `answer` 가 여기
		// 섞이면 그 순간 화면이 정답을 그려준다.
		const call = /buildMarks\([^)]*\)/.exec(page)?.[0] ?? '';
		expect(call).not.toBe('');
		expect(call).not.toContain('answer');
	});
});
