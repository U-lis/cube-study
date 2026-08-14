/**
 * UI 표시 설정. 학습 진도가 아니라 표시 상태이므로 localStorage 에 저장한다 (GLOBAL D-5).
 * Phase 2 에서는 mode / notation 만. theme 는 Phase 4 에서 추가한다.
 */
import { browser } from '$app/environment';
import type { Mode, Notation } from '$lib/domain/format.js';

const KEY_MODE = 'ui.mode';
const KEY_NOTATION = 'ui.notation';
const KEY_THEME = 'ui.theme';
const KEY_QUIZ_INPUT = 'ui.quizInput';
const KEY_HIDE_INVERSE = 'ui.hideInverse';

export type Theme = 'system' | 'light' | 'dark';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	return v === null ? fallback : v === 'true';
}

class Settings {
	// SPEC: 학습 초기 단계이므로 setup 이 기본
	mode = $state<Mode>(read(KEY_MODE, ['direct', 'setup'] as const, 'setup'));
	notation = $state<Notation>(read(KEY_NOTATION, ['strict', 'compact'] as const, 'strict'));
	theme = $state<Theme>(read(KEY_THEME, ['system', 'light', 'dark'] as const, 'system'));
	/**
	 * 퀴즈 입력 방식. mode 와 별도 키다 — setup 으로 보면서 direct 로 답하는 조합이
	 * 성립하므로 표시 설정과 묶으면 한쪽을 바꿀 때 다른 쪽이 끌려간다.
	 */
	quizInput = $state<Mode>(read(KEY_QUIZ_INPUT, ['direct', 'setup'] as const, 'direct'));
	/**
	 * 기준 상세에서 역방향 케이스를 가린다. 역쌍 `XY`/`YX` 는 같은 기준에 속하고
	 * 한쪽은 기준을 거꾸로 돌리는 것이라, 정방향만 훑으며 외울 때는 목록이 두 배로
	 * 길어 보인다. 암기 상태와 무관한 표시 필터이므로 여기(표시 설정)에 둔다.
	 */
	hideInverse = $state<boolean>(readBool(KEY_HIDE_INVERSE, false));

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => localStorage.setItem(KEY_MODE, this.mode));
				$effect(() => localStorage.setItem(KEY_NOTATION, this.notation));
				$effect(() => localStorage.setItem(KEY_QUIZ_INPUT, this.quizInput));
				$effect(() => localStorage.setItem(KEY_HIDE_INVERSE, String(this.hideInverse)));
				$effect(() => {
					localStorage.setItem(KEY_THEME, this.theme);
					const root = document.documentElement;
					if (this.theme === 'system') delete root.dataset.theme;
					else root.dataset.theme = this.theme;
				});
			});
		}
	}

	toggleMode() {
		this.mode = this.mode === 'setup' ? 'direct' : 'setup';
	}
	toggleNotation() {
		this.notation = this.notation === 'strict' ? 'compact' : 'strict';
	}
	cycleTheme() {
		const order: Theme[] = ['system', 'light', 'dark'];
		this.theme = order[(order.indexOf(this.theme) + 1) % order.length];
	}
}

export const settings = new Settings();
