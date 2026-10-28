'use strict';

// 微信小游戏入口。第一个 wx.createCanvas() 是上屏画布。
const Application = require('./src/application');
new Application(wx).boot();
