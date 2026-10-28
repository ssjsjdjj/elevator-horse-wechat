'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Application = require('../src/application');

function setup(options) {
  const opts = options || {}; const callbacks = {}; const storage = {};
  let time = 1000; let scheduled = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (o, key) => {
    if (key === 'measureText') return t => ({ width: t.length * 7 });
    if (key === 'createLinearGradient') return () => gradient;
    return o[key] || (() => {});
  }, set: (o, key, value) => { o[key] = value; return true; } });
  const api = {
    createCanvas: () => ({ getContext: () => ctx }),
    getWindowInfo: () => ({ windowWidth: opts.width || 375, windowHeight: opts.height || 812, pixelRatio: 3, safeArea: { top: 44, bottom: 778 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 76 }),
    getStorageSync: () => opts.record || '', setStorageSync: (key, value) => { storage[key] = value; },
    onTouchStart: fn => { callbacks.start = fn; }, onTouchMove: fn => { callbacks.move = fn; },
    onTouchEnd: fn => { callbacks.end = fn; }, onTouchCancel: fn => { callbacks.cancel = fn; },
    onHide: fn => { callbacks.hide = fn; }, onShow: fn => { callbacks.show = fn; },
    onWindowResize: fn => { callbacks.resize = fn; },
    getLaunchOptionsSync: () => ({ query: {} }),
    setClipboardData: opts => { storage.clipboard = opts.data; opts.success(); },
    shareAppMessage: opts => { storage.share = opts; }
  };
  const app = new Application(api, { now: () => time, requestFrame: () => ++scheduled, cancelFrame() {} }).boot();
  const touch = (id, action) => {
    const hit = app.renderer.hits.find(h => h.id === action); assert.ok(hit, 'Missing hit area ' + action);
    const L = app.renderer.layout;
    return { identifier: id, clientX: L.x + (hit.x + hit.w / 2) * L.scale, clientY: L.y + (hit.y + hit.h / 2) * L.scale };
  };
  return { app, api, callbacks, storage, touch, advance: ms => { time += ms; app.tick(); } };
}

test('首次启动可绘制，点击开始后出现操作按钮', () => {
  const f = setup(); const p = f.touch(7, 'start');
  f.callbacks.start({ changedTouches: [p] }); f.callbacks.end({ changedTouches: [p] });
  assert.equal(f.app.engine.mode, 'playing'); assert.ok(f.touch(7, 'hold'));
});

test('多点触摸不接管主手指，取消事件会释放装人', () => {
  const f = setup(); f.app.act('start');
  const one = f.touch(1, 'hold'), two = f.touch(2, 'hold');
  f.callbacks.start({ changedTouches: [one] }); assert.equal(f.app.engine.holding, true);
  f.callbacks.start({ changedTouches: [two] }); f.callbacks.end({ changedTouches: [two] });
  assert.equal(f.app.engine.holding, true);
  f.callbacks.cancel({ changedTouches: [one] }); assert.equal(f.app.engine.holding, false);
  assert.equal(f.app.touchId, null);
});

test('后台冻结回合，返回保持暂停，恢复后不推进后台时间', () => {
  const f = setup(); f.app.act('start'); f.advance(100);
  const before = f.app.engine.elapsed; f.callbacks.hide(); f.advance(120000);
  assert.equal(f.app.engine.elapsed, before); f.callbacks.show();
  assert.equal(f.app.engine.mode, 'paused'); assert.equal(f.app.engine.elapsed, before);
  f.app.act('resume'); f.advance(16); assert.ok(f.app.engine.elapsed - before < 0.02);
});

test('前台长卡顿会主动暂停，避免直接暴露', () => {
  const f = setup(); f.app.act('start'); f.advance(1000);
  assert.equal(f.app.engine.mode, 'paused'); assert.equal(f.app.engine.lives, 3);
});

test('读取本地纪录，结束后持久化新纪录；分享和文案使用真实得分', () => {
  const f = setup({ record: { best: 10, muted: true } });
  assert.equal(f.app.best, 10); assert.equal(f.app.muted, true);
  f.app.act('start'); f.app.engine.score = 246; f.app.engine.finish('complete');
  assert.equal(f.app.best, 246);
  assert.equal(f.storage['elevator-horse-record-v1'].best, 246);
  f.app.act('copy'); assert.match(f.storage.clipboard, /246/);
  f.app.act('share'); assert.equal(f.storage.share.query, 'score=246');
});

test('320px、窄矮屏与大屏下，触控映射和安全区域一致', () => {
  for (const [width, height] of [[320,568],[375,667],[390,844],[430,932],[812,375]]) {
    const f = setup({ width, height }); const r = f.app.renderer; const L = r.layout;
    assert.ok(L.x >= -1e-6); assert.ok(L.y >= 76);
    assert.ok(L.y + L.height * L.scale <= height + 1e-6);
    assert.equal(r.hitAt(r.point(f.touch(3, 'start'))), 'start');
    for (const hit of r.hits) {
      assert.ok(hit.x >= 0 && hit.x + hit.w <= 375);
      assert.ok(hit.y >= 0 && hit.y + hit.h <= L.height);
    }
  }
});

test('损坏的历史纪录不传播非法分数', () => {
  assert.equal(setup({ record: { best: Infinity } }).app.best, 0);
  assert.equal(setup({ record: { best: -123 } }).app.best, 0);
});
