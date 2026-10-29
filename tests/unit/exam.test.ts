/**
 * 시험 — 출제·판 저장·기록 (SPEC FR-EX).
 */
import { describe, it, expect } from 'vitest';
import {
	EXAM_DEFAULT,
	EXAM_MAX,
	EXAM_MIN,
	EXAM_RECORD_LIMIT,
	EXAM_SIZES,
	newExamSession,
	parseExamSession,
	parseExamSize,
	parseRecords,
	pushRecord,
	serializeRecords,
	type ExamRecord
} from '../../src/lib/domain/exam.js';

describe('문항 수', () => {
	it('EXAM_SIZES 는 5 간격으로 5 ~ 50', () => {
		expect(EXAM_MIN).toBe(5);
		expect(EXAM_MAX).toBe(50);
		expect(EXAM_DEFAULT).toBe(10);
		expect(EXAM_SIZES).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
	});

	it('유효 범위를 그대로 읽는다', () => {
		for (const n of [5, 7, 10, 25, 50]) expect(parseExamSize(String(n))).toBe(n);
	});

	it('범위 밖 / null / 깨진 값은 EXAM_DEFAULT', () => {
		for (const raw of [null, '', '4', '51', '0', '-5', 'x', '7.5']) {
			expect(parseExamSize(raw), String(raw)).toBe(EXAM_DEFAULT);
		}
	});
});

describe('parseExamSession', () => {
	it('저장한 판을 그대로 읽는다', () => {
		const s = newExamSession('setup', ['AB', 'CD']);
		s.answers[0] = { moves: ['R', "U'"], ref: { name: 'GC', inverse: true } };
		s.graded = true;
		expect(parseExamSession(JSON.stringify(s))).toEqual(s);
	});

	it('모양이 어긋나면 null 로 돌아간다', () => {
		const ok = newExamSession('direct', ['AB']);
		const bad = [
			null,
			'{',
			JSON.stringify({ ...ok, v: 2 }),
			JSON.stringify({ ...ok, mode: 'x' }),
			JSON.stringify({ ...ok, answers: [] }),
			JSON.stringify({ ...ok, answers: [{ moves: [1], ref: null }] }),
			JSON.stringify({ ...ok, graded: 'yes' })
		];
		for (const raw of bad) expect(parseExamSession(raw), String(raw)).toBeNull();
	});
});

describe('parseRecords', () => {
	const ok = (over: Partial<ExamRecord> = {}): ExamRecord => ({
		at: 1700000000000,
		date: '2026-10-29',
		mode: 'direct',
		cases: ['AB'],
		answers: [{ moves: ['R'], ref: null }],
		correct: 1,
		...over
	});

	it('유효 저장물을 읽는다', () => {
		const raw = JSON.stringify({ schemaVersion: 1, records: [ok(), ok({ correct: 0 })] });
		const got = parseRecords(raw);
		expect(got).toHaveLength(2);
		expect(got[1].correct).toBe(0);
	});

	it('null / 빈 / 깨진 JSON / 스키마 어긋남은 []', () => {
		for (const raw of [
			null,
			'',
			'{',
			JSON.stringify({ schemaVersion: 2, records: [] }),
			JSON.stringify({ records: [] }),
			JSON.stringify({ schemaVersion: 1, records: 'x' })
		]) {
			expect(parseRecords(raw), String(raw)).toEqual([]);
		}
	});

	it('항목 하나가 깨져도 나머지는 살린다', () => {
		const raw = JSON.stringify({
			schemaVersion: 1,
			records: [ok(), { bad: true }, ok({ date: '2026-10-30' })]
		});
		const got = parseRecords(raw);
		expect(got).toHaveLength(2);
		expect(got[1].date).toBe('2026-10-30');
	});
});

describe('serializeRecords / 라운드트립', () => {
	it('직렬화한 뒤 다시 읽으면 같은 배열', () => {
		const rs: ExamRecord[] = [
			{
				at: 1700000000000,
				date: '2026-10-29',
				mode: 'setup',
				cases: ['AB', 'CD'],
				answers: [
					{ moves: ['R'], ref: null },
					{ moves: [], ref: { name: 'GC', inverse: false } }
				],
				correct: 2
			}
		];
		expect(parseRecords(serializeRecords(rs))).toEqual(rs);
	});
});

describe('pushRecord', () => {
	const mk = (at: number): ExamRecord => ({
		at,
		date: '2026-10-29',
		mode: 'direct',
		cases: ['AB'],
		answers: [{ moves: [], ref: null }],
		correct: 0
	});

	it('새 기록을 맨 앞에 넣는다', () => {
		const a = mk(1);
		const b = mk(2);
		const out = pushRecord([a], b);
		expect(out[0]).toEqual(b);
		expect(out[1]).toEqual(a);
	});

	it('상한을 넘으면 가장 오래된 것부터 버린다', () => {
		let rs: ExamRecord[] = [];
		for (let i = 0; i < EXAM_RECORD_LIMIT + 5; i++) rs = pushRecord(rs, mk(i));
		expect(rs).toHaveLength(EXAM_RECORD_LIMIT);
		expect(rs[0].at).toBe(EXAM_RECORD_LIMIT + 4);
		// 밀려난 것은 at = 0 ~ 4
		expect(rs.at(-1)?.at).toBe(5);
	});

	it('입력을 자리에서 바꾸지 않는다', () => {
		const a = mk(1);
		const before = [a];
		pushRecord(before, mk(2));
		expect(before).toEqual([a]);
	});
});
