# my-profile

一个可直接部署到 **Cloudflare Pages** 的 Linktree 风格个人展示页（纯 HTML / CSS / JS）。

在线效果：部署到 Cloudflare Pages 后，你会获得一个 `*.pages.dev` 域名。

## 功能

- 响应式布局：手机 / 平板 / 桌面均可正常显示
- 自动深浅色模式：跟随系统设置（`prefers-color-scheme`）
- 动画与交互：入场动画、链接卡片悬停动效、头像微视差效果
- 背景效果：波浪背景动画、星星闪烁（桌面端鼠标交互 / 移动端自动）
- 暗色模式：夜间海洋风格（夜光虫配色）
- 可访问性：支持 `prefers-reduced-motion`（减少动态效果）
- 内置小游戏：Flappy Kaho（默认展开显示）
- SEO：基础 meta + Open Graph + Twitter Card

## 目录结构

```text
.
├── index.html    # 页面结构与内容
├── styles.css    # 样式、主题、响应式
├── script.js     # 交互逻辑（入场动画/视差）
├── game.js       # Flappy Kaho 游戏逻辑
├── i18n.js       # 多语言切换逻辑
├── locales/      # zh/en/ja 文案
├── avatar.jpg    # 头像（请保持文件名不变，或同步改 index.html）
└── kaho-origin_pixel_art.png # 游戏角色像素图
```

## 本地预览

在项目根目录运行：

```bash
python -m http.server 4173
```

建议使用 HTTP server 预览（不要用 `file://` 直接打开），避免相对资源加载不一致。

然后访问：

```text
http://localhost:4173
```

## Flappy Kaho 操作

- 开始游戏：点击/触摸游戏画布，或按空格。
- 飞行：游戏进行中点击/触摸画布，或按空格。
- 重新开始：游戏结束后再次点击/触摸画布，或按空格（页面也会显示“重新开始”按钮作为备用入口）。

> 如果系统开启了“减少动态效果”（`prefers-reduced-motion`），游戏会默认暂停并提示你手动启用。

## 部署到 Cloudflare Pages

1. 将本仓库推送到 GitHub
2. Cloudflare Dashboard → **Pages** → **Create a project** → **Connect to Git**
3. 选择该仓库
4. 构建设置：
   - Framework preset：**None**
   - Build command：留空
   - Build output directory：`.`（推荐；仓库根目录）
5. 点击 **Save and Deploy**

部署完成后 Cloudflare 会提供一个 `*.pages.dev` 域名。

## 自定义内容

- 修改社交链接 / 文案：编辑 `index.html`
- 修改配色与动画：编辑 `styles.css`
- 修改交互逻辑：编辑 `script.js`
- 修改游戏逻辑：编辑 `game.js`
- 修改多语言文案：编辑 `locales/*.json`

## 依赖

- [Font Awesome](https://fontawesome.com/)（通过 CDN 引入，用于社交平台图标）
