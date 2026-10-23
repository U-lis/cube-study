<!--
	알림 설정 (#33, SPEC FR-NT).

	앱 전역 설정은 라우트 축 밖 `/settings/*` 에 둔다 (FR-NT-1). `/settings` 자체는
	화면이 아니다 — 서랍의 설정 묶음이 그 목록 노릇을 한다 (D-2).

	켬/끔은 SegToggle 이 아니라 버튼 둘이다. `enable()` 은 **누른 그 클릭 안에서**
	불러야 권한 창이 뜬다 — 바인딩 값이 바뀐 뒤 `$effect` 에서 부르면 제스처 밖이다.

	기록을 안 남기는 화면이라 설정을 잠그지 않는다 (FR-NT-8).
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import { push } from '$lib/ui/push.svelte.js';
	import { daily } from '$lib/ui/daily.svelte.js';
	import { DAILY_SIZES } from '$lib/domain/daily.js';

	if (browser) void push.refresh();

	const STATUS: Record<string, string> = {
		loading: '확인 중',
		on: '켜짐',
		off: '꺼짐',
		denied: '권한 거부됨',
		unsupported: '이 브라우저는 지원하지 않음'
	};

	let on = $derived(push.view === 'on');
	let blocked = $derived(push.view === 'unsupported' || push.view === 'denied');
	let tz = $derived(browser ? Intl.DateTimeFormat().resolvedOptions().timeZone : '');
</script>

<svelte:head><title>CubeStudy — 알림</title></svelte:head>

<PageTitle href="/" label="홈"><h1>알림</h1></PageTitle>

<section class="settings" data-push-view={push.view}>
	<h2>매일 퀴즈</h2>
	<p class="desc">
		정한 시각에 알림을 보냅니다. 알림을 누르면 매일 퀴즈 화면이 열립니다. 코너 3-style
		공식을 암기 표시한 것에서 먼저 내고, 모자라면 나머지를 무작위로 채웁니다.
	</p>

	<div class="seg" role="group" aria-label="매일 퀴즈">
		<button
			type="button"
			data-push-off
			aria-pressed={!on}
			class:active={!on}
			disabled={push.busy || !on}
			onclick={() => push.disable()}>끔</button
		>
		<button
			type="button"
			data-push-on
			aria-pressed={on}
			class:active={on}
			disabled={push.busy || push.view === 'loading' || on || blocked}
			onclick={() => push.enable()}>켬</button
		>
	</div>

	<label class="time">
		<span>시각</span>
		<input
			type="time"
			data-push-time
			value={push.daily}
			onchange={(e) => push.setDaily(e.currentTarget.value)}
		/>
	</label>

	<!--
		문제 수는 알림과 무관하게 기기에만 저장한다 (FR-DQ-1). 알림을 못 받는 기기도
		매일 퀴즈 화면은 쓴다 — 그래서 켬/끔이나 권한으로 잠그지 않는다.
	-->
	<label class="time">
		<span>문제 수</span>
		<select
			data-daily-size
			value={daily.size}
			onchange={(e) => daily.setSize(Number(e.currentTarget.value))}
		>
			{#each DAILY_SIZES as n (n)}
				<option value={n}>{n}</option>
			{/each}
		</select>
	</label>

	<p class="status" data-push-status>상태: {STATUS[push.view]}</p>
	<p class="error" data-push-error hidden={!push.error}>{push.error}</p>
</section>

<section class="body">
	<h2>조건 알림</h2>
	<p class="desc" data-push-conditions>
		등록된 조건이 없습니다. 조건이 생기면 이 자리에 하나씩 나옵니다.
	</p>

	<h2>이 기기</h2>
	<dl>
		<dt>시간대</dt>
		<dd data-push-tz>{tz}</dd>
	</dl>
	<p class="desc">iPhone 은 홈 화면에 추가한 앱에서만 알림이 옵니다.</p>
</section>

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0;
	}
	h2 {
		margin: 1rem 0 0.4rem;
		font-size: 0.95rem;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 32rem;
	}
	.desc {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--muted);
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}
	.seg button {
		min-height: 44px;
		font: inherit;
		color: var(--muted);
		background: var(--bg);
		border: none;
		cursor: pointer;
	}
	.seg button.active {
		color: var(--bg);
		background: var(--accent);
		font-weight: 600;
	}
	.seg button:disabled {
		cursor: default;
	}
	.seg button:disabled:not(.active) {
		opacity: 0.5;
	}
	.time {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 48px;
		padding: 0 0.8rem;
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.time input,
	.time select {
		min-height: 40px;
		font: inherit;
		font-size: 1rem;
		color: var(--fg);
		background: transparent;
		border: none;
	}
	.time option {
		color: var(--fg);
		background: var(--bg);
	}
	.status {
		margin: 0;
		font-size: 0.9rem;
	}
	.error {
		margin: 0;
		font-size: 0.88rem;
		color: var(--danger);
	}
	.error[hidden] {
		display: none;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 1rem;
		margin: 0;
		font-size: 0.9rem;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-family: var(--mono);
	}
</style>
