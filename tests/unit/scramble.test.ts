/**
 * 스크램블 순수부 + 큐 단위 테스트 (T1B-1 ~ T1B-4).
 *
 * **풀이기를 부르지 않는다.** `Cube.initSolver()` 는 실측 1695ms 라 단위 테스트에서 돌릴
 * 물건이 아니다. `solve()` 를 흉내내는 가짜 큐브를 넘긴다 — `scrambleFrom` 이 순수부인
 * 이유가 여기 있다. 상태 확인이 필요한 곳만 풀이기 없는 `cubejs/lib/cube.js` 를 쓴다.
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import { invertAlg } from '../../src/lib/cube/notation.js';
import {
	QUEUE_TARGET,
	ScrambleQueue,
	scrambleFrom,
	splitCore,
	type Scramble,
	type ScrambleSink,
	type WorkerLike
} from '../../src/lib/cube/scramble.js';

/** `solve()` 만 흉내내는 큐브. `scrambleFrom` 이 보는 전부다. */
const fake = (solution: string | (() => string)) => ({
	solve: () => (typeof solution === 'string' ? solution : solution())
});

const facelets = (alg: string) => new Cube().move(alg).asString();

/** 24가지 방향. `y` 4가지 × 위 면을 정하는 6가지. */
const ORIENTATIONS = ['', 'y', 'y2', "y'"].flatMap((y) =>
	['', 'x', 'x2', "x'", 'z', "z'"].map((x) => `${x} ${y}`.trim())
);

/** `core` 는 원본과 "전체 회전을 제외하고" 같은 상태여야 한다. */
function sameUpToRotation(core: string, alg: string): boolean {
	const target = facelets(alg);
	return ORIENTATIONS.some((r) => facelets(`${core} ${r}`.trim()) === target);
}

const FACES = ['R', 'U', 'F', 'D', 'L', 'B'];
const SUFFIXES = ['', "'", '2'];

