# WARDOGS 火力诸元

网页版火力诸元 + 运输账本。

## 发给朋友（国内直连）

https://testingcf.jsdelivr.net/gh/maydaysuper/wardogs-fdc-web@gh-pages/index.html

这是 jsDelivr 国内节点，走仓库已发布的静态站，不用梯子、不用备案、不用开云账号。

备用镜像：

- https://cdn.jsdmirror.com/gh/maydaysuper/wardogs-fdc-web@gh-pages/index.html
- 海外 GitHub Pages：https://maydaysuper.github.io/wardogs-fdc-web/

## 自定义域名

1. 在仓库 Settings → Secrets and variables → Actions → Variables 新建 `CUSTOM_DOMAIN`（例如 `fdc.example.com`）
2. DNS 加 CNAME：`fdc.example.com` → `maydaysuper.github.io`
3. Settings → Pages → Custom domain 填同一个域名并等 HTTPS
4. 再 push 或手动跑一次 Deploy GitHub Pages

阿里云 OSS / 腾讯云 COS 仍可用，步骤见 [国内部署.md](./国内部署.md)。国内分享优先用上面的 jsDelivr 链接。
