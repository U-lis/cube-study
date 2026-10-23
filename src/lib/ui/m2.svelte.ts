/**
 * M2 엣지(#17)의 암기 체크 · 퀴즈 범위 싱글턴.
 *
 * `letters.svelte.ts` 의 `$effect.root()` + `$effect()` 자동 저장과 `try/catch` 를 따른다.
 * 키는 `m2.*` 로 따로 둔다 — 코너 암기(`memorize.checked`)의 파서는 `schemaVersion` 이
 * 안 맞으면 저장물을 통째로 버리므로 같은 키에 얹지 않는다.
 */
import { browser } from '$app/environment';
import { parseM2Checked, serializeM2Checked } from '$lib/domain/m2.js';

const KEY_CHECKED = 'm2.checked';
const KEY_MEMORIZED_ONLY = 'm2.quiz.memorizedOnly';

function read(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// 저장소가 막혀 있다. 이번 방문 동안은 메모리의 값으로 돈다.
	}
}

class M2 {
	checked = $state<Set<string>>(parseM2Checked(read(KEY_CHECKED)));
	/** "암기한 것만 출제". 기본값은 전체에서 출제. */
	memorizedOnly = $state<boolean>(read(KEY_MEMORIZED_ONLY) === 'true');

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => write(KEY_CHECKED, serializeM2Checked(this.checked)));
				$effect(() => write(KEY_MEMORIZED_ONLY, String(this.memorizedOnly)));
			});
		}
	}

	/** 새 Set 을 대입해야 `$state` 가 바뀐 것을 안다 (`memorize.svelte.ts` 의 toggle 과 같다). */
	toggle(id: string): void {
		const next = new Set(this.checked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this.checked = next;
	}

	clearAll(): void {
		this.checked = new Set();
	}
}

export const m2 = new M2();
