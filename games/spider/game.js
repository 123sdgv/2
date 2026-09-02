(() => {
  'use strict';

  /* ============================================================
     蜘蛛纸牌 · 双花色模式（黑桃 ♠ + 红心 ♥）
     - 104 张牌：黑桃 52 + 红心 52（每种花色 4 组 A-K），收满 8 组胜利
     - 操作：点击移动 / 拖拽 / 撤回 / 发牌
     - 胜利：碎纸 + 烟花粒子特效
     ============================================================ */

  /* ---------- 常量 ---------- */
  const SUITS = [
    { symbol: '♠', color: 'black' },  // 0 黑桃
    { symbol: '♥', color: 'red' }     // 1 红心
  ];
  const RANKS = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
  const SETS_PER_SUIT = 4;      // 每种花色 4 组
  const TOTAL_COMPLETE = 8;     // 收满 8 组即胜利

  /* ---------- DOM 元素 ---------- */
  const table     = document.querySelector('#table');
  const scoreEl   = document.querySelector('#score');
  const movesEl   = document.querySelector('#moves');
  const timerEl   = document.querySelector('#timer');
  const stockEl   = document.querySelector('#stock-count');
  const dealBtn   = document.querySelector('#deal');
  const undoBtn   = document.querySelector('#undo');
  const helpBtn   = document.querySelector('#help');
  const message   = document.querySelector('#message');
  const msgDetail = document.querySelector('#msg-detail');
  const rules     = document.querySelector('#rules');
  const closeRules= document.querySelector('#close-rules');
  const againBtn  = document.querySelector('#again');
  const newGameBtn= document.querySelector('#new-game');
  const hintEl    = document.querySelector('#hint-text');
  const canvas    = document.querySelector('#fx');

  /* ---------- 游戏状态 ---------- */
  let columns   = [];      // 10 列，每列是 {suit, rank, face}[]
  let stock     = [];      // 发牌堆
  let completed = 0;       // 已收走完整序列数
  let selected  = null;    // 选中 { column, index }
  let score     = 500;
  let moves     = 0;
  let seconds   = 0;
  let timerId   = null;
  let history   = [];      // 撤销历史栈
  let animFlag  = { deal: false, col: -1 }; // 本次渲染要播放落牌动画的位置

  /* ================= 音效（Web Audio 合成，无外部文件） ================= */
  const Sfx = {
    ctx: null,
    play(freq, dur = 0.06, type = 'square', vol = 0.03) {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch (e) { /* 忽略不支持音频的环境 */ }
    },
    click() { this.play(720, 0.05); },
    flip()  { this.play(420, 0.08, 'triangle'); },
    win()   { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.play(f, 0.25, 'sine', 0.05), i * 150)); }
  };

  /* ================= 工具函数 ================= */
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fmtTime = () =>
    String(seconds / 60 | 0).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  const isRed = (card) => SUITS[card.suit].color === 'red';

  /* 从 col[i] 起，向下连续"同花色 + 降序 + 全部翻开"的序列长度 */
  const seqLength = (col, i) => {
    if (!col[i] || !col[i].face) return 0;
    let len = 1;
    while (i + len < col.length &&
           col[i + len].face &&
           col[i + len].suit === col[i + len - 1].suit &&
           col[i + len - 1].rank === col[i + len].rank + 1) {
      len++;
    }
    return len;
  };

  /* ================= 新游戏 ================= */
  function newGame() {
    clearInterval(timerId);
    seconds = 0; completed = 0; selected = null;
    score = 500; moves = 0; history = [];
    stock = [];
    columns = Array.from({ length: 10 }, () => []);

    // 生成 104 张：2 花色 × 4 组 × A-K
    const deck = [];
    for (let suit = 0; suit < SUITS.length; suit++) {
      for (let set = 0; set < SETS_PER_SUIT; set++) {
        for (let rank = 0; rank < 13; rank++) deck.push({ suit, rank, face: false });
      }
    }
    shuffle(deck);

    // 前 4 列各 6 张，后 6 列各 5 张（共 54 张上桌）
    for (let c = 0; c < 10; c++) {
      const n = c < 4 ? 6 : 5;
      for (let i = 0; i < n; i++) columns[c].push(deck.pop());
      columns[c][columns[c].length - 1].face = true; // 最上面一张翻开
    }
    while (deck.length) stock.push(deck.pop());       // 剩余 50 张进发牌堆

    timerId = setInterval(() => { seconds++; timerEl.textContent = fmtTime(); }, 1000);
    message.hidden = true;
    showHint('新游戏 · 点击一张牌再点目标列，也可拖拽、撤回');
    animFlag = { deal: false, col: -1 };
    render();
  }

  /* ================= 渲染 ================= */
  function render() {
    table.innerHTML = '';

    columns.forEach((col, c) => {
      const box = document.createElement('div');
      box.className = 'column';
      box.dataset.column = c;

      col.forEach((card, i) => {
        const node = document.createElement('div');
        const inSel = selected && selected.column === c && i >= selected.index;
        node.className = 'card' + (card.face ? ' face' : ' back') + (inSel ? ' selected' : '');
        node.style.top = (card.face ? i * 26 : i * 12) + 'px';

        if (card.face) {
          if (isRed(card)) node.classList.add('red');
          // 牌面：左上角点数 + 花色，右下角反向小字
          node.innerHTML =
            '<span class="rank">' + RANKS[card.rank] + '</span>' +
            '<span class="suit">' + SUITS[card.suit].symbol + '</span>' +
            '<span class="suit-b">' + RANKS[card.rank] + SUITS[card.suit].symbol + '</span>';
          node.dataset.index = i;
          node.draggable = true;

          node.addEventListener('click', (e) => {
            e.stopPropagation();
            onCardClick(c, i);
          });
          node.addEventListener('dragstart', (e) => {
            if (seqLength(col, i) > 0) {
              selected = { column: c, index: i };
              e.dataTransfer.setData('text/plain', 'move');
              render();
            }
          });
        }

        // 落牌 / 发牌动画
        if (card.face && i === col.length - 1 &&
            (animFlag.col === c || animFlag.deal)) {
          node.classList.add(animFlag.deal ? 'deal-in' : 'drop-in');
          if (animFlag.deal) node.style.animationDelay = (c * 35) + 'ms';
        }
        box.appendChild(node);
      });
      table.appendChild(box);
    });

    // 已完成序列徽章（右上角向左排列）
    for (let i = 0; i < completed; i++) {
      const b = document.createElement('div');
      b.className = 'complete';
      b.textContent = 'K';
      b.style.right = (5 + i * 43) + 'px';
      table.appendChild(b);
    }

    // 信息栏刷新
    if (stockEl) stockEl.textContent = stock.length;
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    timerEl.textContent = fmtTime();
    if (dealBtn) dealBtn.disabled = stock.length === 0 || columns.some(c => c.length === 0);

    animFlag = { deal: false, col: -1 }; // 动画只播一次
  }

  /* ================= 点击选牌 ================= */
  function onCardClick(c, i) {
    if (selected) {
      if (selected.column === c && selected.index === i) {
        selected = null;                       // 再点一次取消选择
      } else if (move(selected.column, selected.index, c)) {
        selected = null;
      } else {
        selected = null;
        if (seqLength(columns[c], i) > 0) selected = { column: c, index: i };
      }
    } else if (seqLength(columns[c], i) > 0) {
      selected = { column: c, index: i };
    }
    Sfx.click();
    render();
  }

  /* ================= 执行移动 ================= */
  function move(from, index, to) {
    if (from === to) return false;
    const source = columns[from];
    const target = columns[to];
    const len = seqLength(source, index);
    if (!len) return false;
    const card = source[index];
    // 空列可放任意牌；非空列需"同花色 + 比末牌小 1 点"
    if (target.length &&
       (target[target.length - 1].suit !== card.suit ||
        target[target.length - 1].rank !== card.rank + 1)) return false;

    pushUndo();                            // 记录撤销点
    const moving = source.splice(index);
    if (source.length) source[source.length - 1].face = true; // 翻开下面的牌
    target.push(...moving);
    moves++;
    score = Math.max(0, score - 1);
    animFlag.col = to;
    checkComplete(to);
    Sfx.flip();
    return true;
  }

  /* ================= 完整序列检测 ================= */
  function checkComplete(c) {
    const col = columns[c];
    if (col.length < 13) return;
    const start = col.length - 13;
    if (col[start].rank !== 0) return;         // 序列头必须是 K
    if (seqLength(col, start) !== 13) return;  // 必须同花色连续到 A
    col.splice(start, 13);                     // 收走 13 张
    if (col.length) col[col.length - 1].face = true;
    completed++;
    score += 100;
    showHint('收走一组完整序列 +100 分');

    if (completed === TOTAL_COMPLETE) {
      clearInterval(timerId);
      victoryFx();                            // 碎纸 + 烟花
      Sfx.win();
      msgDetail.textContent = '用时 ' + fmtTime() + ' · 步数 ' + moves + ' · 得分 ' + score;
      setTimeout(() => { message.hidden = false; }, 900);
    }
  }

  /* ================= 发牌 ================= */
  function deal() {
    if (stock.length === 0) { showHint('发牌堆已经用完'); return; }
    if (columns.some(c => c.length === 0)) { showHint('请先把空列填满再发牌'); return; }
    pushUndo();
    for (let c = 0; c < columns.length; c++) {
      const card = stock.pop();
      card.face = true;                      // 发上来的牌直接翻开
      columns[c].push(card);
    }
    moves++;
    score = Math.max(0, score - 10);
    selected = null;
    animFlag.deal = true;
    showHint('发牌完成');
    Sfx.flip();
    render();
  }

  /* ================= 撤销 ================= */
  function pushUndo() {
    history.push({
      columns: columns.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, face: c.face }))),
      score: score,
      moves: moves
    });
    if (history.length > 200) history.shift();
  }
  function undo() {
    const s = history.pop();
    if (!s) { showHint('没有可撤回的操作'); Sfx.click(); return; }
    columns = s.columns;
    score = s.score;
    moves = s.moves;
    selected = null;
    showHint('已撤回一步');
    Sfx.click();
    render();
  }

  /* ================= 胜利特效：碎纸 + 烟花 ================= */
  function victoryFx() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#ecf0f1'];
    const parts = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // 中央碎纸喷发（模拟扑克牌碎片）
    for (let i = 0; i < 150; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 8;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 5,
        w: 6 + Math.random() * 7, h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1, g: 0.13
      });
    }
    // 三次烟花（延迟在牌桌两侧发射）
    for (let f = 0; f < 3; f++) {
      setTimeout(() => {
        const fx = 120 + Math.random() * (canvas.width - 240);
        const fy = canvas.height - 80;
        for (let i = 0; i < 70; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 7;
          parts.push({
            x: fx, y: fy,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 4,
            w: 3, h: 3, rot: 0, vr: 0,
            color: colors[(Math.random() * colors.length) | 0],
            life: 1, g: 0.12
          });
        }
      }, f * 550);
    }

    let raf = null;
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      parts.forEach(p => {
        if (p.life <= 0) return;
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr; p.life -= 0.0075;
        if (p.life <= 0) return;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) {
        raf = requestAnimationFrame(frame);
      } else {
        if (raf) cancelAnimationFrame(raf);
        canvas.style.display = 'none';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    frame();
  }

  function showHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  /* ================= 事件绑定 ================= */
  // 点击列空白处 → 移动选中牌组到该列
  table.addEventListener('click', (e) => {
    const col = e.target.closest('.column');
    if (!col) return;
    if (selected) {
      move(selected.column, selected.index, +col.dataset.column);
      selected = null;
      Sfx.click();
      render();
    }
  });

  // 拖拽支持
  table.addEventListener('dragover', (e) => e.preventDefault());
  table.addEventListener('drop', (e) => {
    e.preventDefault();
    const col = e.target.closest('.column');
    if (col && selected) {
      move(selected.column, selected.index, +col.dataset.column);
      selected = null;
      Sfx.click();
      render();
    }
  });

  // 菜单按钮
  newGameBtn.addEventListener('click', newGame);
  dealBtn.addEventListener('click', deal);
  undoBtn.addEventListener('click', undo);
  helpBtn.addEventListener('click', () => { rules.hidden = false; Sfx.click(); });
  closeRules.addEventListener('click', () => { rules.hidden = true; Sfx.click(); });
  againBtn.addEventListener('click', () => { message.hidden = true; newGame(); });

  /* ---------- 启动 ---------- */
  newGame();
})();