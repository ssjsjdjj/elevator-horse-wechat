'use strict';

const Engine = require('./engine');
const Renderer = require('./renderer');
const Audio = require('./audio');
const C = require('./config');

class Application {
  constructor(api, runtime) {
    this.api = api;
    const rt = runtime || {};
    this.now = rt.now || Date.now;
    this.schedule = rt.requestFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : cb => setTimeout(cb, 16));
    this.cancel = rt.cancelFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout);
    this.hidden = false;
    this.touchId = null;
    this.touchAction = null;
    this.best = 0;
    this.newBest = false;
    this.muted = false;
    this.toastUntil = 0;
    this.toastText = '';
    this.hitUntil = 0;
    this.nearStarted = -Infinity;
    this.nearUntil = 0;
    this.poseStarted = -Infinity;
    this.frameId = null;
    this.lastTime = this.now();
    this.loadRecord();
    this.engine = new Engine({ onEvent: event => this.onGameEvent(event) });
    this.audio = new Audio(api, this.muted);
    this.canvas = api.createCanvas();
    this.renderer = new Renderer(this.canvas);
  }

  loadRecord() {
    try {
      const record = this.api.getStorageSync(C.storageKey);
      if (record && Number.isFinite(record.best) && record.best >= 0) this.best = Math.floor(record.best);
      if (record && typeof record.muted === 'boolean') this.muted = record.muted;
    } catch (e) { /* 首次安装或存储不可用不阻塞启动。 */ }
  }

  saveRecord() {
    try {
      this.api.setStorageSync(C.storageKey, { version: C.version, best: this.best, muted: this.muted });
    } catch (e) { this.toast('本次纪录未能保存，请检查本地存储。'); }
  }

  resize() {
    let info = {};
    let menu = null;
    try {
      info = typeof this.api.getWindowInfo === 'function' ? this.api.getWindowInfo() : this.api.getSystemInfoSync();
    } catch (e) {
      info = this.api.getSystemInfoSync();
    }
    try { if (typeof this.api.getMenuButtonBoundingClientRect === 'function') menu = this.api.getMenuButtonBoundingClientRect(); } catch (e) {}
    this.renderer.resize(info, menu);
  }

  boot() {
    this.resize();
    this.api.onTouchStart(event => this.touchStart(event));
    this.api.onTouchMove(event => this.touchMove(event));
    this.api.onTouchEnd(event => this.touchEnd(event));
    this.api.onTouchCancel(event => this.touchCancel(event));
    this.api.onHide(() => {
      this.hidden = true;
      this.engine.pause();
      this.clearTouch();
      this.audio.stop();
      if (this.frameId !== null) this.cancel(this.frameId);
      this.frameId = null;
    });
    this.api.onShow(() => {
      if (!this.hidden) return;
      this.hidden = false;
      this.resize();
      this.lastTime = this.now();
      this.tick();
    });
    if (typeof this.api.onWindowResize === 'function') this.api.onWindowResize(() => {
      this.engine.pause(); this.clearTouch(); this.resize();
    });
    try {
      if (typeof this.api.showShareMenu === 'function') this.api.showShareMenu({ menus: ['shareAppMessage'] });
      if (typeof this.api.onShareAppMessage === 'function') this.api.onShareAppMessage(() => this.shareData());
      if (typeof this.api.getLaunchOptionsSync === 'function') {
        const options = this.api.getLaunchOptionsSync();
        const target = Number(options.query && options.query.score);
        if (Number.isFinite(target) && target > 0 && target <= 1000000) this.toast('好友挑战：超过 ' + Math.floor(target) + ' 分！', 4000);
      }
    } catch (e) { /* 游客模式可能不提供分享能力。 */ }
    this.lastTime = this.now();
    this.tick();
    return this;
  }

  tick() {
    if (this.hidden) return;
    const now = this.now();
    const dt = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    // 长时间卡顿时暂停；不会让一帧跨过预警，直接扣掉生命。
    if (dt > 0.5 && this.engine.mode === 'playing') {
      this.engine.pause(); this.clearTouch();
      this.toast('刚才有些卡顿，已为你暂停。');
    } else this.engine.update(dt);
    this.renderer.render(this.engine, this, now);
    this.frameId = this.schedule(() => this.tick());
  }

  onGameEvent(event) {
    if (event.type === 'start') {
      this.newBest = false;
      this.nearUntil = 0;
      this.hitUntil = 0;
      this.toastUntil = 0;
      this.poseStarted = -Infinity;
    }
    if (event.type === 'pose') this.poseStarted = this.now();
    if (event.type === 'caught') {
      this.hitUntil = this.now() + 420;
      this.audio.play('caught');
      this.vibrate();
    }
    if (event.type === 'near') {
      this.nearStarted = this.now();
      this.nearUntil = this.nearStarted + 950;
      this.vibrate();
    }
    if (event.type === 'stage') this.toast(event.label + ' · ' + this.engine.stage.hint, 2000);
    if (event.type === 'warning' || event.type === 'near') this.audio.play(event.type);
    if (event.type === 'pause') { this.audio.stop(); this.nearUntil = 0; this.hitUntil = 0; }
    if (event.type === 'finish') {
      this.newBest = event.score > this.best;
      this.best = Math.max(this.best, event.score);
      this.saveRecord();
      this.audio.play('finish');
    }
  }

  vibrate() {
    if (!this.muted && typeof this.api.vibrateShort === 'function') {
      try { this.api.vibrateShort({ type: 'light', fail: function () {} }); } catch (e) {}
    }
  }

  toast(text, duration) {
    this.toastText = text;
    this.toastUntil = this.now() + (duration || 2200);
  }

  findTouch(event) {
    const touches = event.changedTouches || [];
    for (let i = 0; i < touches.length; i += 1) {
      if (touches[i].identifier === this.touchId) return touches[i];
    }
    return null;
  }

  touchStart(event) {
    if (this.touchId !== null || this.hidden) return;
    const touch = (event.changedTouches || [])[0];
    if (!touch) return;
    const action = this.renderer.hitAt(this.renderer.point(touch));
    if (!action) return;
    this.touchId = touch.identifier;
    this.touchAction = action;
    if (action === 'hold') this.engine.setHolding(true);
  }

  touchMove(event) {
    const touch = this.findTouch(event);
    if (!touch || this.touchAction !== 'hold') return;
    const hit = this.renderer.hitAt(this.renderer.point(touch));
    // 场景、体力条和主按钮连成连续操作区；滑出操作区或取消时释放。
    if (hit !== 'hold') this.clearTouch();
  }

  touchEnd(event) {
    const touch = this.findTouch(event);
    if (!touch) return;
    const action = this.touchAction;
    const hit = this.renderer.hitAt(this.renderer.point(touch));
    this.clearTouch();
    if (action && action !== 'hold' && hit === action) this.act(action);
  }

  touchCancel(event) {
    if (!(event.changedTouches || []).length || this.findTouch(event)) this.clearTouch();
  }

  clearTouch() {
    this.touchId = null;
    this.touchAction = null;
    this.engine.setHolding(false);
  }

  act(action) {
    if (action === 'start' || action === 'restart') {
      this.engine.start();
      this.lastTime = this.now();
    } else if (action === 'pause') this.engine.pause();
    else if (action === 'resume') { this.engine.resume(); this.lastTime = this.now(); }
    else if (action === 'sound') {
      this.muted = !this.muted;
      this.audio.muted = this.muted;
      if (this.muted) this.audio.stop();
      this.saveRecord();
    } else if (action === 'share') {
      try {
        if (typeof this.api.shareAppMessage !== 'function') { this.toast('请使用右上角菜单分享，或复制战绩。'); return; }
        this.api.shareAppMessage(this.shareData());
      } catch (e) { this.toast('当前环境暂不支持分享，可以复制战绩。'); }
    } else if (action === 'copy') {
      const message = '我在《电梯里禁止变成马》疯了 ' + Math.floor(this.engine.score) +
        ' 分，极限装人 ' + this.engine.nearCount + ' 次。你能比我更像个人吗？';
      if (typeof this.api.setClipboardData !== 'function') { this.toast('本局得分 ' + Math.floor(this.engine.score)); return; }
      this.api.setClipboardData({ data: message, success: () => this.toast('战绩已复制，去挑战好友吧。'), fail: () => this.toast('未能复制，请重试。') });
    }
    // 点击后的第一帧立即刷新命中区域，避免快速连点沿用旧场景。
    this.renderer.render(this.engine, this, this.now());
  }

  shareData() {
    const score = Math.floor(this.engine.score);
    return {
      title: score > 0 ? '我在电梯里疯了' + score + '分！你能比我更像个人吗？' : '电梯里禁止变成马：门开装人，门关发疯！',
      query: 'score=' + score
    };
  }
}

module.exports = Application;
