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

export type Theme = 'system' | 'light' | 'dark';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
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

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => localStorage.setItem(KEY_MODE, this.mode));
				$effect(() => localStorage.setItem(KEY_NOTATION, this.notation));
				$effect(() => localStorage.setItem(KEY_QUIZ_INPUT, this.quizInput));
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
