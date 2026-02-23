# 赛博名片收集册 — 后端部署指南

这份指南会带你从零开始，把名片收集册的后端（Cloudflare Worker + R2 存储）部署上线，并连接到前端页面。

## 你需要准备什么

在开始之前，确认你有以下这些：

| 准备项 | 说明 |
|--------|------|
| Cloudflare 账号 | 免费注册即可，到 [dash.cloudflare.com](https://dash.cloudflare.com) 注册 |
| Node.js 18+ | 到 [nodejs.org](https://nodejs.org) 下载 LTS 版本 |
| 终端 / 命令行 | macOS 用 Terminal，Windows 用 PowerShell 或 Git Bash |

确认 Node.js 安装成功：

```bash
node --version
```

看到类似 `v18.x.x` 或更高版本的输出就没问题。

## 第一步：安装 Wrangler CLI

Wrangler 是 Cloudflare 官方的命令行工具，用来管理 Worker 和 R2。

```bash
npm install -g wrangler
```

安装完成后确认一下：

```bash
wrangler --version
```


## 第二步：登录 Cloudflare

在终端运行：

```bash
wrangler login
```

浏览器会自动打开 Cloudflare 的授权页面。点击 **Allow** 授权 Wrangler 访问你的账号。

回到终端，看到 `Successfully logged in` 就表示登录成功了。

> 如果浏览器没有自动打开，手动复制终端里显示的 URL 到浏览器打开。

## 第三步：创建 R2 存储桶

R2 是 Cloudflare 的对象存储服务，用来存放访客上传的名片图片。免费额度每月 10GB 存储 + 1000 万次读取，个人站点完全够用。

```bash
wrangler r2 bucket create cardbook-cards
```

看到类似这样的输出就成功了：

```
Created bucket cardbook-cards with default storage class of Standard.
```

这个桶的名字 `cardbook-cards` 和 `wrangler.toml` 里的 `bucket_name` 对应，不要改动。

## 第四步：部署 Worker

进入 `worker` 目录并部署：

```bash
cd worker
wrangler deploy
```

部署成功后，终端会输出你的 Worker URL，类似：

```
Published cardbook-api (x.xx sec)
  https://cardbook-api.<你的子域名>.workers.dev
```

**把这个 URL 记下来**，下一步要用。


## 第五步：把 Worker URL 填入前端

打开项目根目录的 `cardbook.js`，找到第 9 行：

```js
const API_BASE = '';
```

把空字符串替换成你的 Worker URL（注意末尾不要带斜杠 `/`）：

```js
const API_BASE = 'https://cardbook-api.你的子域名.workers.dev';
```

保存文件，重新部署前端页面（推送到 Git 或手动上传到 Cloudflare Pages）。

## 第六步：配置 CORS 允许的域名

默认情况下，Worker 接受来自任何域名的请求（`Access-Control-Allow-Origin: *`）。上线后建议限制为你自己的域名。

打开 `worker/wrangler.toml`，把最后几行的注释去掉：

```toml
[vars]
ALLOWED_ORIGIN = "https://your-site.pages.dev"
```

把 `https://your-site.pages.dev` 替换成你的实际域名，比如 `https://sallyn.top`。

然后重新部署 Worker：

```bash
cd worker
wrangler deploy
```

> 如果你有多个域名需要允许（比如 `sallyn.top` 和 `www.sallyn.top`），目前代码只支持单个域名。你可以在 `worker/src/index.js` 里修改 CORS 逻辑来支持多个。

## 第七步：验证部署是否成功

用 curl 或浏览器测试 API 端点。

**测试列表接口：**

```bash
curl https://cardbook-api.你的子域名.workers.dev/api/cards?limit=9
```

应该返回：

```json
{"cards":[],"cursor":null,"hasMore":false}
```

空数组是正常的，因为还没有人上传名片。

**测试上传接口：**

准备一张测试图片，然后：

```bash
curl -X POST \
  https://cardbook-api.你的子域名.workers.dev/api/cards \
  -F "image=@test-card.jpg" \
  -F "orientation=landscape"
```

应该返回类似：

```json
{"id":"m1abc-x2y3z4","key":"cards/m1abc-x2y3z4.jpg","orientation":"landscape"}
```

**测试图片访问：**

把上一步返回的 `key` 拼到 URL 里：

```bash
curl -I https://cardbook-api.你的子域名.workers.dev/api/cards/image/cards/m1abc-x2y3z4.jpg
```

应该返回 `200 OK` 和 `Content-Type: image/jpeg`。


## 可选：配置速率限制防滥用

上传接口是公开的，任何人都可以调用。虽然代码里已经有 2MB 文件大小限制和图片类型校验，但建议额外配置 Cloudflare 的速率限制来防止恶意刷接口。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入你的 Workers 域名（`你的子域名.workers.dev`）
3. 左侧菜单找到 **Security** → **WAF**
4. 点击 **Rate limiting rules** → **Create rule**
5. 配置规则：
   - **Rule name**: `Card upload rate limit`
   - **If incoming requests match**: URI Path equals `/api/cards` AND Request Method equals `POST`
   - **Rate**: 5 requests per 1 minute
   - **Action**: Block
6. 点击 **Deploy**

这样每个 IP 每分钟最多只能上传 5 张名片。

> 速率限制是 Cloudflare 免费套餐自带的功能，不需要额外付费。

## 可选：自定义 Worker 域名

默认的 `xxx.workers.dev` 域名可以直接用，但如果你想用自己的子域名（比如 `api.sallyn.top`），可以这样配置：

1. 在 Cloudflare Dashboard 里确保你的域名已经添加并激活
2. 打开 `worker/wrangler.toml`，添加路由配置：

```toml
routes = [
  { pattern = "api.你的域名.com/api/*", zone_name = "你的域名.com" }
]
```

3. 重新部署：

```bash
cd worker
wrangler deploy
```

4. 记得同步更新 `cardbook.js` 里的 `API_BASE` 为新域名。

## 架构概览

部署完成后，整体数据流是这样的：

```
访客浏览器
  │
  ├─ GET /api/cards          → Worker → R2.list()     → 返回名片列表
  ├─ POST /api/cards         → Worker → R2.put()      → 存储名片图片
  └─ GET /api/cards/image/*  → Worker → R2.get()      → 返回图片（带缓存头）
```

- 图片存储在 R2，元数据（方向、上传时间）存在 R2 对象的 `customMetadata` 里
- 不需要数据库，R2 的 `list()` API 自带分页和元数据内联返回
- 图片响应带 `Cache-Control: public, max-age=31536000, immutable`，CDN 会自动缓存

## 常见问题

### `wrangler deploy` 报错 "bucket not found"

确认你已经创建了 R2 存储桶：

```bash
wrangler r2 bucket list
```

输出里应该有 `cardbook-cards`。如果没有，回到第三步重新创建。

### 上传成功但前端看不到名片

检查 `cardbook.js` 里的 `API_BASE` 是否正确设置，末尾不要带 `/`。打开浏览器开发者工具的 Network 面板，看看 `/api/cards` 请求是否返回了数据。

### CORS 报错

如果浏览器控制台出现 `Access-Control-Allow-Origin` 相关错误，说明 `wrangler.toml` 里的 `ALLOWED_ORIGIN` 和你的前端域名不匹配。确认域名完全一致（包括 `https://` 前缀，不带末尾 `/`）。

开发阶段可以先注释掉 `ALLOWED_ORIGIN`（让它默认为 `*`），上线后再限制。

### 想删除某张名片

目前没有删除接口。你可以用 Wrangler 手动删除 R2 里的对象：

```bash
wrangler r2 object delete cardbook-cards/cards/要删除的文件名.webp
```

或者登录 Cloudflare Dashboard，在 **R2** → **cardbook-cards** 里手动删除。


