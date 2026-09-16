# WARDOGS 火力诸元

网页版火力诸元 + 运输账本。给不想装 Windows Overlay 的人用。

Windows 便携包在 [wardogs-fdc](https://github.com/maydaysuper/wardogs-fdc)。

## 在线版

最新网页（随 `main` 自动发布）：

https://maydaysuper.github.io/wardogs-fdc-web/

源码：https://github.com/maydaysuper/wardogs-fdc-web

`drum-ivory-gem-marble.grok.me` 是旧预览，不会跟仓库同步。看新功能请用上面的 Pages 地址，必要时强制刷新。

## 做什么

- **火力**：L81 迫击炮 / SPH-2 自行火炮密位，敌我坐标或已知距离，射角、方位、落弹时间
- **地图**：Bakurani、Ozeti、Zestafona 瓦片图，圆形战区、塔位、红/蓝/绿出生点
- **运输**：出生车库 → 前线 FOB，载具/托盘账本，一键最优（不会红方送蓝方）

数据只存在本机 `localStorage`，没有账号。

## 本地跑

```bash
npm install
npm run dev
```

浏览器打开提示的地址。`npm test` 跑诸元、塔位和运输账本测试。

## 操作

- 拖动平移，滚轮或双指缩放
- 火力：点地图标炮位 / 目标；运输：点我方出生和卸货
- 手机默认收成底栏，点一下展开完整面板
