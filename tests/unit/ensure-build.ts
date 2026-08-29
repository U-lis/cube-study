/**
 * 빌드 산출물 검사들이 공유하는 "빌드를 최신으로 맞춘다".
 *
 * 산출물 검사는 skip 하지 않는다 — 조용히 빠지는 검사는 검사가 아니다. 그런데 CI 는
 * `pnpm build` 보다 `pnpm test` 를 먼저 돌리므로(.github/workflows/ci.yml) 각 검사가
 * 필요할 때 스스로 빌드해야 한다.
 *
 * **여기가 공유 함수인 이유는 검사 파일이 둘 이상이기 때문이다.** vitest 는 파일을
 * 병렬로 돌리므로 `bundle-worker` 와 `bundle-three` 가 동시에 `pnpm build` 를 부르면
 * 한쪽이 `build/` 를 지우는 동안 다른 쪽이 그것을 읽는다 (실측: 산출물 읽기 실패).
 * 잠금을 걸어 한 번만 빌드하고, 다른 쪽은 끝날 때까지 기다린다.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'build';
const IMMUTABLE = join(BUILD, '_app', 'immutable');
const LOCK = join('node_modules', '.cache', 'bundle-test-build.lock');

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
	);
}

/** 디렉터리에서 가장 최근 mtime. 산출물이 소스보다 오래됐는지 보는 데 쓴다. */
export function newest(dir: string): number {
	return walk(dir).reduce((max, f) => Math.max(max, statSync(f).mtimeMs), 0);
}

const stale = () => !existsSync(join(BUILD, 'index.html')) || newest('src') > newest(IMMUTABLE);

/** `mkdir` 은 원자적이다 — 이미 있으면 던진다. 그래서 잠금으로 쓸 수 있다. */
function tryLock(): boolean {
	mkdirSync(join('node_modules', '.cache'), { recursive: true });
	try {
		mkdirSync(LOCK);
		return true;
	} catch {
		return false;
	}
}

export function ensureBuild(): void {
	if (!stale()) return;
	if (tryLock()) {
		try {
			execSync('pnpm run build', { stdio: 'inherit' });
		} finally {
			rmSync(LOCK, { recursive: true, force: true });
		}
		return;
	}
	// 다른 검사 파일이 빌드 중이다. 끝날 때까지 기다린다.
	const until = Date.now() + 240_000;
	while (existsSync(LOCK) && Date.now() < until) execSync('sleep 0.5');
	if (stale()) throw new Error('빌드가 최신이 아니다 — 다른 검사의 빌드가 실패했다');
}
