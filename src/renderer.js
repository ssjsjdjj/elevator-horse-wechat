'use strict';

const P = {
  paper: '#f6f3e8', ink: '#29282f', muted: '#77736b', line: '#d8d4c8',
  lime: '#d8f45b', purple: '#b4a0e9', mane: '#68508c', wall: '#d8d6c9',
  door: '#b9bcb4', red: '#b55343', cream: '#e4d88e'
};
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hits = [];
    this.layout = { scale: 1, x: 0, y: 0, height: 700, stageH: 312 };
  }

  resize(info, menu) {
    const w = info.windowWidth || info.screenWidth || 375;
    const h = info.windowHeight || info.screenHeight || 667;
    const dpr = clamp(info.pixelRatio || 1, 1, 3);
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const safe = info.safeArea || {};
    const top = Math.max(safe.top || 0, menu && menu.bottom > 0 ? menu.bottom + 8 : 12);
    const bottom = Math.max(10, h - (safe.bottom || h));
    const available = Math.max(180, h - top - bottom);
    const scale = Math.min(w / 375, available / 700);
    const height = Math.min(810, available / scale);
    this.layout = {
      x: (w - 375 * scale) / 2,
      y: top + (available - height * scale) / 2,
      scale: scale, height: height, stageH: 312 + height - 700
    };
  }

  point(touch) {
    return {
      x: ((touch.clientX === undefined ? touch.x : touch.clientX) - this.layout.x) / this.layout.scale,
      y: ((touch.clientY === undefined ? touch.y : touch.clientY) - this.layout.y) / this.layout.scale
    };
  }

  hitAt(point) {
    for (let i = this.hits.length - 1; i >= 0; i -= 1) {
      const hit = this.hits[i];
      if (point.x >= hit.x && point.x <= hit.x + hit.w && point.y >= hit.y && point.y <= hit.y + hit.h) return hit.id;
    }
    return null;
  }

  rect(x, y, w, h, radius, fill, stroke, lineWidth) {
    const c = this.ctx;
    const r = Math.min(radius || 0, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth || 2; c.stroke(); }
  }

  ellipse(x, y, rx, ry, fill, stroke, width) {
    const c = this.ctx;
    c.beginPath();
    // 使用 scale + arc，兼容不实现 ellipse 的旧 Canvas。
    c.save(); c.translate(x, y); c.scale(rx, ry); c.arc(0, 0, 1, 0, Math.PI * 2); c.restore();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 2.5; c.stroke(); }
  }

  line(x1, y1, x2, y2, color, width) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = color || P.ink; c.lineWidth = width || 1; c.stroke();
  }

  text(value, x, y, size, color, weight, align) {
    const c = this.ctx;
    c.font = (weight || '400') + ' ' + (size || 14) + 'px ' + FONT;
    c.fillStyle = color || P.ink; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.fillText(String(value), x, y);
  }

  fitText(value, x, y, maxWidth, size, color, weight, align) {
    let s = size;
    const c = this.ctx;
    do { c.font = (weight || '400') + ' ' + s + 'px ' + FONT; if (c.measureText(value).width <= maxWidth) break; s -= 0.5; } while (s > 10);
    this.text(value, x, y, s, color, weight, align);
  }

  button(id, label, x, y, w, h, options) {
    const o = options || {};
    const dy = o.pressed ? 3 : 0;
    if (!o.flat) this.rect(x, y + 4, w, h, 12, P.ink);
    this.rect(x, y + dy, w, h, 12, o.fill || P.lime, o.flat ? P.line : P.ink, o.flat ? 1 : 2);
    this.fitText(label, x + w / 2, y + dy + (o.sub ? 29 : h / 2 + 6), w - 20, o.size || 18, P.ink, '700', 'center');
    if (o.sub) this.text(o.sub, x + w / 2, y + dy + 49, 10, P.ink, '400', 'center');
    if (id) this.hits.push({ id: id, x: x, y: y, w: w, h: h + 4 });
  }

  horse(cx, ground, human, time, size) {
    const c = this.ctx;
    c.save(); c.translate(cx, ground); c.scale(size || 1, size || 1);
    this.ellipse(0, 0, 76, 8, '#29282f25');
    c.translate(0, -10);
    if (!human) { c.rotate(Math.sin(time * 12) * 0.075); c.translate(0, -4 - Math.sin(time * 12) * 4); }
    const leg = (x, angle, humanLeg) => {
      c.save(); c.translate(x, -42); c.rotate(angle);
      this.rect(-8, 0, 16, 39, 4, humanLeg ? '#4c4c59' : P.purple, P.ink, 2.5);
      this.rect(-10, 31, 24, 11, 3, P.ink); c.restore();
    };
    if (human) {
      leg(-23, 0, true); leg(23, 0, true);
      this.rect(-45, -119, 90, 84, 11, '#f1eee3', P.ink, 3);
      this.line(-42, -101, -55, -53, P.ink, 3); this.line(42, -101, 52, -52, P.ink, 3);
      this.rect(44, -41, 34, 29, 4, '#675747', P.ink, 2.5);
      this.rect(53, -47, 15, 7, 2, null, P.ink, 2.5);
      this.text('工', 61, -21, 12, '#e4d9b6', '500', 'center');
      c.beginPath(); c.moveTo(-5, -114); c.lineTo(6, -114); c.lineTo(3, -104); c.lineTo(8, -76); c.lineTo(0, -67); c.lineTo(-8, -76); c.lineTo(-3, -104); c.closePath(); c.fillStyle = '#b86157'; c.fill();
      this.line(-23, -118, -10, -103, P.ink, 1); this.line(23, -118, 10, -103, P.ink, 1);
    } else {
      const swing = Math.sin(time * 15) * 0.4;
      leg(-50, 0.2 + swing, false); leg(-25, -0.2, false); leg(24, -0.2 - swing, false); leg(48, 0.2, false);
      c.save(); c.translate(-53, -101); c.rotate(-0.45 + Math.sin(time * 12) * 0.15);
      this.rect(-37, -9, 40, 16, 8, P.mane, P.ink, 2.5); c.restore();
      this.ellipse(-2, -80, 65, 37, P.purple, P.ink, 3);
      c.save(); c.translate(38, -128); c.rotate(0.18); this.rect(-18, -28, 36, 88, 16, P.purple, P.ink, 3); c.restore();
      this.text('♪', -92, -105, 31, P.mane, '500'); this.text('✦', 86, -62, 25, P.mane, '500');
    }
    c.save(); c.translate(human ? -2 : 43, human ? -158 : -165); c.rotate(human ? 0 : 0.17);
    this.rect(-49, -31, 25, 66, 14, P.mane, P.ink, 3);
    if (!human) {
      c.save(); c.translate(-24, -40); c.rotate(-0.3); this.rect(-9, -31, 18, 43, 9, P.purple, P.ink, 3); c.restore();
      c.save(); c.translate(21, -40); c.rotate(0.3); this.rect(-9, -31, 18, 43, 9, P.purple, P.ink, 3); c.restore();
    } else {
      this.ellipse(-36, -2, 10, 8, P.purple, P.ink, 2.5); this.ellipse(34, -2, 10, 8, P.purple, P.ink, 2.5);
    }
    this.rect(-39, -43, 80, 83, 29, P.purple, P.ink, 3);
    this.ellipse(-14, -14, 13, 16, '#f8f5e8', P.ink, 2);
    this.ellipse(16, -18, 13, 16, '#f8f5e8', P.ink, 2);
    this.ellipse(human ? -14 : -9, human ? -13 : -8, 3.5, 5, P.ink);
    this.ellipse(human ? 16 : 21, human ? -17 : -12, 3.5, 5, P.ink);
    this.rect(human ? -27 : -15, 8, human ? 57 : 69, 37, 16, P.cream, P.ink, 3);
    this.ellipse(human ? -11 : 13, 22, 2.5, 3.5, '#514a42'); this.ellipse(human ? 13 : 37, 22, 2.5, 3.5, '#514a42');
    c.beginPath(); c.moveTo(-8, 36); c.quadraticCurveTo(12, 49, 29, 36); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
    if (human) { this.rect(-31, -29, 32, 26, 6, null, P.ink, 1.5); this.rect(3, -32, 31, 26, 6, null, P.ink, 1.5); this.line(1, -18, 4, -18, P.ink, 2); }
    c.restore(); c.restore();
  }

  boss(x, y) {
    this.rect(x - 32, y, 64, 74, 25, '#f0b883', P.ink, 2);
    this.rect(x - 33, y - 1, 66, 25, 12, '#383034');
    this.ellipse(x - 12, y + 37, 3, 4, P.ink); this.ellipse(x + 13, y + 37, 3, 4, P.ink);
    this.line(x - 8, y + 53, x + 8, y + 53, P.ink, 2);
    this.rect(x - 45, y + 65, 90, 110, 20, '#65777e');
    this.rect(x - 20, y - 24, 40, 17, 4, P.paper);
    this.text('老板', x, y - 12, 10, P.ink, '400', 'center');
  }

  scene(g, time, shake) {
    const c = this.ctx; const x = 18, y = 219, w = 339, h = this.layout.stageH;
    c.save(); c.translate(shake ? Math.sin(time * 80) * 3 : 0, 0);
    this.rect(x, y, w, h, 12, P.wall, P.ink, 2);
    // 场景内部裁切，门板不会穿出外框。
    this.rect(x + 1, y + 1, w - 2, h - 2, 11); c.clip();
    const dy = y + 34, dh = h - 64, doorX = x + 39, doorW = w - 78;
    this.rect(doorX, dy, doorW, dh, 0, '#ead9ab');
    this.boss(187.5, y + 69);
    let open = 0;
    if (g.phase === 'opening') open = g.phaseProgress;
    else if (g.phase === 'open') open = 1;
    else if (g.phase === 'closing') open = 1 - g.phaseProgress;
    open = open * open * (3 - 2 * open);
    c.save(); this.rect(doorX, dy, doorW, dh, 0); c.clip();
    const half = doorW / 2;
    for (let side = 0; side < 2; side += 1) {
      const px = doorX + side * half + (side ? 1 : -1) * half * open;
      const grad = c.createLinearGradient(px, 0, px + half, 0);
      grad.addColorStop(0, P.door); grad.addColorStop(0.5, P.wall); grad.addColorStop(1, P.door);
      this.rect(px, dy, half, dh, 0, grad, '#74786f', 1);
    }
    c.restore();
    this.line(doorX, dy, doorX, dy + dh, '#666a61', 3); this.line(doorX + doorW, dy, doorX + doorW, dy + dh, '#666a61', 3);
    this.rect(x, y + h - 30, w, 30, 0, '#adb0a4');
    for (let i = 0; i < 7; i += 1) this.line(x + 48 * i, y + h - 29, x + 48 * i + 10, y + h, '#8c9287', 1);
    const warning = g.mode === 'playing' && g.phase === 'warning';
    const danger = ['opening', 'open', 'closing'].indexOf(g.phase) >= 0;
    this.rect(x, y, w, 34, 0, warning ? (Math.sin(time * 20) > 0 ? '#ad5541' : '#7c3e35') : danger ? '#743c37' : P.ink);
    this.text('↑  ' + String(g.cycle + 6).padStart(2, '0') + ' F', x + 13, y + 23, 16, '#e2f28e', '500');
    const state = warning ? '叮！即将开门' : g.phase === 'closing' ? '门关好再松手' : danger ? '老板正在看你' : '无人围观';
    this.text(state, x + w - 13, y + 22, 11, '#e2f28e', '500', 'right');
    c.save(); c.translate(x + 30, y + 73); c.rotate(-0.09);
    this.rect(-25, -16, 58, 38, 0, '#f0ede2'); this.text('禁止在电梯内', 4, -2, 8, '#625f50', '400', 'center'); this.text('恢复出厂设置', 4, 12, 8, '#625f50', '400', 'center'); c.restore();
    c.save(); c.translate(x + w - 25, y + 129); c.rotate(0.08);
    this.rect(-21, -20, 43, 42, 0, '#ddd5b6', '#8b897d', 1); this.text('今日也要', 0, -4, 9, '#635f56', '400', 'center'); this.text('马到成功', 0, 11, 9, '#635f56', '400', 'center'); c.restore();
    this.rect(x + w - 23, y + h - 121, 12, 44, 5, '#8d9188', '#666a61', 1); this.text('↑', x + w - 17, y + h - 100, 10, '#e9edc9', '400', 'center');
    const size = Math.min(1.03, (h - 73) / 255);
    this.horse(187.5, y + h - 27, g.holding, time, size);
    const bubble = g.mode === 'intro' ? '你的精神状态，老板知道吗？' : g.speech;
    c.font = '12px ' + FONT; const bw = clamp(c.measureText(bubble).width + 24, 160, 255);
    this.rect(187.5 - bw / 2 + 2, y + 48, bw, 33, 9, '#29282f20');
    this.rect(187.5 - bw / 2, y + 45, bw, 33, 9, P.paper, P.ink, 2);
    c.beginPath(); c.moveTo(181, y + 78); c.lineTo(187, y + 85); c.lineTo(193, y + 78); c.fillStyle = P.paper; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
    this.fitText(bubble, 187.5, y + 66, bw - 16, 12, P.ink, '500', 'center');
    this.text(Array.from({ length: 3 }, (_, i) => i < g.lives ? '●' : '○').join(' '), x + 13, y + h - 9, 11, P.ink, '400');
    this.text(g.holding ? '人模人样' : '发疯 ×' + g.multiplier.toFixed(2), x + w - 12, y + h - 9, 10, P.ink, '400', 'right');
    c.restore();
  }

  overlay(g, app) {
    const y = 219, h = this.layout.stageH;
    this.rect(20, y + 2, 335, h - 4, 10, P.paper);
    if (g.mode === 'paused') {
      this.text('先喘口气，马也需要休息', 187.5, y + 64, 12, P.muted, '400', 'center');
      this.text('游戏已暂停', 187.5, y + 112, 28, P.ink, '800', 'center');
      this.text('进度保留，回来后有 1 秒反应时间。', 187.5, y + 148, 11, P.muted, '400', 'center');
      this.button('resume', '继续装人  ↗', 52, y + 181, 271, 51);
      return;
    }
    this.text(app.newBest ? '本机新纪录 / 精神鉴定' : '本次精神鉴定', 187.5, y + 37, 10, P.muted, '400', 'center');
    this.fitText(g.title, 187.5, y + 77, 299, 25, P.ink, '800', 'center');
    this.text(String(Math.floor(g.score)), 187.5, y + 142, 56, P.ink, '800', 'center');
    this.text('发疯值', 187.5, y + 166, 11, P.muted, '400', 'center');
    this.fitText(g.resultCopy, 187.5, y + 195, 300, 12, P.muted, '400', 'center');
    this.text('本机最佳 ' + app.best + '  ·  极限装人 ' + g.nearCount + ' 次', 187.5, y + 218, 11, P.muted, '400', 'center');
    this.button('share', '挑战好友', 42, y + 239, 140, 43, { flat: true, fill: P.lime, size: 14 });
    this.button('copy', '复制战绩', 193, y + 239, 140, 43, { flat: true, fill: P.paper, size: 14 });
  }

  render(g, app, timestamp) {
    const c = this.ctx, L = this.layout, time = timestamp / 1000;
    this.hits = [];
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = P.paper; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(L.x, L.y); c.scale(L.scale, L.scale);
    this.text('摸鱼宇宙 / 电梯分部', 19, 24, 10, P.muted, '500');
    if (g.mode === 'playing') {
      this.button('pause', '暂停', 270, 3, 40, 34, { flat: true, fill: P.paper, size: 11 });
    }
    this.button('sound', app.muted ? '音效关' : '音效开', 316, 3, 43, 34, { flat: true, fill: P.paper, size: 10 });
    this.text('PLEASE ACT NORMAL.', 19, 52, 10, P.muted, '500');
    this.text('电梯里禁止', 17, 91, 33, P.ink, '900');
    this.text('变成', 17, 129, 33, P.ink, '900');
    c.save(); c.translate(105, 113); c.rotate(-0.1); this.rect(-18, -20, 42, 40, 1, P.lime); this.text('马', 3, 12, 33, P.ink, '900', 'center'); c.restore();
    c.save(); c.translate(310, 106); c.rotate(0.25); this.ellipse(0, 0, 29, 29, null, P.red, 1.8); this.text('忍住！', 2, 6, 16, P.red, '500', 'center'); c.restore();
    this.text('门开做人 · 门关做马', 19, 151, 12, P.muted, '400');
    this.line(18, 165, 357, 165, P.line, 1);
    this.text('发疯值', 19, 183, 10, P.muted); this.text(String(Math.floor(g.score)).padStart(4, '0'), 18, 209, 27, P.ink, '500');
    this.text('本机最佳', 142, 183, 10, P.muted); this.text(app.best ? String(app.best) : '—', 142, 206, 19, P.ink, '500');
    this.text('剩余时间', 356, 183, 10, P.muted, '400', 'right'); this.text(Math.ceil(g.remaining) + 's', 356, 209, 26, P.ink, '500', 'right');
    this.scene(g, time, app.hitUntil > timestamp);
    if (g.mode === 'result' || g.mode === 'paused') this.overlay(g, app);
    const end = 219 + L.stageH;
    this.text('装人体力', 19, end + 23, 10, P.muted);
    this.rect(81, end + 16, 225, 5, 3, P.line);
    const energyW = 225 * g.energy / 100;
    if (energyW > 0) this.rect(81, end + 16, energyW, 5, 3, g.energy < 25 ? P.red : P.ink);
    this.text(Math.round(g.energy) + '%', 356, end + 24, 10, P.ink, '500', 'right');
    if (g.mode === 'intro') this.button('start', '进入电梯  ↗', 18, end + 43, 339, 66, { sub: '30 秒 / 单指操作 / 被看见 3 次就暴露' });
    else if (g.mode === 'result') this.button('restart', '再发一次疯  ↗', 18, end + 43, 339, 66, { sub: '这一次，你能比刚才更像个人吗？' });
    else if (g.mode === 'paused') this.button('resume', '继续游戏  ↗', 18, end + 43, 339, 66, { sub: '返回后记得重新按住装人' });
    else this.button('hold', g.holding ? '正在装人' : '按住装人', 18, end + 43, 339, 66, { pressed: g.holding, fill: g.holding ? '#ddd6ed' : P.lime, sub: g.holding ? '体力消耗中 · 等门关好再松手' : '松手做马 · 越晚收手奖励越高' });
    this.fitText(g.mode === 'intro' ? '听到叮就按住，门关好再松手。一直装人会累！' : '提前收手保命，极限收手加分。', 19, end + 137, 335, 10, P.muted);
    if (app.toastUntil > timestamp) {
      this.rect(37, end - 56, 301, 39, 10, '#29282ff2');
      this.fitText(app.toastText, 187.5, end - 31, 277, 12, P.paper, '500', 'center');
    }
    c.restore();
  }
}

module.exports = Renderer;
