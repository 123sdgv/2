(() => {
  'use strict';

  /* ============================================================
     蜘蛛纸牌（单花色模式）逻辑模块
     - 10 列牌堆，104 张牌（8 组 A-K）
     - 点击选牌 -> 再点击目标列移动（也支持拖拽）
     - 发牌：每列补 1 张（需桌面无空列、发牌堆有牌）
     - 完整 K..A 同序序列自动收走，收满 8 组胜利
     - 计分：开局 500，每步 -1，收一组 +100，每轮发牌 -10
     ============================================================ */

  /* ---------- DOM 元素 ---------- */
  const table    = document.querySelector('#table');
  const scoreEl  = document.querySelector('#score');
  const movesEl  = document.querySelector('#moves');
  const timerEl  = document.querySelector('#timer');
  const stockEl  = document.querySelector('#stock-count'); // 发牌堆剩余
  const dealBtn  = document.querySelector('#deal');
  const message  = document.querySelector('#message');
  const hintEl   = document.querySelector('#hint-text');

  /* ---------- 全局状态 ---------- */
  let columns   = [];   // 10 列，每列是 card 数组
  let stock     = [];   // 发牌堆（背面朝下）
  let completed = 0;    // 已收走的完整序列数（共 8）
  let selected  = null; // 当前选中的牌组头部 { column, index }
  let score     = 500;  // 分数
  let moves     = 0;    // 步数
  let seconds   = 0;    // 秒数
  let timerId   = null; // 计时器句柄

  /* A-K 显示文本（rank 0 = K，12 = A） */
  const RANKS = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];

  /* ---------- 工具函数 ---------- */
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const fmtTime = () =>
    String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
    String(seconds % 60).padStart(2, '0');

  /* 计算某一列从 index 起，到列尾有多长的"翻开且连续降序"序列。
     例如 9,8,7,6（全部朝上且 rank 连续）返回长度 4。 */
  const seqLength = (col, i) => {
    if (!col[i] || !col[i].face) return 0;
    let len = 1;
    while (i + len < col.length &&
           col[i + len].face &&
           col[i + len - 1].rank === col[i + len].rank + 1) {
      len++;
    }
    return len;
  };

  /* ---------- 新游戏 ---------- */
  function newGame() {
    clearInterval(timerId);
    seconds = 0;
    completed = 0;
    selected = null;
    score = 500;
    moves = 0;
    stock = [];
    columns = Array.from({ length: 10 }, () => []);

    // 生成 104 张牌：13 个点数 × 8 份
    const deck = [];
    for (let copy = 0; copy < 8; copy++) {
      for (let rank = 0; rank < 13; rank++) {
        deck.push({ rank, face: false });
      }
    }
    shuffle(deck);

    // 前 4 列各 6 张，后 6 列各 5 张 = 共 54 张
    for (let c = 0; c < 10; c++) {
      const count = c < 4 ? 6 : 5;
      for (let i = 0; i < count; i++) columns[c].push(deck.pop());
      columns[c][columns[c].length - 1].face = true; // 最上面一张翻开
    }
    // 剩余 50 张进入发牌堆
    while (deck.length) stock.push(deck.pop());

    timerId = setInterval(() => { seconds++; timerEl.textContent = fmtTime(); }, 1000);
    showHint('新游戏开始 · 点击一张牌再点击目标列，也可直接拖拽');
    render();
  }

  /* ---------- 渲染 ---------- */
  function render() {
    table.innerHTML = '';

    columns.forEach((col, c) => {
      const el = document.createElement('div');
      el.className = 'column';
      el.dataset.column = c;

      col.forEach((card, i) => {
        const n = document.createElement('div');
        const inSelection = selected && selected.column === c && i >= selected.index;
        n.className = 'card ' + (card.face ? 'face' : 'back') + (inSelection ? ' selected' : '');
        // 背面牌间距小，翻开的牌间距大
        n.style.top = (card.face ? i * 26 : i * 12) + 'px';

        if (card.face) {
          n.textContent = RANKS[card.rank];
          n.dataset.index = i;
          n.draggable = true;

          n.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止冒泡触发列点击
            onCardClick(c, i);
          });
          n.addEventListener('dragstart', (e) => {
            if (seqLength(col, i) > 0) {
              selected = { column: c, index: i };
              e.dataTransfer.setData('text/plain', 'move');
              render();
            }
          });
        }
        el.appendChild(n);
      });
      table.appendChild(el);
    });

    // 已完成的序列，以徽章形式从右上角向左排列
    for (let i = 0; i < completed; i++) {
      const n = document.createElement('div');
      n.className = 'complete';
      n.textContent = 'K';
      n.style.right = (5 + i * 43) + 'px';
      table.appendChild(n);
    }

    // 工具栏信息
    if (stockEl) stockEl.textContent = stock.length;
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    timerEl.textContent = fmtTime();
    // 无牌可发、或存在空列时禁用发牌按钮
    if (dealBtn) dealBtn.disabled = stock.length === 0 || columns.some(c => c.length === 0);
  }

  /* ---------- 点击一张牌 ---------- */
  function onCardClick(c, i) {
    if (selected) {
      if (move(selected.column, selected.index, c)) {
        selected = null;
      } else if (selected.column === c && selected.index === i) {
        selected = null;                 // 再次点击同一张 → 取消选择
      } else {
        selected = null;                 // 非法移动 → 取消选择
        if (seqLength(columns[c], i) > 0) selected = { column: c, index: i };
      }
    } else if (seqLength(columns[c], i) > 0) {
      selected = { column: c, index: i };
    }
    render();
  }

  /* ---------- 执行移动 ---------- */
  function move(from, index, to) {
    if (from === to) return false;
    const source = columns[from];
    const target = columns[to];
    const len = seqLength(source, index);
    if (!len) return false;                                // 不是可移动序列
    const card = source[index];
    // 空列可放任意牌；非空列要求末牌点数比它大 1
    if (target.length && target[target.length - 1].rank !== card.rank + 1) return false;
    const moving = source.splice(index);                   // 取出整组
    if (source.length) source[source.length - 1].face = true; // 露出下面一张
    target.push(...moving);
    moves++;
    score = Math.max(0, score - 1);
    checkComplete(to);
    return true;
  }

  /* ---------- 检查是否凑成 K..A 完整序列 ---------- */
  function checkComplete(c) {
    const col = columns[c];
    if (col.length < 13) return;
    const start = col.length - 13;
    if (col[start].rank !== 0) return;         // 序列头部必须是 K
    if (seqLength(col, start) !== 13) return;  // 必须完整连续的 K..A
    col.splice(start, 13);                     // 收走这 13 张
    if (col.length) col[col.length - 1].face = true;
    completed++;
    score += 100;
    showHint('完成一组完整序列！+100 分');
    if (completed === 8) {
      clearInterval(timerId);
      setTimeout(() => { message.hidden = false; }, 600);
    }
  }

  /* ---------- 发牌（关键修复） ---------- */
  function deal() {
    if (stock.length === 0) { showHint('发牌堆已经没有牌了'); return; }
    if (columns.some(c => c.length === 0)) { showHint('请先填满所有空列再发牌'); return; }
    for (let c = 0; c < columns.length; c++) {
      const card = stock.pop();   // 先取出牌
      card.face = true;           // 再翻开
      columns[c].push(card);      // 最后放入列
    }
    moves++;
    score = Math.max(0, score - 10);
    selected = null;
    showHint('已发新的一行牌');
    render();
  }

  function showHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  /* ---------- 事件绑定 ---------- */
  // 点击列的空白区域 → 尝试把选中组移动到这里
  table.addEventListener('click', (e) => {
    const col = e.target.closest('.column');
    if (!col) return;
    if (selected) {
      move(selected.column, selected.index, +col.dataset.column);
      selected = null;
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
      render();
    }
  });

  document.querySelector('#new-game').addEventListener('click', newGame);
  dealBtn.addEventListener('click', deal);
  document.querySelector('#again').addEventListener('click', () => {
    message.hidden = true;
    newGame();
  });

  /* ---------- 启动 ---------- */
  newGame();
})();