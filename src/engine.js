'use strict';

const C = require('./config');
const LINES = [
  '没人？那我不装了。', '工牌一摘，谁也不爱。',
  '这层楼，归本马管。', '月薪三千，马力无限。',
  '电梯很小，精神很大。'
];
const EPSILON = 1e-8;

// 纯逻辑层：没有 wx、DOM、定时器或绘图依赖，可用 Node 验证规则。
class Engine {
  constructor(options) {
    const opts = options || {};
    this.random = opts.random || Math.random;
    this.onEvent = opts.onEvent || function () {};
    this.mode = 'intro';
    this.score = 0;
    this.elapsed = 0;
    this.energy = C.maxEnergy;
    this.lives = C.maxLives;
    this.holding = false;
    this.phase = 'closed';
    this.phaseTime = 0;
    this.phaseDuration = 3;
    this.cycle = 1;
    this.combo = 0;
    this.nearCount = 0;
    this.caughtThisCycle = false;
    this.nearThisCycle = false;
    this.message = LINES[0];
    this.messageUntil = 0;
    this.reason = '';
    this.resumeGrace = 0;
    this.notifiedStage = 'warmup';
  }

  emit(type, detail) {
    this.onEvent(Object.assign({ type: type }, detail || {}));
  }

  start() {
    this.mode = 'playing';
    this.score = 0;
    this.elapsed = 0;
    this.energy = C.maxEnergy;
    this.lives = C.maxLives;
    this.holding = false;
    this.cycle = 0;
    this.combo = 0;
    this.nearCount = 0;
    this.reason = '';
    this.resumeGrace = 0;
    this.messageUntil = 0;
    this.notifiedStage = 'warmup';
    this.enterPhase('closed');
    this.emit('start');
  }

  get remaining() { return Math.max(0, C.duration - this.elapsed); }
  get multiplier() { return 1 + Math.min(this.combo, 4) * 0.25; }
  get stage() {
    for (let i = C.stages.length - 1; i >= 0; i -= 1) {
      if (this.elapsed + EPSILON >= C.stages[i].start) return C.stages[i];
    }
    return C.stages[0];
  }
  get phaseProgress() { return Math.min(1, this.phaseTime / this.phaseDuration); }
  get danger() {
    return (this.phase === 'opening' && this.phaseTime >= C.reactionGrace) ||
      this.phase === 'open' || this.phase === 'closing';
  }

  setHolding(value) {
    if (this.mode !== 'playing') return;
    const next = Boolean(value);
    if (next === this.holding) return;
    this.holding = next;
    if (next && this.phase === 'warning' &&
        this.phaseDuration - this.phaseTime <= C.nearWindow + EPSILON &&
        !this.nearThisCycle && !this.caughtThisCycle) {
      this.nearThisCycle = true;
      this.nearCount += 1;
      this.score += C.nearBonus;
      this.say('差点失去人籍！ +60', 1);
      this.emit('near');
    }
    this.emit('pose', { human: next });
  }

  say(text, duration) {
    this.message = text;
    this.messageUntil = this.elapsed + duration;
  }

  enterPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    if (phase === 'closed') {
      this.cycle += 1;
      this.caughtThisCycle = false;
      this.nearThisCycle = false;
      const range = this.stage.closed;
      this.phaseDuration = this.cycle === 1 ? 3 : range[0] + this.random() * (range[1] - range[0]);
    } else if (phase === 'warning') {
      this.phaseDuration = C.warningDuration;
      this.say('叮！有脚步声，快装人！', C.warningDuration);
      this.emit('warning');
    } else if (phase === 'opening') {
      this.phaseDuration = C.openingDuration;
      this.emit('door');
    } else if (phase === 'open') {
      const range = this.stage.open;
      this.phaseDuration = range[0] + this.random() * (range[1] - range[0]);
    } else {
      this.phaseDuration = C.closingDuration;
    }
  }

  advancePhase() {
    if (this.phase === 'closed') this.enterPhase('warning');
    else if (this.phase === 'warning') this.enterPhase('opening');
    else if (this.phase === 'opening') this.enterPhase('open');
    else if (this.phase === 'open') this.enterPhase('closing');
    else {
      if (!this.caughtThisCycle) {
        this.combo += 1;
        this.score += C.perfectBonus;
        this.say('完美伪装！ +30', 0.85);
        this.emit('perfect');
      }
      this.enterPhase('closed');
    }
  }

  catchHorse() {
    if (this.caughtThisCycle) return;
    this.caughtThisCycle = true;
    this.lives -= 1;
    this.combo = 0;
    this.say(this.lives === 2 ? '糟糕！马脚露出来了。' : '老板：你最好真的是人。', 1.3);
    this.emit('caught', { lives: this.lives });
    if (this.lives === 0) this.finish('caught');
  }

  // 分割到相位边界，不会因卡顿跨过开门判定。暂停时不推进逻辑。
  update(seconds) {
    if (this.mode !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
    let left = Math.min(seconds, C.duration);
    while (left > EPSILON && this.mode === 'playing') {
      const dt = Math.min(left, 1 / 120, this.phaseDuration - this.phaseTime, this.remaining);
      if (dt <= EPSILON) {
        if (this.remaining <= EPSILON) { this.finish('complete'); break; }
        this.advancePhase();
        continue;
      }
      const safeAtStart = this.resumeGrace > 0;
      this.elapsed += dt;
      this.phaseTime += dt;
      if (this.stage.id !== this.notifiedStage) {
        this.notifiedStage = this.stage.id;
        this.emit('stage', { stage: this.stage.id, label: this.stage.label });
      }
      this.resumeGrace = Math.max(0, this.resumeGrace - dt);
      if (this.holding) {
        this.energy = Math.max(0, this.energy - C.energyDrain * dt);
        if (this.energy <= EPSILON) { this.finish('tired'); break; }
      } else {
        this.energy = Math.min(C.maxEnergy, this.energy + C.energyRecover * dt);
        if (this.phase === 'closed' || this.phase === 'warning') {
          this.score += C.baseScore * this.multiplier * dt;
        }
      }
      if (this.danger && !this.holding && !safeAtStart) this.catchHorse();
      if (this.mode !== 'playing') break;
      left -= dt;
      if (this.remaining <= EPSILON) this.finish('complete');
      else if (this.phaseTime >= this.phaseDuration - EPSILON) this.advancePhase();
    }
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.holding = false;
    this.emit('pause');
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.holding = false;
    // 返回后留出重新按住的时间，避免松手状态直接判输。
    this.resumeGrace = 1;
    this.say('回来了！给你 1 秒装人。', 1);
    this.emit('resume');
  }

  finish(reason) {
    if (this.mode !== 'playing') return;
    this.mode = 'result';
    this.reason = reason;
    if (reason === 'complete') this.elapsed = C.duration;
    this.score = Math.floor(this.score + EPSILON);
    this.holding = false;
    this.emit('finish', { score: this.score, reason: reason });
  }

  get speech() {
    if (this.messageUntil > this.elapsed) return this.message;
    if (this.phase === 'closed') return this.holding ? '领导放心，我情绪很稳定。' : LINES[(this.cycle - 1) % LINES.length];
    if (this.phase === 'warning') return '叮！有脚步声，快装人！';
    if (this.phase === 'closing') return '等门关好，再做马。';
    return this.caughtThisCycle ? '老板：刚才是不是有匹马？' : '领导好，我很稳定。';
  }

  get title() {
    if (this.reason === 'tired') return '装人太久，累瘫了';
    if (this.reason === 'caught') return '工牌还在，马甲没了';
    if (this.score >= 1100) return '人前员工，人后马王';
    if (this.score >= 700) return '半人半马，班味不大';
    return '初入马场，未来可期';
  }

  get resultCopy() {
    if (this.reason === 'tired') return '门关时松手做马，才能恢复体力。';
    if (this.reason === 'caught') return '被看见 3 次了。下次叮一响就收手！';
    return '存活 30 秒 · 极限装人 ' + this.nearCount + ' 次';
  }
}

module.exports = Engine;
