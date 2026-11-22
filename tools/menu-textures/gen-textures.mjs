// Sinh ảnh nền TẠM cho sách thực đơn (giấy kem, hoa văn line-art, giấy kraft, vân gỗ) bằng canvas trong trình duyệt,
// xuất WebP vào frontend/public/images/menu/. Thay bằng ảnh thật thì giữ nguyên tên file (xem README.md cùng thư mục).
//
// Chạy (cần Microsoft Edge hoặc Chrome; dùng playwright có sẵn trong frontend/node_modules):
//   node tools/menu-textures/gen-textures.mjs
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../frontend/public/images/menu');
const MAX_BYTES = 200 * 1024;
mkdirSync(OUT, { recursive: true });

const TEXTURES = [
  { file: 'paper-cream.webp', w: 900, h: 1200, kind: 'cream' },
  { file: 'paper-lineart.webp', w: 900, h: 1200, kind: 'lineart' },
  { file: 'paper-kraft.webp', w: 900, h: 1200, kind: 'kraft' },
  { file: 'wood-light.webp', w: 1600, h: 1000, kind: 'wood' },
];

/** Chạy trong trình duyệt: vẽ texture, trả data URL WebP. Số ngẫu nhiên có hạt giống cố định → chạy lại ra cùng ảnh. */
function draw({ w, h, kind, quality }) {
  let seed = { cream: 11, lineart: 23, kraft: 37, wood: 51 }[kind];
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  const mottle = (n, rMin, rMax, colors) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, r = rMin + rnd() * (rMax - rMin);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const color = colors[i % colors.length];
      grad.addColorStop(0, color);
      // Kết thúc bằng CÙNG màu, alpha 0 (không dùng rgba(0,0,0,0): canvas trộn màu không nhân alpha → loang xám).
      grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  };
  const fibers = (n, colors, lenMin, lenMax) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, len = lenMin + rnd() * (lenMax - lenMin), a = rnd() * Math.PI;
      g.strokeStyle = colors[i % colors.length];
      g.lineWidth = 0.4 + rnd() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.5, y + Math.sin(a + 0.4) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  };
  const noise = (amp) => {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 2 * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  };
  const vignette = (rgba) => {
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, rgba.replace(/[\d.]+\)$/, '0)'));
    grad.addColorStop(1, rgba);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  };

  if (kind === 'cream') {
    g.fillStyle = '#f6eddc';
    g.fillRect(0, 0, w, h);
    mottle(70, 80, 380, ['rgba(196,160,104,0.06)', 'rgba(255,252,244,0.10)', 'rgba(170,130,80,0.04)']);
    fibers(2600, ['rgba(150,115,70,0.07)', 'rgba(255,255,255,0.12)', 'rgba(120,90,50,0.05)'], 4, 16);
    noise(3.5);
    vignette('rgba(140,100,55,0.12)');
  }

  if (kind === 'kraft') {
    g.fillStyle = '#cfae84';
    g.fillRect(0, 0, w, h);
    mottle(90, 60, 320, ['rgba(120,80,40,0.08)', 'rgba(240,215,175,0.10)', 'rgba(95,62,30,0.06)']);
    fibers(4200, ['rgba(245,225,190,0.16)', 'rgba(90,60,28,0.10)', 'rgba(70,45,20,0.07)'], 5, 22);
    noise(5);
    vignette('rgba(90,55,25,0.14)');
  }

  if (kind === 'lineart') {
    g.fillStyle = '#fbf7f0';
    g.fillRect(0, 0, w, h);
    mottle(40, 100, 360, ['rgba(214,196,168,0.06)', 'rgba(255,255,255,0.10)']);
    noise(2);
    g.strokeStyle = 'rgba(150,126,98,0.26)';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const icons = [
      // Đĩa + dao nĩa
      () => { g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(-44, -26); g.lineTo(-44, 30); g.moveTo(-50, -26); g.lineTo(-50, -10); g.quadraticCurveTo(-44, -2, -38, -10); g.lineTo(-38, -26); g.stroke();
        g.beginPath(); g.moveTo(44, 30); g.lineTo(44, -26); g.quadraticCurveTo(52, -12, 44, 2); g.stroke(); },
      // Miếng bít tết T-bone
      () => { g.beginPath(); g.moveTo(-34, -8); g.bezierCurveTo(-36, -30, 10, -34, 30, -20); g.bezierCurveTo(44, -8, 38, 22, 14, 26); g.bezierCurveTo(-12, 30, -32, 18, -34, -8); g.stroke();
        g.beginPath(); g.moveTo(-6, -28); g.lineTo(-2, 26); g.moveTo(-2, 2); g.lineTo(24, 4); g.stroke();
        g.beginPath(); g.moveTo(-24, -6); g.quadraticCurveTo(-14, -12, -10, -2); g.stroke(); },
      // Nhành lá thơm
      () => { g.beginPath(); g.moveTo(0, 36); g.quadraticCurveTo(4, 0, -2, -36); g.stroke();
        for (let k = -2; k <= 2; k++) { const y = k * 13; g.beginPath(); g.ellipse(-10, y, 11, 5, -0.6, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(12, y - 6, 11, 5, 0.6, 0, Math.PI * 2); g.stroke(); } },
      // Ớt
      () => { g.beginPath(); g.moveTo(-26, -18); g.bezierCurveTo(-10, -26, 22, -6, 28, 26); g.bezierCurveTo(10, 10, -14, 2, -26, -8); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(-26, -14); g.quadraticCurveTo(-34, -24, -30, -34); g.stroke(); },
      // Tô có khói
      () => { g.beginPath(); g.moveTo(-34, 0); g.lineTo(34, 0); g.bezierCurveTo(32, 26, -32, 26, -34, 0); g.stroke(); g.beginPath(); g.moveTo(-12, 26); g.lineTo(12, 26); g.stroke();
        for (const x of [-12, 0, 12]) { g.beginPath(); g.moveTo(x, -6); g.bezierCurveTo(x - 6, -14, x + 6, -20, x, -30); g.stroke(); } },
      // Ly rượu vang
      () => { g.beginPath(); g.moveTo(-16, -32); g.lineTo(16, -32); g.bezierCurveTo(18, -6, 6, 4, 0, 4); g.bezierCurveTo(-6, 4, -18, -6, -16, -32); g.stroke();
        g.beginPath(); g.moveTo(0, 4); g.lineTo(0, 28); g.moveTo(-14, 30); g.lineTo(14, 30); g.moveTo(-14, -18); g.lineTo(14, -18); g.stroke(); },
      // Củ tỏi
      () => { g.beginPath(); g.moveTo(0, -32); g.bezierCurveTo(4, -20, 30, -12, 28, 10); g.bezierCurveTo(26, 30, -26, 30, -28, 10); g.bezierCurveTo(-30, -12, -4, -20, 0, -32); g.stroke();
        g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(-10, 4, 0, 28); g.moveTo(0, -20); g.quadraticCurveTo(12, 4, 6, 28); g.stroke(); },
    ];
    const cell = 150;
    let n = 0;
    for (let y = cell / 2; y < h + cell / 2; y += cell) {
      for (let x = (Math.round(y / cell) % 2 ? cell : cell / 2); x < w + cell / 2; x += cell) {
        g.save();
        g.translate(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40);
        g.rotate((rnd() - 0.5) * 1.2);
        const s = 0.8 + rnd() * 0.5;
        g.scale(s, s);
        icons[(n++ + Math.floor(rnd() * 3)) % icons.length]();
        g.restore();
      }
    }
  }

  if (kind === 'wood') {
    // Ván gỗ sáng dọc, lặp liền mạch theo cả hai chiều (đường vân dùng sóng sin có chu kỳ chia hết chiều cao).
    const planks = 8, pw = w / planks;
    for (let p = 0; p < planks; p++) {
      const x0 = p * pw;
      const tone = 226 + Math.round((rnd() - 0.5) * 16);
      g.fillStyle = `rgb(${tone + 8},${tone - 6},${tone - 34})`;
      g.fillRect(x0, 0, pw, h);
      for (let k = 0; k < 46; k++) {
        const bx = x0 + rnd() * pw, amp = 2 + rnd() * 7, waves = 1 + Math.floor(rnd() * 3), phase = rnd() * Math.PI * 2;
        g.strokeStyle = `rgba(${150 + rnd() * 30},${115 + rnd() * 25},${70 + rnd() * 20},${0.06 + rnd() * 0.14})`;
        g.lineWidth = 0.6 + rnd() * 1.6;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) {
          const xx = bx + Math.sin((y / h) * Math.PI * 2 * waves + phase) * amp;
          if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
        }
        g.stroke();
      }
      if (rnd() < 0.5) {
        const ky = rnd() * h, kx = x0 + pw * (0.3 + rnd() * 0.4);
        for (let r = 3; r < 16; r += 3) { g.strokeStyle = 'rgba(140,100,60,0.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(kx, ky, r * 0.6, r * 1.6, 0, 0, Math.PI * 2); g.stroke(); }
      }
      g.fillStyle = 'rgba(120,92,58,0.35)';
      g.fillRect(x0, 0, 2, h);
      g.fillStyle = 'rgba(255,250,240,0.35)';
      g.fillRect(x0 + 2, 0, 1, h);
    }
    noise(3);
  }

  return c.toDataURL('image/webp', quality);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(() => chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage();
for (const t of TEXTURES) {
  let quality = 0.82;
  let buf;
  for (;;) {
    const url = await page.evaluate(draw, { ...t, quality });
    buf = Buffer.from(url.split(',')[1], 'base64');
    if (buf.length <= MAX_BYTES || quality <= 0.4) break;
    quality -= 0.08;
  }
  const file = path.join(OUT, t.file);
  writeFileSync(file, buf);
  console.log(`${t.file}: ${t.w}×${t.h}, ${(statSync(file).size / 1024).toFixed(0)} KB (quality ${quality.toFixed(2)})`);
}
await browser.close();
