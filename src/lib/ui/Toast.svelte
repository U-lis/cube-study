<!--
  짧은 알림. 스스로 사라지고, 탭하면 즉시 닫힌다.
  화면을 가리지 않도록 하단 네비 위에 띄운다.
-->
<script lang="ts">
	let {
		text,
		onclose,
		duration = 4000
	}: { text: string; onclose: () => void; duration?: number } = $props();

	$effect(() => {
		const t = setTimeout(onclose, duration);
		return () => clearTimeout(t);
	});
</script>

<button type="button" class="toast" data-toast onclick={onclose}>{text}</button>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(52px + 0.7rem + env(safe-area-inset-bottom, 0px));
		z-index: 10;
		transform: translateX(-50%);
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 0.6rem 0.9rem;
		font-family: var(--sans);
		font-size: 0.85rem;
		text-align: left;
		color: var(--bg);
		background: var(--fg);
		border: none;
		border-radius: 999px;
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.25);
		cursor: pointer;
	}
</style>
