(() => {
  'use strict';

  /* ============================================================
     扫雷 · Windows 经典规则
     - 点击翻开 · 右键或插旗模式标记地雷
     - 显示周边雷数，数字颜色与经典版一致
     - 关卡越往后格子越大、雷越多
     - 关卡进度存入 localStorage，下次进入继续
     ============================================================ */

  const board = document.getElementById('board');
  const minesEl = document.getElementById('mines');
  const timeEl = document.getElementById('time');
  const faceBtn = document.getElementById('face');
  const levelEl = document.getElementById('level');
  const flagBtn = document.getElementById('flag-mode');
  const restartBtn = document.getElementById('restart');
  const hint = document.getElementById('hint');
  const win = document.getElementById('win');
  const winDetail = document.getElementById('win-detail');
  const nextBtn = document.getElementById('next');

  const STORE_KEY = 'minesweeper-level';
  const FACE = { ok: '😀', pressed: '😮', win: '😎', lose: '😵' };
  const NUM_COLORS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];

  // 关卡 -> 难度（行、列、雷数），共 8 档封顶
  const TABLE = [
    { rows: 9,  cols: 9,  mines: 10 },
    { rows: 9,  cols: 9,  mines: 13 },
    { rows: 10, cols: 10, mines: 16 },
    { rows: 11, cols: 11, mines: 22 },
    { rows: 12, cols: 12, mines: 28 },
    { rows: 13, cols: 13, mines: 34 },
    { rows: 14, cols: 14, mines: 42 },
    { rows: 15, cols: 15, mines: 50 }
  ];

  // 读取上次进度
  let level = Math.max(1, parseInt(localStorage.getItem(STORE_KEY) || '1', 10) || 1);

  let rows = 9, cols = 9, mineCount = 10;
  let grid = [];            // 每格 {mine, opened, flag, adj}
  let state = 'ready';      // ready | playing | win | lose
  let flags = 0;
  let seconds = 0;
  let timerId = null;
  let flagMode = false;
  let openedCount = 0;

  /* ================= 工具 ================= */
  const idx = (r, c) => r * cols + c;
  const pad3 = n => String(n).padStart(3, '0');

  function configFor(lv) {
    return TABLE[Math.min(lv, TABLE.length) - 1];
  }

  /* ================= 初始化一关 ================= */
  function newLevel(lv) {
    level = lv;
    localStorage.setItem(STORE_KEY, String(level));
    const cfg = configFor(level);
    rows = cfg.rows; cols = cfg.cols; mineCount = cfg.mines;
    state = 'ready';
    flags = 0;
    seconds = 0;
    openedCount = 0;
    if (timerId) clearInterval(timerId);
    timerId = null;
    faceBtn.textContent = FACE.ok;
    flagMode = false;
    flagBtn.classList.remove('on');
    win.hidden = true;

    levelEl.textContent = level;
    minesEl.textContent = pad3(mineCount);
    timeEl.textContent = pad3(0);
    render();
  }

  // 首次点击后铺雷（保证点击位置及其周围无雷）
  function placeMines(safeR, safeC) {
    grid = [];
    const cells = [];
    for (let i = 0; i < rows * cols; i++) cells.push(i);
    // 移除安全区（点击处 + 8 邻域）
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeR + dr, c = safeC + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) safe.add(idx(r, c));
      }
    }
    const candidates = cells.filter(i => !safe.has(i));
    // 洗牌取前 mineCount 个
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const mines = new Set(candidates.slice(0, mineCount));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isMine = mines.has(idx(r, c));
        grid[idx(r, c)] = { mine: isMine, opened: false, flag: false, adj: 0 };
      }
    }
    // 计算周边雷数
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[idx(r, c)].mine) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[idx(rr, cc)].mine) n++;
          }
        }
        grid[idx(r, c)].adj = n;
      }
    }
  }

  /* ================= 渲染 ================= */
  function render() {
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[idx(r, c)];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.r = r;
        btn.dataset.c = c;
        if (cell.opened) {
          btn.classList.add('revealed');
          if (cell.mine) {
            btn.textContent = '💣';
            if (cell.hit) btn.classList.add('mine-hit');
            else if (state === 'lose') btn.classList.add('mine-shown');
          } else if (cell.adj > 0) {
            btn.textContent = cell.adj;
            btn.classList.add(NUM_COLORS[cell.adj]);
          } else {
            btn.classList.add('empty');
          }
        } else if (cell.flag) {
          btn.textContent = '🚩';
        }

        btn.addEventListener('click', () => openCell(r, c));
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleFlag(r, c);
        });
        board.appendChild(btn);
      }
    }
    minesEl.textContent = pad3(Math.max(0, mineCount - flags));
  }

  /* ================= 翻开 ================= */
  function openCell(r, c) {
    if (state === 'win' || state === 'lose') return;
    const cell = grid[idx(r, c)];
    if (cell.opened || cell.flag) return;

    // 首次点击：开始计时并铺雷
    if (state === 'ready') {
      state = 'playing';
      placeMines(r, c);
      timerId = setInterval(() => {
        seconds++;
        timeEl.textContent = pad3(Math.min(seconds, 999));
      }, 1000);
    }

    if (cell.mine) {
      // 踩雷：游戏结束
      cell.hit = true;
      revealAllMines();
      state = 'lose';
      if (timerId) clearInterval(timerId);
      faceBtn.textContent = FACE.lose;
      hint.textContent = '踩到地雷了！点击笑脸重新开始本关';
      render();
      return;
    }

    // 空白格展开
    floodOpen(r, c);
    faceBtn.textContent = FACE.pressed;
    setTimeout(() => {
      if (state === 'playing') faceBtn.textContent = FACE.ok;
    }, 120);

    // 胜利判定
    if (openedCount === rows * cols - mineCount) {
      winLevel();
    }
    render();
  }

  function floodOpen(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cell = grid[idx(cr, cc)];
      if (cell.opened || cell.mine || cell.flag) continue;
      cell.opened = true;
      openedCount++;
      if (cell.adj === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = cr + dr, cc2 = cc + dc;
            if (rr >= 0 && rr < rows && cc2 >= 0 && cc2 < cols &&
                !grid[idx(rr, cc2)].opened && !grid[idx(rr, cc2)].mine) {
              stack.push([rr, cc2]);
            }
          }
        }
      }
    }
  }

  /* ================= 插旗 ================= */
  function toggleFlag(r, c) {
    if (state === 'win' || state === 'lose' || state === 'ready' && !grid.length) {
      if (state !== 'ready') return;
    }
    if (grid.length === 0) return; // 还没铺雷不能插旗
    const cell = grid[idx(r, c)];
    if (cell.opened) return;
    cell.flag = !cell.flag;
    flags += cell.flag ? 1 : -1;
    clickSound();
    render();
  }

  /* ================= 胜负 ================= */
  function revealAllMines() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[idx(r, c)];
        if (cell.mine && !cell.opened) {
          cell.opened = true; // 显示所有雷（不参与已翻统计）
        }
      }
    }
  }

  function winLevel() {
    state = 'win';
    if (timerId) clearInterval(timerId);
    faceBtn.textContent = FACE.win;
    winDetail.textContent = `本关用时 ${seconds} 秒，难度 Lv.${level}`;
    setTimeout(() => { win.hidden = false; }, 400);
    winSound();
  }

  /* ================= 音效 ================= */
  let audioCtx = null;
  function tone(freq, dur, type = 'square', vol = 0.03) {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* 忽略 */ }
  }
  const clickSound = () => tone(760, 0.05);
  const winSound = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.05), i * 130));

  /* ================= 事件 ================= */
  faceBtn.addEventListener('click', () => { newLevel(level); clickSound(); });
  restartBtn.addEventListener('click', () => { newLevel(level); clickSound(); });
  flagBtn.addEventListener('click', () => {
    flagMode = !flagMode;
    flagBtn.classList.toggle('on', flagMode);
    hint.textContent = flagMode ? '插旗模式：点格子 = 标记地雷' : '点击翻开 · 右键或插旗模式标记地雷';
    clickSound();
  });
  // 插旗模式：点击变为插旗
  board.addEventListener('click', (e) => {
    if (!flagMode) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    toggleFlag(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  nextBtn.addEventListener('click', () => { newLevel(level + 1); clickSound(); });

  /* ================= 启动：进入继续上次关卡 ================= */
  newLevel(level);
})();