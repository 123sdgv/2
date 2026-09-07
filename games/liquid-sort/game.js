(() => {
  'use strict';

  /* ============================================================
     Liquid Sort · 倒饮料
     - 点击源瓶 -> 点击目标瓶 -> 立即完成倾倒（无流水动画）
     - 每瓶 4 层，相同顶色可倒，空瓶可倒
     - 关卡进度保存在 localStorage，下次进入继续
     ============================================================ */

  const board = document.querySelector('#board');
  const hint = document.querySelector('#hint');
  const movesEl = document.querySelector('#moves');
  const ordersEl = document.querySelector('#orders');
  const bagsEl = document.querySelector('#bags');
  const win = document.querySelector('#win');
  const levelEl = document.querySelector('#level');

  const COLORS = ['#ff5964', '#ffd83d', '#39d98a', '#36a8ff', '#a66cff', '#ff8a26', '#ef6fd4', '#19c3c8'];
  const STORE_KEY = 'liquid-sort-level';

  let tubes = [];
  let selected = -1;
  let moves = 0;
  let history = [];
  let completed = 0;

  // 读取上次的关卡进度
  let level = Math.max(1, parseInt(localStorage.getItem(STORE_KEY) || '1', 10) || 1);

  const snapshot = () => ({
    tubes: tubes.map(t => ({ colors: [...t], done: Boolean(t.done) })),
    moves,
    completed
  });

  const restore = state => {
    tubes = state.tubes.map(t => {
      const tube = [...t.colors];
      tube.done = t.done;
      return tube;
    });
    moves = state.moves;
    completed = state.completed;
    selected = -1;
  };

  const shuffle = array => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const isComplete = tube => tube.length === 4 && tube.every(color => color === tube[0]);
  const levelColorCount = () => Math.min(3 + Math.floor((level - 1) / 2), 8);
  const liquidGradient = color =>
    `linear-gradient(90deg, ${color}, #ffffff44 48%, ${color})`;

  /* ================= 新关卡（随机） ================= */
  function makeLevel() {
    selected = -1;
    moves = 0;
    completed = 0;
    history = [];
    win.hidden = true;

    const colorCount = levelColorCount();
    const pool = [];
    for (let color = 0; color < colorCount; color++) {
      for (let i = 0; i < 4; i++) pool.push(color);
    }
    shuffle(pool);

    tubes = [];
    for (let i = 0; i < colorCount; i++) tubes.push(pool.slice(i * 4, i * 4 + 4));
    tubes.push([], []); // 两个空瓶

    // 极小概率首局已排好，重新洗
    if (tubes.slice(0, colorCount).every(isComplete)) {
      makeLevel();
      return;
    }

    localStorage.setItem(STORE_KEY, String(level)); // 记住关卡
    levelEl.textContent = level;
    showHint('点击一瓶饮料，再点击另一瓶开始倒饮料');
    render();
  }

  /* ================= 渲染 ================= */
  function render() {
    board.innerHTML = '';

    tubes.forEach((tube, index) => {
      const bottle = document.createElement('button');
      bottle.type = 'button';
      bottle.className = 'bottle' + (selected === index ? ' selected' : '');
      bottle.dataset.i = index;
      bottle.setAttribute('aria-label', `第 ${index + 1} 瓶`);

      const layers = document.createElement('span');
      layers.className = 'layers';
      tube.forEach(colorIndex => {
        const liquid = document.createElement('span');
        liquid.className = 'liquid';
        liquid.style.background = liquidGradient(COLORS[colorIndex]); // 用真实色值
        layers.appendChild(liquid);
      });
      bottle.appendChild(layers);
      bottle.addEventListener('click', () => tap(index));
      board.appendChild(bottle);
    });

    movesEl.textContent = moves;
    ordersEl.textContent = `${completed} / ${levelColorCount()}`;
    bagsEl.innerHTML = '';
    for (let i = 0; i < completed; i++) {
      const bag = document.createElement('span');
      bag.className = 'bag';
      const drink = document.createElement('span');
      drink.className = 'drink';
      drink.style.background = COLORS[i % COLORS.length];
      bag.appendChild(drink);
      bagsEl.appendChild(bag);
    }
  }

  /* ================= 点击处理 ================= */
  function tap(index) {
    if (selected < 0) {
      if (!tubes[index].length) {
        showHint('先选择一瓶有饮料的瓶子');
        return;
      }
      selected = index;
      showHint('现在选择要倒入的瓶子');
      render();
      return;
    }
    if (selected === index) {
      selected = -1;
      render();
      return;
    }

    const source = selected;
    selected = -1;
    if (pour(source, index)) {
      render();
      checkCompleted();
    } else {
      render();
    }
  }

  /* ================= 倾倒（立即完成） ================= */
  function pour(fromIdx, toIdx) {
    const from = tubes[fromIdx];
    const to = tubes[toIdx];

    // 合法性：源瓶有液体 / 目标有空间 / 空瓶或顶色相同
    if (!from.length || to.length >= 4) {
      showHint('这瓶已经满了');
      return false;
    }
    const colorIndex = from[from.length - 1];
    if (to.length && to[to.length - 1] !== colorIndex) {
      showHint('只能倒入空瓶或相同颜色的饮料');
      return false;
    }

    // 计算要倒几层（相同顶色连续 + 目标空间）
    let amount = 0;
    while (amount < from.length &&
           from[from.length - 1 - amount] === colorIndex &&
           to.length + amount < 4) {
      amount++;
    }
    if (!amount) {
      showHint('没有可以倒的饮料');
      return false;
    }

    history.push(snapshot());          // 记录操作前状态，供撤回
    for (let i = 0; i < amount; i++) to.push(from.pop());
    moves++;
    return true;
  }

  /* ================= 完成检测 ================= */
  function checkCompleted() {
    const newlyComplete = [];
    tubes.forEach((tube, index) => {
      if (isComplete(tube) && !tube.done) {
        tube.done = true;
        newlyComplete.push(index);
      }
    });
    if (!newlyComplete.length) return;

    completed += newlyComplete.length;

    // 外卖袋弹出
    const bag = document.createElement('span');
    bag.className = 'bag fill';
    const drink = document.createElement('span');
    drink.className = 'drink';
    drink.style.background = COLORS[(completed - 1) % COLORS.length];
    bag.appendChild(drink);
    bagsEl.appendChild(bag);

    showHint('订单完成，饮料已装袋！');

    if (completed >= levelColorCount()) {
      setTimeout(() => {
        render();
        const last = bagsEl.lastElementChild;
        if (last) last.classList.add('away');
        setTimeout(() => { win.hidden = false; }, 700);
      }, 300);
    } else {
      setTimeout(() => render(), 300);
    }
  }

  /* ================= 撤回 ================= */
  function undo() {
    const state = history.pop();
    if (!state) {
      showHint('没有可以撤回的步骤');
      return;
    }
    restore(state);
    render();
    showHint('已撤回一步');
  }

  /* ================= 提示 ================= */
  function showHint(text) {
    hint.textContent = text;
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => {
      hint.textContent = '点击一瓶饮料，再点击另一瓶开始倒饮料';
    }, 2200);
  }

  /* ================= 事件绑定 ================= */
  document.querySelector('#reset').addEventListener('click', () => {
    makeLevel();
    showHint('本关已重新生成');
  });
  document.querySelector('#undo').addEventListener('click', undo);
  document.querySelector('#next').addEventListener('click', () => {
    level++;
    makeLevel();
  });

  /* ================= 启动 ================= */
  makeLevel();
})();