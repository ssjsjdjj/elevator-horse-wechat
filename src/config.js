'use strict';

module.exports = {
  duration: 30,
  maxEnergy: 100,
  energyDrain: 22,
  energyRecover: 33,
  baseScore: 38,
  warningDuration: 0.85,
  openingDuration: 0.5,
  closingDuration: 0.5,
  reactionGrace: 0.22,
  nearWindow: 0.36,
  nearBonus: 60,
  perfectBonus: 30,
  maxLives: 3,
  stages: [
    { id: 'warmup', start: 0, label: '熟悉操作', hint: '听到叮就按住，门关好再松手。', closed: [2.8, 3.2], open: [1.3, 1.5] },
    { id: 'rush', start: 8, label: '停靠加速', hint: '停靠更频繁，留意每次开门预警。', closed: [1.8, 2.2], open: [1.05, 1.25] },
    { id: 'inspection', start: 20, label: '老板查岗', hint: '最后 10 秒，稳住你的人设！', closed: [1.45, 1.7], open: [0.85, 1.05] }
  ],
  storageKey: 'elevator-horse-record-v1',
  version: '1.1.0'
};
