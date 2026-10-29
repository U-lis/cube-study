<!--
	OP 코너 — 조회 (#18, SPEC FR-OP-L).

	Y + 21 타깃 = 22줄 표. 줄마다 암기 체크 상자. 표 아래 `<details>` 가 원리
	설명(GLOBAL AD-10)을 담는다 — 기본 접힘.

	데이터 JSON 을 직접 import 한다. 로더(`loadDataset`)는 3-style corner/UBL 하나만
	아는 코드라 OP 를 그 자리에 넣으면 그쪽 테스트를 어긋나게 만든다 — OP 는 OP
	데이터만 쓰면 된다 (M2 조회와 같은 결정).

	기록을 안 남기는 화면이라 설정 잠금이 없다 (CLAUDE.md).
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import { op } from '$lib/ui/op.svelte.js';
	import { displayPartsOf, itemsOf, type OpDataSet, type OpItem } from '$lib/domain/op.js';
	import dataJson from '$lib/data/corner-UBL-op.json';

	const ds = dataJson as unknown as OpDataSet;
	const items: OpItem[] = itemsOf(ds);
	const yPerm = ds.meta.yPerm;
</script>

<svelte:head><title>OP 코너 — 조회</title></svelte:head>

<PageTitle href="/" label="홈"><h1>조회</h1></PageTitle>

<section class="lookup" data-op-lookup>
	<table>
		<thead>
			<tr>
				<th scope="col">문자</th>
				<th scope="col">자리</th>
				<th scope="col">공식</th>
				<th scope="col">암기</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr data-row-id={item.id} data-y-row={item.isYRow ? '' : undefined}>
					<td class="letter" data-letter>{item.letter}</td>
					<td class="place" data-place>{item.piece}</td>
					<td class="alg">
						<Alg parts={displayPartsOf(item, yPerm)} size="sm" />
					</td>
					<td class="check">
						<label>
							<input
								type="checkbox"
								checked={op.checked.has(item.id)}
								onchange={() => op.toggle(item.id)}
								data-memorize-input
								data-row={item.id}
							/>
							<span class="sr">암기함</span>
						</label>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<!--
		원리 설명 (GLOBAL AD-10, SPEC FR-OP-L-2). 표가 본문이라 접어 둔다 — 한 번 읽고
		나면 자리만 먹는다.
	-->
	<details data-principle>
		<summary>원리</summary>
		<ul>
			<li>교환은 <code>[Y]</code> 하나다 — 버퍼 UBL 과 DFR 의 A 자리 스티커가 바뀐다.</li>
			<li>셋업은 원하는 스티커를 DFR 의 P 자리로 가져오는 것이다. 되돌림까지 외운다.</li>
			<li>
				U·B·L 면 무브는 버퍼 UBL 을 건드린다. D·F·R 면 무브만 써서 큐브의 방향을 바꾸지
				않고 타깃을 P 자리로 가져온다.
			</li>
			<li>
				<code>[Y]</code> 는 UB↔UL 엣지도 함께 바꾼다 — 코너와 엣지 둘 다 쓰면 엣지 쪽에서
				M2 패리티 공식이 그 자리를 닫는다.
			</li>
			<li>
				P 자리의 스티커가 처음부터 그 코너라 셋업이 비는 줄은 공식이 <code>[Y]</code>
				하나다. Y 자신은 Y-perm 15수를 그대로 외우는 줄이다.
			</li>
		</ul>
	</details>
</section>

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0;
	}
	.lookup {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding-top: 0.4rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	thead th {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted);
		text-align: left;
		padding: 0.4rem 0.3rem;
		border-bottom: 1px solid var(--border);
		/* "문자" 가 좁은 첫 칸에서 두 줄로 쪼개지지 않게 한다. 390×844 리뷰에서 발견. */
		white-space: nowrap;
	}
	tbody td {
		padding: 0.35rem 0.3rem;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tr[data-y-row] td {
		background: var(--surface);
	}
	.letter {
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 600;
		width: 1.6rem;
	}
	.place {
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.alg {
		min-width: 0;
	}
	.check {
		text-align: right;
		width: 44px;
	}
	/* 터치 타깃 44px (화면 규약). 레이블 전체가 눌리는 영역이다. */
	.check label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		cursor: pointer;
	}
	.check input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
		cursor: pointer;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	details {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}
	summary {
		padding: 0.7rem 0.9rem;
		min-height: 44px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}
	details[open] summary {
		border-bottom: 1px solid var(--border);
	}
	details ul {
		margin: 0;
		padding: 0.7rem 1.2rem 0.9rem 1.6rem;
	}
	details li {
		margin: 0.25rem 0;
		font-size: 0.88rem;
		line-height: 1.5;
	}
	details code {
		font-family: var(--mono);
		font-size: 0.85rem;
		padding: 0.05rem 0.25rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	@media (prefers-reduced-motion: reduce) {
		details {
			transition: none;
		}
	}
</style>
