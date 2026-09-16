# WARDOGS 火力诸元

网页版火力诸元 + 运输账本。

## 在线版

https://maydaysuper.github.io/wardogs-fdc-web/

## 自定义域名

1. 在仓库 Settings → Secrets and variables → Actions → Variables 新建 `CUSTOM_DOMAIN`（例如 `fdc.example.com`）
2. DNS 加 CNAME：`fdc.example.com` → `maydaysuper.github.io`
3. Settings → Pages → Custom domain 填同一个域名并等 HTTPS
4. 再 push 或手动跑一次 Deploy GitHub Pages

没有域名时站点仍是 github.io 路径。
