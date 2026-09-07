(() => {
  'use strict';

  /* ============================================================
     Liquid Sort · 倒饮料
     - 点击源瓶 -> 点击目标瓶 -> 播放倾倒动画 -> 更新数据
     - 倒水动画：源瓶倾斜移动 + 水流柱 + 目标瓶液面上升
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
  let busy = false;      // 动画进行中，禁止新操作

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
    busy = false;
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
      tube.forEach(color => {
        const liquid = document.createElement('span');
        liquid.className = 'liquid';
        liquid.style.background = liquidGradient(color);
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
    if (busy) return;
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
    render();
    pourWithAnimation(source, index);
  }

  /* ================= 倾倒（带动画） ================= */
  function pourWithAnimation(fromIdx, toIdx) {
    const from = tubes[fromIdx];
    const to = tubes[toIdx];

    // 合法性：源瓶有液体 / 目标有空间 / 空瓶或顶色相同
    if (!from.length || to.length >= 4) {
      showHint('这瓶已经满了');
      return;
    }
    const color = from[from.length - 1];
    if (to.length && to[to.length - 1] !== color) {
      showHint('只能倒入空瓶或相同颜色的饮料');
      return;
    }

    // 计算要倒几层（相同顶色连续 + 目标空间）
    let amount = 0;
    while (amount < from.length &&
           from[from.length - 1 - amount] === color &&
           to.length + amount < 4) {
      amount++;
    }
    if (!amount) {
      showHint('没有可以倒的饮料');
      return;
    }

    const fromEl = board.querySelector(`.bottle[data-i="${fromIdx}"]`);
    const toEl = board.querySelector(`.bottle[data-i="${toIdx}"]`);

    // 1. 源瓶平移+倾斜到目标瓶上方
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    fromEl.style.setProperty('--dx', dx + 'px');
    fromEl.classList.add('pouring');

    // 2. 目标瓶上方出现水流柱
    const boardRect = board.getBoundingClientRect();
    const stream = document.createElement('span');
    stream.className = 'stream';
    stream.style.left = (toRect.left + toRect.width / 2 - boardRect.left - 6.5) + 'px';
    stream.style.top = (toRect.top - boardRect.top - 46) + 'px';
    stream.style.height = '0px';
    stream.style.background = `linear-gradient(180deg, ${color}, ${color})`;
    board.appendChild(stream);
    requestAnimationFrame(() => {
      stream.style.opacity = '1';
      stream.style.height = '12px';
    });
    setTimeout(() => { stream.style.height = '46px'; }, 40);

    // 3. 目标瓶液面上升（预加将要倒入的层）
    const rise = document.createElement('span');
    rise.className = 'liquid rise';
    rise.style.background = liquidGradient(color);
    rise.style.height = '0%';
    toEl.querySelector('.layers').appendChild(rise);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rise.style.height = (amount * 25) + '%';
      });
    });

    // 4. 动画结束后真正更新数据
    busy = true;
    setTimeout(() => {
      history.push(snapshot());          // 记录操作前状态
      for (let i = 0; i < amount; i++) to.push(from.pop());
      moves++;
      busy = false;
      render();
      checkCompleted();
    }, 620);
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

    // 完成瓶上抛消失 + 外卖袋弹出
    newlyComplete.forEach(index => {
      const bottle = document.querySelector(`.bottle[data-i="${index}"]`);
      if (bottle) bottle.classList.add('pour');
    });
    const bag = document.createElement('span');
    bag.className = 'bag fill';
    const drink = document.createElement('span');
    drink.className = 'drink';
    drink.style.background = COLORS[(completed - 1) % COLORS.length];
    bag.appendChild(drink);
    bagsEl.appendChild(bag);

    showHint('订单完成，饮料已装袋！');

    setTimeout(() => {
      render();
      if (completed >= levelColorCount()) {
        // 最后的外卖袋离开
        const last = bagsEl.lastElementChild;
        if (last) last.classList.add('away');
        setTimeout(() => { win.hidden = false; }, 700);
      }
    }, 560);
  }

  /* ================= 撤回 ================= */
  function undo() {
    if (busy) return;
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
    busy = false;
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