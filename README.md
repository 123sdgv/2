# Windows Classic Games Remake

Windows XP 风格的纯 HTML、CSS、JavaScript 经典小游戏项目。

## 当前功能

- 简洁游戏大厅
- 单花色蜘蛛纸牌
- 10 列牌堆、104 张牌、8 组完整牌组
- 点击或拖动移动牌组
- 发牌、计分、步数和计时
- 自动收牌和胜利提示
- 无后端、无框架、可离线运行

## 目录结构

```text
.
├── index.html
├── css/home.css
├── js/home.js
├── games/spider/
│   ├── index.html
│   ├── style.css
│   └── game.js
└── README.md
```

每个游戏都位于独立的 `games/<游戏名>/` 目录中。新增游戏时，只需创建自己的 `index.html`、`style.css` 和 `game.js`，再在大厅添加入口。

## 本地运行

直接打开根目录 `index.html`，或运行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## GitHub Pages 部署

进入仓库 **Settings → Pages**，在 **Build and deployment** 中选择 **Deploy from a branch**，分支选择 `main`，目录选择 `/ (root)`，点击 **Save**。这是纯静态项目，不需要构建命令或后端。

## 添加新游戏

```text
games/minesweeper/
├── index.html
├── style.css
└── game.js
```

大厅中添加：

```html
<a class="game-card" href="games/minesweeper/index.html">
  <span class="game-icon">💣</span>
  <strong>扫雷</strong>
  <small>Minesweeper</small>
  <button>开始游戏</button>
</a>
```

游戏返回大厅时使用：

```html
<a href="../../index.html">返回大厅</a>
```

未来可按相同方式加入红心大战、三维弹球、俄罗斯方块和太空大战。
