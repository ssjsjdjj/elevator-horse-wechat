'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const C = require('../src/config');

function make(events) { return new Engine({ random: () => 0.5, onEvent: e => { if (events) events.push(e); } }); }
function until(g, predicate) {
  for (let n = 0; n < 10000; n += 1) {
    if (predicate(g)) return;
    g.update(1 / 120);
  }
  throw new Error('Condition not reached');
}

test('关闭电梯松手得分，体力不超过100', () => {
  const g = make(); g.start(); g.update(2);
  assert.equal(g.mode, 'playing'); assert.equal(g.phase, 'closed');
  assert.ok(Math.abs(g.score - 76) < 1e-5); assert.equal(g.energy, 100);
});

test('一直按住装人会耗尽体力，无法挂机过关', () => {
  const g = make(); g.start(); g.setHolding(true); g.update(8);
  assert.equal(g.mode, 'result'); assert.equal(g.reason, 'tired'); assert.equal(g.score, 0);
  assert.equal(g.energy, 0); assert.equal(g.lives, 3);
});

test('每轮开门最多扣一次生命，第三次暴露结算', () => {
  const events = []; const g = make(events); g.start();
  until(g, s => s.lives === 2);
  g.update(0.4); assert.equal(g.lives, 2);
  g.update(25);
  assert.equal(g.mode, 'result'); assert.equal(g.reason, 'caught');
  assert.equal(events.filter(e => e.type === 'caught').length, 3);
  assert.equal(events.filter(e => e.type === 'finish').length, 1);
});

test('正确装人可完成完整30秒，获得连击和完美伪装分', () => {
  const events = []; const g = make(events); g.start();
  while (g.mode === 'playing') {
    g.setHolding(g.phase !== 'closed'); g.update(1 / 120);
  }
  assert.equal(g.reason, 'complete'); assert.equal(g.lives, 3);
  assert.ok(Math.abs(g.elapsed - C.duration) < 1e-6);
  assert.equal(g.remaining, 0);
  assert.ok(g.score > 700); assert.ok(events.some(e => e.type === 'perfect'));
  assert.ok(g.energy > 0);
});

test('临近开门的奖励每轮只能拿一次，反复按松不会刷分', () => {
  const events = []; const g = make(events); g.start();
  g.update(3 + 0.6);
  assert.equal(g.phase, 'warning');
  const before = g.score;
  for (let i = 0; i < 20; i += 1) { g.setHolding(true); g.setHolding(false); }
  assert.equal(g.nearCount, 1); assert.ok(Math.abs(g.score - before - C.nearBonus) < 1e-5);
  assert.equal(events.filter(e => e.type === 'near').length, 1);
});

test('开门宽限结束就会检查，关门途中仍需装人', () => {
  const g = make(); g.start();
  until(g, s => s.phase === 'opening');
  g.update(0.1); assert.equal(g.lives, 3);
  g.setHolding(true); until(g, s => s.phase === 'closing');
  g.setHolding(false); g.update(0.02); assert.equal(g.lives, 2);
});

test('暂停冻结倒计时，恢复有1秒重新按住的机会', () => {
  const g = make(); g.start(); g.setHolding(true);
  until(g, s => s.phase === 'open');
  const elapsed = g.elapsed; const energy = g.energy;
  g.pause(); g.update(100);
  assert.equal(g.elapsed, elapsed); assert.equal(g.energy, energy);
  g.resume(); g.update(0.3); assert.equal(g.lives, 3);
  g.setHolding(true); g.update(0.2); assert.equal(g.lives, 3);
});

test('大步进不会跳过危险相位，重开会清空上一局状态', () => {
  const g = make(); g.start(); g.update(30);
  assert.equal(g.reason, 'caught'); assert.equal(g.lives, 0);
  g.start(); assert.equal(g.elapsed, 0); assert.equal(g.score, 0); assert.equal(g.combo, 0);
  assert.equal(g.lives, 3); assert.equal(g.energy, 100); assert.equal(g.cycle, 1);
  assert.equal(g.holding, false); assert.equal(g.nearCount, 0);
});

test('无效时间不改变状态', () => {
  const g = make(); g.start(); [NaN, Infinity, -1, 0].forEach(t => g.update(t));
  assert.equal(g.elapsed, 0); assert.equal(g.score, 0);
});
