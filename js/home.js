/* ============================================================
   主页逻辑：
   1) 根据 js/games-data.js 渲染"游戏文件夹"
   2) 搜索框：输入游戏名 → 下拉结果 → 点击直接进入游戏
   3) 状态栏时钟、点击音效

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

  /* ---------- 2. 渲染游戏"文件夹"（数据来自 games-data.js） ---------- */
  const listEl = document.getElementById('game-list');
  const countEl = document.getElementById('game-count');
  const games = window.GAMES || [];

  const frag = document.createDocumentFragment();
  games.forEach((g) => {
    const el = document.createElement(g.available ? 'a' : 'div');
    el.className = 'folder' + (g.available ? '' : ' disabled');
    if (g.available) {
      el.href = g.url;
      el.addEventListener('click', clickSound);
    }
    el.innerHTML =
      '<span class="folder-icon"><span class="folder-inner">' + g.icon + '</span></span>' +
      '<span class="folder-name">' + g.name + '</span>' +
      '<span class="folder-en">' + g.en + '</span>';
    frag.appendChild(el);
  });
  listEl.appendChild(frag);
  if (countEl) countEl.textContent = '共 ' + games.length + ' 个对象';

  /* ---------- 3. 游戏搜索：输入 → 实时下拉结果 → 点击跳转 ---------- */
  const searchInput = document.getElementById('game-search');
  const searchDrop = document.getElementById('search-drop');
  const searchGo = document.getElementById('search-go');

  // 按关键字过滤游戏（支持中文名 / 英文名 / id）
  function matchGames(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return games.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.en.toLowerCase().includes(q) ||
      (g.id && g.id.toLowerCase().includes(q))
    );
  }

  // 渲染下拉结果
  function renderResults(query) {
    searchDrop.innerHTML = '';
    const results = matchGames(query);

    if (!results.length) {
      searchDrop.innerHTML = '<div class="search-empty">没有找到匹配的游戏</div>';
      searchDrop.hidden = false;
      return;
    }

    const frag2 = document.createDocumentFragment();
    results.forEach((g) => {
      const item = document.createElement('div');
      item.className = 'search-item' + (g.available ? '' : ' disabled');
      item.innerHTML =
        '<span class="si-icon">' + g.icon + '</span>' +
        '<span><b>' + g.name + '</b><small>' + g.en + '</small></span>';
      item.addEventListener('click', () => {
        clickSound();
        if (g.available) location.href = g.url; // 点击直接进入游戏
      });
      frag2.appendChild(item);
    });
    searchDrop.appendChild(frag2);
    searchDrop.hidden = false;
  }

  function hideResults() {
    searchDrop.hidden = true;
    searchDrop.innerHTML = '';
  }

  // 输入时实时搜索
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    q ? renderResults(q) : hideResults();
  });

  // 回车：直接打开第一个可玩的匹配游戏
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = matchGames(searchInput.value)[0];
      if (first && first.available) location.href = first.url;
      else if (first && !first.available) clickSound();
    }
  });

  // "搜索"按钮：与回车行为一致
  searchGo.addEventListener('click', () => {
    clickSound();
    const first = matchGames(searchInput.value)[0];
    if (first && first.available) location.href = first.url;
  });

  // 点击页面其他地方：关闭下拉
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.toolbar')) hideResults();
  });

  /* ---------- 4. 状态栏时钟 ---------- */
  const clock = document.getElementById('clock');
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  tick();
  setInterval(tick, 10000);
})();