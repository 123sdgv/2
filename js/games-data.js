/* ============================================================
   游戏列表配置（主页唯一需要修改的文件）
   ------------------------------------------------------------
   新增游戏时，在 GAMES 数组添加一条配置即可。
   ============================================================ */
window.GAMES = [
  {
    id: 'spider',
    name: '蜘蛛纸牌',
    en: 'Spider Solitaire',
    icon: '🕷️',
    url: 'games/spider/index.html',
    available: true
  },
  {
    id: 'liquid-sort',
    name: '倒饮料',
    en: 'Liquid Sort',
    icon: '🧋',
    url: 'games/liquid-sort/index.html',
    available: true
  },
  {
    id: 'minesweeper',
    name: '扫雷',
    en: 'Minesweeper',
    icon: '💣',
    url: 'games/minesweeper/index.html',
    available: true
  },
  {
    id: 'solitaire',
    name: '经典纸牌',
    en: 'Solitaire',
    icon: '♠️',
    url: 'games/solitaire/index.html',
    available: false
  }
];