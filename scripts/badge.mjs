/**
 * 알림 badge — Android 상태바의 작은 아이콘 (#33, SPEC FR-IC).
 *
 * 알림에 badge 가 없으면 Chrome 이 종 모양을 띄운다. Android 는 badge 의 **알파만**
 * 쓰고 색은 시스템이 칠하므로 투명 바탕에 흰 실루엣이면 된다. 큐브는 등각으로 세 면을
 * 보이고 면마다 3×3 스티커를 틈으로 나눈다 — 24dp 에서도 큐브로 읽힌다.
 *
 *   node scripts/badge.mjs      → static/badge.svg, static/badge-96.png
 *
 * 꼭짓점을 손으로 적지 않고 면의 두 변 벡터에서 스티커를 계산한다.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const S = 96;
const c = { x: 48, y: 49 };
const r = 43; // 중심에서 꼭짓점까지
const dx = r * Math.cos(Math.PI / 6);
const dy = r / 2;
const top = { x: c.x, y: c.y - r };
const ul = { x: c.x - dx, y: c.y - dy };
const ur = { x: c.x + dx, y: c.y - dy };
const dl = { x: c.x - dx, y: c.y + dy };

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
// 면: 원점과 두 변
const faces = [
	{ o: ul, u: sub(top, ul), v: sub(c, ul) }, // 윗면
	{ o: ul, u: sub(c, ul), v: sub(dl, ul) }, // 왼면
	{ o: c, u: sub(ur, c), v: sub(dl, ul) } // 오른면
];

const GAP = 0.09; // 스티커 사이 틈 (한 칸 대비)
const pt = (f, a, b) => {
	const x = f.o.x + f.u.x * a + f.v.x * b;
	const y = f.o.y + f.u.y * a + f.v.y * b;
	return `${x.toFixed(2)},${y.toFixed(2)}`;
};
const polys = [];
for (const f of faces) {
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			const a0 = (i + GAP) / 3, a1 = (i + 1 - GAP) / 3;
			const b0 = (j + GAP) / 3, b1 = (j + 1 - GAP) / 3;
			polys.push(`<polygon points="${pt(f, a0, b0)} ${pt(f, a1, b0)} ${pt(f, a1, b1)} ${pt(f, a0, b1)}"/>`);
		}
	}
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><g fill="#fff">${polys.join('')}</g></svg>\n`;

writeFileSync('static/badge.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('static/badge-96.png');
console.log('static/badge.svg, static/badge-96.png');
