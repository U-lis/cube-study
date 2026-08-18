/**
 * E2E 태그 규약 검사.
 *
 * playwright.config.ts 의 mobile 프로젝트는 `@viewport` 태그가 붙은 테스트만 돈다.
 * 태그를 빠뜨리면 그 테스트가 **조용히** mobile 에서 빠진다 — 실패가 아니라 실행이
 * 사라지는 종류의 사고라 사람이 알아채기 어렵다. 그래서 규약을 사람의 기억이 아니라
 * 이 테스트가 지킨다.
 *
 * 판정 기준은 "뷰포트 신호를 쓰는가" 하나다. 화면 크기·터치 타깃·레이아웃 좌표를
 * 재는 API 를 쓰면 결과가 뷰포트에 달라질 수 있다고 본다. 과하게 잡는 쪽으로 틀린다 —
 * 불필요한 태그는 mobile 에서 한 번 더 도는 비용이지만, 빠진 태그는 검사의 구멍이다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'tests/e2e';
const TAG = '@viewport';

/**
 * 뷰포트 의존을 알리는 API.
 *
 * `boundingBox` 는 좌표를 재므로 레이아웃 검사다. `44` 는 FR-MC-4 의 터치 타깃
 * 최소 크기라 이 저장소에서는 사실상 예약어다.
 */
const SIGNALS =
	/setViewportSize|viewportSize|isMobile|hasTouch|\.tap\(|innerWidth|matchMedia|boundingBox|\b44\b/;

interface E2ETest {
	file: string;
	line: number;
	title: string;
	usesViewport: boolean;
	tagged: boolean;
}

/** spec 파일을 test( 블록 단위로 쪼갠다. 정식 파서는 아니지만 이 저장소의 형태에는 충분하다. */
function collect(): E2ETest[] {
	const out: E2ETest[] = [];
	for (const name of readdirSync(DIR).filter((f) => f.endsWith('.spec.ts'))) {
		const lines = readFileSync(join(DIR, name), 'utf8').split('\n');
		const starts = lines.flatMap((l, i) => (/^\s*test\(/.test(l) ? [i] : []));
		starts.forEach((start, n) => {
			const end = starts[n + 1] ?? lines.length;
			const body = lines.slice(start, end).join('\n');
			const title = /test\(\s*['"](.+?)['"]/.exec(body)?.[1] ?? '';
			out.push({
				file: name,
				line: start + 1,
				title,
				usesViewport: SIGNALS.test(body),
				tagged: title.includes(TAG)
			});
		});
	}
	return out;
}

const tests = collect();
const label = (t: E2ETest) => `${t.file}:${t.line} ${t.title}`;

describe('E2E @viewport 태그 규약', () => {
	it('spec 파일에서 테스트를 찾는다 (파서가 죽으면 이 검사 전체가 무의미하다)', () => {
		expect(tests.length).toBeGreaterThan(100);
		expect(new Set(tests.map((t) => t.file)).size).toBeGreaterThan(10);
	});

	it('뷰포트 신호를 쓰는 테스트에는 @viewport 가 붙어 있다', () => {
		const missing = tests.filter((t) => t.usesViewport && !t.tagged).map(label);
		expect(missing).toEqual([]);
	});

	it('@viewport 가 붙은 테스트는 실제로 뷰포트 신호를 쓴다', () => {
		// 붙이는 것 자체는 안전하지만, 근거 없이 붙으면 규약이 흐려진다.
		const spurious = tests.filter((t) => t.tagged && !t.usesViewport).map(label);
		expect(spurious).toEqual([]);
	});

	it('모든 테스트에 제목이 있다 (제목을 못 읽으면 태그도 못 읽는다)', () => {
		expect(tests.filter((t) => t.title === '').map((t) => `${t.file}:${t.line}`)).toEqual([]);
	});
});
