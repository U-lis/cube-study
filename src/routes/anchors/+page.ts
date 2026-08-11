import { loadDataset } from '$lib/data/loader.js';
import { anchorOrder } from '$lib/domain/anchor.js';
import { ANCHOR_DIRECT } from '$lib/domain/types.js';

export const prerender = true;

export async function load() {
	const ds = await loadDataset();
	// meta.anchorLearnOrder 를 그대로 쓴다. 없으면 키 순서.
	// 무엇을 기준으로 매긴 순서인지는 데이터가 정한다 — v3 은 담당 케이스가 많은 순,
	// v5 는 평균 길이를 많이 줄이는 순이다. 여기서 다시 정렬하지 않는다.
	//
	// 담당 수와 어긋나 보이는 것은 정상이다 (DO 28개가 IT 42개보다 앞).
	// 담당 수는 "10개를 다 외운 뒤 그 기준이 몇 케이스를 맡는가" 이고, 이 순서는
	// "다음에 무엇을 추가해야 지금 가장 좋아지는가" 라 축이 다르다. 기준끼리 커버가
	// 겹치기 때문에 최종 지분이 큰 기준이 학습 도중의 개선폭도 크다는 보장이 없다.
	// GC·BU 를 고정하고 세 번째 후보를 전부 계산해 확인했다 — 데이터의 목적함수
	// (셋업 길이 → 무브 수)로 DO 가 평균 셋업 1.931 로 최소이고, 그 결과가
	// meta.learningCurve[2] 의 11.03 과 일치한다. 담당 수로 정렬하면 이 곡선과
	// 어긋난다 (meta.anchorLearnOrderNote).
	//
	// 담당 수 순으로 보여줄 일이 생기면 이 화면만 따로 정렬할 것. 학습 순서를
	// 안내하는 자리(퀴즈 입력 패드)는 anchorOrder 를 그대로 써야 한다.
	const rows = anchorOrder(ds).map((name) => ({ name, ...ds.anchors[name] }));
	const directCount = Object.values(ds.cases).filter(
		(c) => c.setup.anchor === ANCHOR_DIRECT
	).length;
	return { rows, directCount };
}
