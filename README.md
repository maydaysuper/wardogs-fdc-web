# WARDOGS 火力诸元

网页版火力诸元 + 运输账本。

## 在线版

https://maydaysuper.github.io/wardogs-fdc-web/

推到 `main` 会自动用客户端 SPA 重新发布。Pages 源选 `gh-pages` / `(root)`。

## 构建

```bash
npm install
npm run dev          # 8080 纯前端
npm run build:pages  # GitHub Pages 静态包 → dist/
npm run build:start  # 旧 TanStack Start / Nitro 包
```

线上只跑客户端包，不再依赖 SSR 预渲染。
