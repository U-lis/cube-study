<!--
  케이스 입력. 키보드 전용 (FR-3).
  온스크린 스티커 패드를 두지 않는다.

  Speffz(A~X) 밖 문자는 값에 반영하지 않고 배경 플래시로만 알린다.
  한글 IME 자음·숫자·기호가 이 규칙 하나로 처리되므로 composition 이벤트를 다루지 않는다.
-->
<script lang="ts">
	import { sanitize } from '$lib/domain/validate.js';

	let { value = $bindable('') }: { value?: string } = $props();

	let flash = $state(false);
	let el: HTMLInputElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function onInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const cleaned = sanitize(target.value);
		// 걸러진 문자가 실제로 있을 때만 플래시한다 (정상 입력마다 튀지 않게).
		if (cleaned.length !== [...target.value].length) trigger();
		value = cleaned;
		target.value = cleaned;
	}

	function trigger() {
		flash = true;
		clearTimeout(timer);
		timer = setTimeout(() => (flash = false), 300);
	}

	export function focus() {
		el?.focus();
	}
</script>

<div class="wrap">
	<input
		bind:this={el}
		class:flash
		type="text"
		value={value}
		oninput={onInput}
		maxlength="2"
		autocapitalize="off"
		autocorrect="off"
		autocomplete="off"
		spellcheck="false"
		inputmode="text"
		aria-label="케이스 코드"
		aria-invalid={flash}
		placeholder="예: LB"
	/>
	{#if value.length > 0}
		<button
			type="button"
			class="clear"
			data-action="clear"
			onclick={() => (value = '')}
			aria-label="지우기">×</button
		>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	input {
		width: 100%;
		padding: 0.7rem 2.4rem 0.7rem 0.9rem;
		font-family: var(--mono);
		font-size: 1.75rem;
		font-variant-ligatures: none;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--fg);
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: 10px;
		transition:
			background-color 140ms ease,
			border-color 140ms ease;
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
	}
	input.flash {
		background: var(--danger-bg);
		border-color: var(--danger);
	}
	input::placeholder {
		color: var(--muted);
		letter-spacing: normal;
		font-size: 1.1rem;
	}
	.clear {
		position: absolute;
		right: 0.6rem;
		width: 1.9rem;
		height: 1.9rem;
		font-size: 1.2rem;
		line-height: 1;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}
	.clear:hover {
		background: var(--border);
		color: var(--fg);
	}
</style>
