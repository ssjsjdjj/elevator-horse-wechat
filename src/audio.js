'use strict';

// 内置短音效，无网络资源。音效失败不影响游戏。
class Audio {
  constructor(api, muted) {
    this.api = api;
    this.muted = muted;
    this.players = {};
    ['warning', 'caught', 'near', 'finish'].forEach(name => {
      if (typeof api.createInnerAudioContext !== 'function') return;
      try {
        const player = api.createInnerAudioContext();
        player.src = 'assets/audio/' + name + '.wav';
        player.volume = name === 'caught' ? 0.35 : 0.5;
        player.onError(function () {});
        this.players[name] = player;
      } catch (e) { /* 平台不支持时保持静音。 */ }
    });
  }
  play(name) {
    if (this.muted || !this.players[name]) return;
    try { this.players[name].stop(); this.players[name].play(); } catch (e) { /* 无音频也可玩。 */ }
  }
  stop() {
    Object.keys(this.players).forEach(name => { try { this.players[name].stop(); } catch (e) {} });
  }
}

module.exports = Audio;
