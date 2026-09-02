/* ============================================================
   游戏列表配置（主页唯一需要修改的文件）
   ------------------------------------------------------------
   以后要加入新游戏，只需在 GAMES 数组里添加一条记录：

   {
     id:        '新游戏目录名',          // 必须与 games/ 下的文件夹同名
     name:      '中文名',
     en:        '英文名',
     icon:      '一个表情符号图标',
     url:       'games/xxx/index.html',  // available 为 true 时必须填写跳转地址
     available: true                     // true = 可玩，false = 显示"即将推出"
   }

   不需要再去改 index.html / js/home.js / css/home.css。
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
    id: 'solitaire',
    name: '经典纸牌',
    en: 'Solitaire',
    icon: '♠️',
    url: 'games/solitaire/index.html',
    available: false
  },
  {
    id: 'minesweeper',
    name: '扫雷',
    en: 'Minesweeper',
    icon: '💣',
    url: 'games/minesweeper/index.html',
    available: false
  }
];