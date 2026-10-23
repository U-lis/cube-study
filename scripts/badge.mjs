/**
 * 알림 badge — Android 상태바의 작은 아이콘 (#33, SPEC FR-IC).
 *
 * 알림에 badge 가 없으면 Chrome 이 종 모양을 띄운다. Android 는 badge 의 **알파만**
 * 쓰고 색은 시스템이 칠하므로 투명 바탕에 흰 실루엣이면 된다.
 *
 * 큐브 정면 한 면, 3×3 스티커다. 처음엔 등각으로 세 면(27칸)을 그렸는데 상태바
 * 크기(24dp)에서 너무 잘게 보였다 (2026-10-18 실기기). 칸을 9개로 줄이고 틈을 넓혔다.
 *
 *   node scripts/badge.mjs      → static/badge.svg, static/badge-face-96.png
 *
 * 파일명을 바꾼 것은 캐시 때문이다 — 기기가 옛 그림을 같은 주소로 들고 있을 수 있다.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const S = 96;
const PAD = 6; // 가장자리 여백. 상태바가 아이콘을 잘라 먹지 않게
const GAP = 7; // 스티커 사이 틈 — 24dp 로 줄였을 때 1px 이상 남는 폭
const R = 5; // 스티커 모서리
const cell = (S - 2 * PAD - 2 * GAP) / 3;

const rects = [];
for (let i = 0; i < 3; i++) {
	for (let j = 0; j < 3; j++) {
		const x = PAD + j * (cell + GAP);
		const y = PAD + i * (cell + GAP);
		rects.push(
			`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${R}"/>`
		);
	}
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><g fill="#fff">${rects.join('')}</g></svg>\n`;

writeFileSync('static/badge.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('static/badge-face-96.png');
console.log('static/badge.svg, static/badge-face-96.png');
