<!--
	M2 엣지 — 조회 (#17, SPEC FR-M2-L).

	타깃 22 + M 슬라이스 짝수 번째 4 + 패리티 1 = 27줄 표. 줄마다 암기 체크 상자. 표
	아래 `<details>` 가 원리 설명(GLOBAL AD-10)을 담는다 — 기본 접힘.

	데이터 JSON 을 직접 import 한다. 로더(`loadDataset`)는 corner/UBL 하나만 아는 코드라
	M2 를 그 자리에 넣으면 그쪽 테스트를 어긋나게 만든다 — M2 는 M2 데이터만 쓰면 된다.

	기록을 안 남기는 화면이라 설정 잠금이 없다 (CLAUDE.md).
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import { m2 } from '$lib/ui/m2.svelte.js';
	import { displayParts, itemsOf, type M2DataSet, type M2Item } from '$lib/domain/m2.js';
	import dataJson from '$lib/data/edge-DF-m2.json';

	const ds = dataJson as unknown as M2DataSet;
	const items: M2Item[] = itemsOf(ds);

	/**
	 * 순번 셀 문구. 데이터가 정하는 값이라 코드는 라벨만 입힌다 (SPEC FR-M2-D-5, AD-9).
	 * null (A·Q 처럼 짝이 버퍼인 줄) 은 순번과 무관하므로 빈 문자열.
	 */
	function orderText(order: M2Item['order']): string {
		if (order === 'odd') return '홀수 번째';
		if (order === 'even') return '짝수 번째';
		if (order === 'parity') return '패리티';
		return '';
	}
</script>

<svelte:head><title>M2 엣지 — 조회</title></svelte:head>

<PageTitle href="/" label="홈"><h1>조회</h1></PageTitle>

<section class="lookup" data-m2-lookup>
	<table>
		<thead>
			<tr>
				<th scope="col">문자</th>
				<th scope="col">자리</th>
				<th scope="col">순번</th>
				<th scope="col">공식</th>
				<th scope="col">암기</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr data-row-id={item.id} data-order={item.order}>
					<td class="letter" data-letter>{item.letter}</td>
					<td class="place" data-place>{item.place}</td>
					<td class="order" data-order-text>{orderText(item.order)}</td>
					<td class="alg">
						<Alg parts={displayParts(item.display)} size="sm" />
					</td>
					<td class="check">
						<label>
							<input
								type="checkbox"
								checked={m2.checked.has(item.id)}
								onchange={() => m2.toggle(item.id)}
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
		원리 설명 (GLOBAL AD-10, SPEC FR-M2-L-2). 표가 본문이라 접어 둔다 — 한 번 읽고
		나면 자리만 먹는다 (SPEC D-4).
	-->
	<details data-principle>
		<summary>원리</summary>
		<ul>
			<li>교환은 <code>M2</code> 하나다 — 버퍼 DF 와 UB 의 A 자리 스티커가 바뀐다.</li>
			<li>셋업은 원하는 스티커를 A 자리로 가져오는 것이다. 되돌림까지 외운다.</li>
			<li>
				U·D·F·B 면 스티커는 U 면 무브로, R·L 면 스티커는 B 면 무브로 A 자리에 가져온다.
				큐브를 돌리지 않으므로 기준 자리 UB 가 그대로다.
			</li>
			<li>
				H·N 은 B 층(BL·BR) 의 R·L 면 스티커라 2층 무브
				<code>l</code> / <code>r</code> 로 가져온다.
			</li>
			<li>M 슬라이스 스티커(C·W·I·S)는 전용 공식을 쓴다.</li>
			<li>
				<code>M2</code> 한 번마다 M 슬라이스가 180° 어긋난다. 짝수 번째에서 C↔W, I↔S 공식이
				서로 바뀐다 — A·Q 는 짝이 버퍼라 순번과 무관하다.
			</li>
			<li>
				엣지 타깃 수가 홀수면 엣지를 다 푼 직후 패리티 공식을 한 번 넣는다. 그 뒤 UB↔UL
				교환 하나만 남고, 코너 패리티 공식이 그것을 마저 처리한다.
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
	}
	tbody td {
		padding: 0.35rem 0.3rem;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tr[data-order='parity'] td {
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
	.order {
		font-size: 0.78rem;
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
