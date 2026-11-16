/**
 * OP 코너(#18)의 암기 체크 · 퀴즈 범위 싱글턴.
 *
 * `m2.svelte.ts` 와 같은 뼈대: `$effect.root()` + `$effect()` 자동 저장과 try/catch.
 * 키는 `op.*` 로 따로 둔다 (AD-7). 같은 문자(A–X)를 코너 3-style / M2 / OP 세 방법에서
 * 쓰므로 저장소가 섞이면 진도가 갈린다.
 */
import { browser } from '$app/environment';
import { parseOpChecked, serializeOpChecked } from '$lib/domain/op.js';

const KEY_CHECKED = 'op.checked';
const KEY_MEMORIZED_ONLY = 'op.quiz.memorizedOnly';

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

class Op {
	checked = $state<Set<string>>(parseOpChecked(read(KEY_CHECKED)));
	/** "암기한 것만 출제". 기본값은 전체에서 출제. */
	memorizedOnly = $state<boolean>(read(KEY_MEMORIZED_ONLY) === 'true');

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => write(KEY_CHECKED, serializeOpChecked(this.checked)));
				$effect(() => write(KEY_MEMORIZED_ONLY, String(this.memorizedOnly)));
			});
		}
	}

	/** 새 Set 을 대입해야 `$state` 가 바뀐 것을 안다 (`m2.svelte.ts` 와 같다). */
	toggle(id: string): void {
		const next = new Set(this.checked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this.checked = next;
	}

	/** 암기 체크 전체 해제 + "암기한 것만" 설정 초기화 + 저장소 비우기 (AD-8). */
	clearAll(): void {
		this.checked = new Set();
		this.memorizedOnly = false;
	}
}

export const op = new Op();