function randomAlg(n: number): string {
	const out: string[] = [];
	let prev = '';
	for (let i = 0; i < n; i++) {
		let f = FACES[Math.floor(Math.random() * FACES.length)];
		while (f === prev) f = FACES[Math.floor(Math.random() * FACES.length)];
		prev = f;
		out.push(f + SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
	}
	return out.join(' ');
}

describe('T1B-1 scrambleFrom — 풀이의 역이 스크램블이다', () => {
	it('풀이를 뒤집는다 (invertAlg 규약)', () => {
		expect(scrambleFrom(fake("R U R' U'")).scramble).toBe("U R U' R'");
	});

	it('self-inverse 풀이는 그대로 나온다 — 버그가 아니다', () => {
		expect(scrambleFrom(fake("B' D2 B")).scramble).toBe("B' D2 B");
	});

	it('이미 풀린 큐브(빈 풀이)는 빈 스크램블이고 throw 하지 않는다', () => {
		expect(scrambleFrom(fake(''))).toEqual({ scramble: '', core: '' });
	});

	it('solve() 의 throw 는 그대로 전파된다 — 순수부가 에러 표현을 정하지 않는다', () => {
		expect(() =>
			scrambleFrom(
				fake(() => {
					throw new Error('풀이 실패');
				})
			)
		).toThrow('풀이 실패');
	});

	it("`2` 가 붙은 무브는 토글해도 그대로다", () => {
		expect(scrambleFrom(fake("F2 R' D2")).scramble).toBe("D2 R F2");
	});

	it('미지 토큰은 throw 한다', () => {
		expect(() => scrambleFrom(fake('Q'))).toThrow('Unknown move: Q');
	});
});

describe('T1B-2 왕복 — 스크램블이 그 상태를 재현한다', () => {
	it('한 알고리즘', () => {
		const alg = "R U R' F' U2 L D";
		const { scramble } = scrambleFrom(fake(invertAlg(alg)));
		expect(facelets(scramble)).toBe(facelets(alg));
	});

	it('무작위 알고리즘 100회', () => {
		for (let i = 0; i < 100; i++) {
			const alg = randomAlg(20);
			const { scramble, core } = scrambleFrom(fake(invertAlg(alg)));
			expect(facelets(scramble)).toBe(facelets(alg));
			expect(facelets(core)).toBe(facelets(alg));
		}
	});
});

describe('T1B-3 { scramble, core } 규약', () => {
	it('회전이 없으면 core === scramble — 지금 실제로 도는 경로다', () => {
		const s = splitCore("R U R' U' F2 D L' B");
		expect(s.core).toBe(s.scramble);
	});

	it('앞에 붙은 y2 는 scramble 에 남고 core 에서 사라진다', () => {
		const alg = "y2 R U R'";
		const { scramble, core } = splitCore(alg);
		expect(scramble).toBe(alg);
		expect(core).not.toMatch(/[xyz]/);
		// 회전을 그냥 지우면 안 된다. y2 뒤의 R 은 원래 방향에서 L 이다.
		expect(core).toBe("L U L'");
		expect(sameUpToRotation(core, alg)).toBe(true);
	});

	it('중간·끝에 낀 회전도 걷어낸다', () => {
		for (const alg of ["R x U F'", "U y' R2 z D", "x y z R U", "R U x"]) {
			const { core } = splitCore(alg);
			expect(core, alg).not.toMatch(/[xyz]/);
			expect(sameUpToRotation(core, alg), alg).toBe(true);
		}
	});

	it('wide 무브와 슬라이스는 면 무브 + 회전으로 분해된다', () => {
		// cubejs 의 `move()` 는 소문자 wide 만 받는다(`Rw` 는 Invalid). 대조는 소문자로 한다.
		for (const alg of ['r', "l'", 'u2', 'd', 'f', "b'", 'r u2', 'M', "E'", 'S2', "R M' U"]) {
			const { core } = splitCore(alg);
			expect(core, alg).not.toMatch(/[xyzw]/);
			expect(sameUpToRotation(core, alg), alg).toBe(true);
		}
	});

	it('무작위 알고리즘 100개 — 회전·wide·슬라이스를 섞어도 상태가 보존된다', () => {
		// cubejs 가 받는 토큰만 쓴다. 방향을 뒤집어 잡으면 여기서 대부분 깨진다.
		const pool = [...FACES, 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b', 'M', 'E', 'S'];
		for (let i = 0; i < 100; i++) {
			const alg = Array.from(
				{ length: 12 },
				() =>
					pool[Math.floor(Math.random() * pool.length)] +
					SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
			).join(' ');
			const { core } = splitCore(alg);
			expect(core, alg).not.toMatch(/[xyz]/);
			expect(sameUpToRotation(core, alg), alg).toBe(true);
		}
	});

	it('대문자 wide 표기(Rw)도 소문자(r)와 같게 읽는다', () => {
		for (const [wide, short] of [
			['Rw', 'r'],
			["Lw'", "l'"],
			['Uw2', 'u2'],
			['Dw', 'd'],
			['Fw', 'f'],
			["Bw'", "b'"]
		]) {
			expect(splitCore(wide).core, wide).toBe(splitCore(short).core);
		}
	});

	it('두 필드가 항상 존재한다', () => {
		for (const alg of ['', 'R', 'y', 'Rw2', "M2 x' U"]) {
			const s = splitCore(alg);
			expect(typeof s.scramble).toBe('string');
			expect(typeof s.core).toBe('string');
		}
	});
});

/** WorkerLike 를 흉내낸다. 실제 Worker 는 node 에 없고, 여기서 볼 것은 프로토콜뿐이다. */
class FakeWorker implements WorkerLike {
	onmessage: ((event: { data: unknown }) => void) | null = null;
	sent: unknown[] = [];
	terminated = 0;

	postMessage(message: unknown): void {
		this.sent.push(message);
	}
	terminate(): void {
		this.terminated++;
	}
	/** 워커가 메인에게 보낸 것처럼 흉내낸다. */
	emit(data: unknown): void {
		this.onmessage?.({ data });
	}
	requests(): number[] {
		return this.sent
			.filter((m): m is { type: 'request'; n: number } => (m as { type: string }).type === 'request')
			.map((m) => m.n);
	}
}

function harness() {
	const sink: ScrambleSink = { ready: false, queue: [], error: null };
	const worker = new FakeWorker();
	const queue = new ScrambleQueue(sink, () => worker);
	const fill = (n: number) => {
		for (let i = 0; i < n; i++) worker.emit({ type: 'scramble', scramble: `S${i}`, core: `S${i}` });
	};
	return { sink, worker, queue, fill };
}

describe('T1B-4 큐 동작', () => {
	it('start() 전 take() 는 null 이다 (throw 하지 않는다)', () => {
		const { queue, sink } = harness();
		expect(queue.take()).toBeNull();
		expect(sink.ready).toBe(false);
	});

	it('ready 전 take() 는 null 이다', () => {
		const { queue, sink } = harness();
		queue.start();
		expect(queue.take()).toBeNull();
		expect(sink.ready).toBe(false);
	});

	it('start() 는 init 을 보내고, ready 뒤에 목표 길이만큼 요청한다', () => {
		const { queue, worker, sink } = harness();
		queue.start();
		expect(worker.sent[0]).toEqual({ type: 'init' });
		worker.emit({ type: 'ready' });
		expect(sink.ready).toBe(true);
		expect(worker.requests()).toEqual([QUEUE_TARGET]);
	});

	it('scramble 8건을 받으면 큐가 8이 된다', () => {
		const { queue, worker, sink, fill } = harness();
		queue.start();
		worker.emit({ type: 'ready' });
		fill(QUEUE_TARGET);
		expect(sink.queue.length).toBe(QUEUE_TARGET);
		// 이미 요청한 몫이 다 왔을 뿐이므로 중복 요청은 없다.
		expect(worker.requests()).toEqual([QUEUE_TARGET]);
	});

	it('take() 한 번에 하나가 빠지고 1건이 보충 요청된다', () => {
		const { queue, worker, sink, fill } = harness();
		queue.start();
		worker.emit({ type: 'ready' });
		fill(QUEUE_TARGET);
		const taken = queue.take();
		expect(taken).toEqual<Scramble>({ scramble: 'S0', core: 'S0' });
		expect(sink.queue.length).toBe(QUEUE_TARGET - 1);
		expect(worker.requests()).toEqual([QUEUE_TARGET, 1]);
	});

	it('dispose() 는 워커를 반납하고 큐를 비운다', () => {
		const { queue, worker, sink, fill } = harness();
		queue.start();
		worker.emit({ type: 'ready' });
		fill(QUEUE_TARGET);
		queue.dispose();
		expect(worker.terminated).toBe(1);
		expect(sink.queue.length).toBe(0);
		expect(queue.worker).toBeNull();
		expect(queue.take()).toBeNull();
	});

	it('error 메시지는 문구만 담고 큐를 유지한다', () => {
		const { queue, worker, sink, fill } = harness();
		queue.start();
		worker.emit({ type: 'ready' });
		fill(3);
		worker.emit({ type: 'error', message: '생성 실패' });
		expect(sink.error).toBe('생성 실패');
		expect(sink.queue.length).toBe(3);
	});
});
