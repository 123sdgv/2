/* ============================================================
   主页逻辑：根据 js/games-data.js 的数据渲染游戏卡片，
   以及任务栏时钟、点击音效。
   以后加新游戏只改 games-data.js，本文件无需改动。
   ============================================================ */
(() => {
  'use strict';

  /* ---------- 1. 轻量点击音效（Web Audio 合成，无外部文件） ---------- */
  let audioCtx = null;
  function clickSound() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 720;
      g.gain.setValueAtTime(0.03, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.05);
    } catch (e) { /* 不支持音频时静默忽略 */ }
  }

  /* ---------- 2. 渲染游戏卡片（数据来自 games-data.js） ---------- */
  const listEl = document.getElementById('game-list');
  const countEl = document.getElementById('game-count');
  const games = window.GAMES || [];

  let availableCount = 0;
  const frag = document.createDocumentFragment();

  games.forEach((g) => {
    // 可玩的游戏生成 <a> 链接；未上线的生成灰色禁用卡片
    const card = document.createElement(g.available ? 'a' : 'div');
    card.className = 'game-card' + (g.available ? '' : ' disabled');
    if (g.available) {
      card.href = g.url;
      card.addEventListener('click', clickSound);
      availableCount++;
    }
    card.innerHTML =
      '<span class="game-icon">' + g.icon + '</span>' +
      '<strong>' + g.name + '</strong>' +
      '<small>' + g.en + '</small>' +
      (g.available ? '<button>开始游戏</button>' : '<em>即将推出</em>');
    frag.appendChild(card);
  });

  listEl.appendChild(frag);
  if (countEl) countEl.textContent = availableCount + ' 个可用游戏';

  /* ---------- 3. 任务栏时钟 ---------- */
  const clock = document.getElementById('clock');
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  tick();
  setInterval(tick, 10000);
})();