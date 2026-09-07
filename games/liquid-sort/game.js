(() => {
  'use strict';

  const board = document.querySelector('#board');
  const hint = document.querySelector('#hint');
  const movesEl = document.querySelector('#moves');
  const ordersEl = document.querySelector('#orders');
  const bagsEl = document.querySelector('#bags');
  const win = document.querySelector('#win');
  const levelEl = document.querySelector('#level');
  const COLORS = ['#ff5964', '#ffd83d', '#39d98a', '#36a8ff', '#a66cff', '#ff8a26', '#ef6fd4', '#19c3c8'];

  let tubes = [];
  let selected = -1;
  let moves = 0;
  let history = [];
  let level = 1;
  let completed = 0;
  let cartonUnlocked = false;
  let busy = false;

  const snapshot = () => ({
    tubes: tubes.map(t => ({ colors: [...t], done: Boolean(t.done) })),
    moves,
    completed,
    cartonUnlocked
  });

  const restore = state => {
    tubes = state.tubes.map(t => {
      const tube = [...t.colors];
      tube.done = t.done;
      return tube;
    });
    moves = state.moves;
    completed = state.completed;
    cartonUnlocked = state.cartonUnlocked;
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

  function makeLevel() {
    busy = false;
    selected = -1;
    moves = 0;
    completed = 0;
    cartonUnlocked = level < 3;
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
    tubes.push([], []);

    // 极少数随机结果可能刚好已经整理好，重新随机一次
    if (tubes.slice(0, colorCount).every(isComplete)) {
      makeLevel();
      return;
    }
    levelEl.textContent = level;
    showHint('点击一瓶饮料，再点击另一瓶开始倒饮料');
    render();
  }

  function render() {
    board.innerHTML = '';
    const cartonIndex = Math.floor(tubes.length / 2);

    tubes.forEach((tube, index) => {
      if (level >= 3 && index === cartonIndex) {
        const carton = document.createElement('button');
        carton.type = 'button';
        carton.className = 'carton' + (cartonUnlocked ? ' open' : '');
        carton.title = cartonUnlocked ? '奶茶盒已打开' : '完成一半订单后解锁';
        carton.innerHTML = cartonUnlocked
          ? '<span>🧋</span><small>已解锁</small>'
          : '<span>🔒</span><small>完成一半订单后揭开</small>';
        carton.addEventListener('click', () => showHint(
          cartonUnlocked ? '奶茶盒已打开，继续整理饮料吧' : '还需要完成一半订单才能打开'
        ));
        board.appendChild(carton);
      }

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
        liquid.style.background = `linear-gradient(90deg, ${COLORS[color]}, #ffffff44 48%, ${COLORS[color]})`;
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
    if (!pour(source, index)) {
      showHint('只能倒入空瓶或相同颜色的饮料');
      selected = -1;
      render();
      return;
    }
    selected = -1;
    render();
    checkCompleted();
  }

  function pour(fromIndex, toIndex) {
    const from = tubes[fromIndex];
    const to = tubes[toIndex];
    if (!from.length || to.length >= 4) return false;

    const color = from[from.length - 1];
    if (to.length && to[to.length - 1] !== color) return false;

    // 必须在移动前保存快照，撤回才会回到这一步之前
    history.push(snapshot());

    while (from.length && from[from.length - 1] === color && to.length < 4) {
      to.push(from.pop());
    }
    moves++;
    return true;
  }

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
    if (completed >= Math.ceil(levelColorCount() / 2)) cartonUnlocked = true;
    newlyComplete.forEach(index => {
      const bottle = document.querySelector(`.bottle[data-i="${index}"]`);
      if (bottle) bottle.classList.add('pour');
    });
    showHint(cartonUnlocked ? '订单完成，奶茶盒已解锁！' : '订单完成，饮料已装袋！');

    setTimeout(() => {
      render();
      if (completed >= levelColorCount()) {
        busy = true;
        setTimeout(() => { win.hidden = false; busy = false; }, 350);
      }
    }, 550);
  }

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

  function showHint(text) {
    hint.textContent = text;
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => {
      hint.textContent = '点击一瓶饮料，再点击另一瓶开始倒饮料';
    }, 2200);
  }

  document.querySelector('#reset').addEventListener('click', makeLevel);
  document.querySelector('#undo').addEventListener('click', undo);
  document.querySelector('#next').addEventListener('click', () => {
    level++;
    makeLevel();
  });

  makeLevel();
})();