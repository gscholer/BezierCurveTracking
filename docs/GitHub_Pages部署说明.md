# 附录：GitHub Pages 文档自动部署说明

> 本附录说明本仓库为把 `docs/` 目录下的 Markdown 文档自动构建为静态站点并发布到 **GitHub Pages** 所新增的文件，以及启用步骤。
>
> 说明：按「**总是把回应内容写入合适的文档**」的约定，部署方案的说明也同步保存在本 Markdown 文件（`docs/GitHub_Pages部署说明.md`），以便被 MkDocs 导航收录。

---

## 一、方案总览

| 项目 | 选择 | 理由 |
|---|---|---|
| 静态站点生成器 | **MkDocs + Material for MkDocs** | 原生支持 Markdown 扩展、代码高亮、中文搜索、深色模式、SPA 导航 |
| 数学公式渲染 | **KaTeX**（`pymdownx.arithmatex` generic 模式 + 前端 `renderMathInElement`） | 严格遵循文档中 `$...$` / `$$...$$` 包裹公式的惯例，速度远快于 MathJax |
| CI/CD | **GitHub Actions**（`actions/deploy-pages@v4` 官方推荐流程） | 推送到 `main`/`master` 即自动构建 & 部署；无需维护 gh-pages 分支 |
| 图片资源 | 保留根目录 `videos/`，构建时拷贝/软链到 `docs/videos/` | README 中 `videos/xxx.gif` 等相对链接不需要修改 |

---

## 二、新增文件清单

```
BezierCurveTracking/
├── mkdocs.yml                                         # MkDocs 站点配置（主题、插件、导航、KaTeX）
├── .github/
│   └── workflows/
│       └── deploy-docs.yml                            # GitHub Actions：构建 + 发布到 GitHub Pages
└── docs/
    ├── javascripts/
    │   └── katex.js                                   # KaTeX 自动渲染钩子（配合 document$.subscribe）
    ├── stylesheets/
    │   └── extra.css                                  # 站点样式补丁（深色模式 KaTeX 颜色、光箱等）
    └── GitHub_Pages部署说明.md                        # 本文档
```

### 2.1 `mkdocs.yml` 要点

- **站点语言**：`zh`，适配左侧中文目录与搜索。
- **导航 `nav:`**：手动指定 1 份首页（根目录的 `README.md` 会在 workflow 构建时复制为 `docs/README.md`）+ 1 份「算法深度精读报告」+ 4 个模块的「实现细节」。
- **主题 palette**：日/夜两套配色，一键切换。
- **Markdown 扩展**：
  - `pymdownx.arithmatex(generic:true)` → 把所有 `$…$` / `$$…$$` 原样保留给前端 KaTeX 处理；
  - `pymdownx.superfences` + `mermaid` → 可直接用 ` ```mermaid ` 画图；
  - 其余 `admonition / details / tasklist / tabs / emoji / highlight` 等常用能力全开。
- **插件**：`search` / `minify` / `glightbox`。

### 2.2 `.github/workflows/deploy-docs.yml` 要点

1. **触发**：
   - `push` 到 `main` / `master`，且文件路径匹配 `docs/**`、`videos/**`、`README.md`、`mkdocs.yml`、`.github/workflows/deploy-docs.yml`；
   - 或在 Actions 面板手动 `Run workflow`。
2. **并发控制**：`concurrency.group: pages` + `cancel-in-progress: true`，避免多跑排队。
3. **权限**：遵循 `actions/deploy-pages@v4` 的最小权限模型（`contents: read` + `pages: write` + `id-token: write`）。
4. **构建步骤**（`build` job）：
   1. `actions/checkout@v4` 拉取代码；
   2. 把根目录 `README.md` 复制为 `docs/README.md`，把 `videos/` 链接/复制为 `docs/videos/`，并确保 `docs/javascripts/katex.js` 与 `docs/stylesheets/extra.css` 存在（已一并写入仓库，如缺失也会由脚本动态生成）；
   3. `actions/setup-python@v5` 安装 Python 3.12，开启 `pip` 缓存；
   4. `pip install mkdocs mkdocs-material mkdocs-material-extensions mkdocs-minify-plugin mkdocs-glightbox pymdown-extensions pygments`；
   5. 用 `actions/configure-pages@v5` 推断 Pages 的真实 `base_url`，传给 `mkdocs build --site-url`，避免站点部署在 `/<repo>/` 子路径时静态资源 404；
   6. 生成 `site/.nojekyll` 禁用 Jekyll；
   7. `actions/upload-pages-artifact@v3` 上传 `site/`。
5. **部署步骤**（`deploy` job，依赖 `build`）：
   - `actions/deploy-pages@v4` 直接发布，并把部署 URL 写入 `environment.github-pages`。

### 2.3 `docs/javascripts/katex.js` 要点

- 挂在 Material 主题提供的 `document$.subscribe(...)` 钩子上，这样 SPA 导航切换页面后公式也会重新渲染；
- 分隔符覆盖 `$ / $$ / \( / \[`；忽略 `<pre>`、`<code>`、`arithmatex` 类，避免双重渲染；
- `throwOnError:false`、`strict:false`、`trust:true`，对不常见命令尽量降级显示而不是报错中断。

### 2.4 `docs/stylesheets/extra.css` 要点

- KaTeX 字号、行间公式横向滚动、深浅色模式符号颜色继承；
- 光箱图片高度限制、代码块自动换行。

---

## 三、在 GitHub 上启用 Pages 的步骤

1. **推送变更**：把本附录提到的 5 个新增文件随代码一起 `push` 到仓库的默认分支（`main` 或 `master`）。
2. **配置 Pages 源**（仓库端一次性设置）：
   - 进入仓库 Settings → **Pages**；
   - **Build and deployment → Source**：选择 **GitHub Actions**（不要选 `Deploy from a branch`，那样需要额外维护 `gh-pages` 分支）；
   - **Custom domain** 留空（默认使用 `https://<user>.github.io/<repo>/`），或按需填入自己的域名。
3. **给 Actions 授权**：
   - Settings → **Actions → General** → 确认 **Workflow permissions** 选的是 **Read and write permissions**，或至少允许 `pages:write` + `id-token:write`（上面 workflow 里的 `permissions:` 已经按最小权限声明，一般不需要额外改）。
4. **手动触发一次**：
   - Actions → 选择 **Deploy Docs to GitHub Pages** → **Run workflow**；
   - 成功后，GitHub 页面顶部会出现 "Deployed to github-pages" 绿色提示，链接即为最终站点地址。

---

## 四、新增/修改文档时需要注意的约定

### 4.1 数学公式

按仓库既有规范，数学公式**必须**使用美元符号包裹：

```markdown
这是行内公式：$\theta_{max} = \arctan({L \over R_{min}})$

这是行间公式：

$$
P = (1-\lambda)^3 P_0 + 3(1-\lambda)^2\lambda P_1 + 3(1-\lambda)\lambda^2 P_2 + \lambda^3 P_3
$$
```

- `$...$` 行内公式：不要在 `$` 前后同时出现空格（例如 `$ a $` 容易被识别成美元符号而非公式）；
- `$$...$$` 行间公式：建议单独成行，不要跟正文混写。

### 4.2 图片/媒体路径

- Markdown 中引用 `videos/` 下的演示图，请**仍然写相对路径** `videos/xxx.gif`。
  workflow 会把 `videos/` 映射到 `docs/videos/`，构建时 MkDocs 会原样拷贝。
- 新增文件时如果放在仓库的新目录（例如 `images/`），请同步修改 workflow 中 "Prepare docs assets" 那一步，把该目录也链接到 `docs/`。

### 4.3 导航收录

- 新增 `.md` 到 `docs/` 目录后，默认**不会**自动出现在左侧目录，需要打开 `mkdocs.yml`，在 `nav:` 下按层级补充条目。
- 如果更想要"零配置自动发现"，可改用 [`mkdocs-awesome-pages-plugin`](https://github.com/lukasgeiter/mkdocs-awesome-pages-plugin) 或直接写通配脚本；当前选择**手动维护导航**是为了保证顺序稳定且模块名称可控。

---

## 五、本地预览

如果你想在推送前验证页面渲染效果：

```powershell
# （Windows PowerShell，建议 Python 3.10+）
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install mkdocs mkdocs-material mkdocs-material-extensions mkdocs-minify-plugin mkdocs-glightbox pymdown-extensions pygments

# 资源准备（等同于 workflow 中的 Prepare docs assets 步骤）
if (-not (Test-Path docs\README.md)) { Copy-Item README.md docs\README.md }
if (-not (Test-Path docs\videos))    { cmd /c mklink /J docs\videos videos 2>$null; if (-not (Test-Path docs\videos)) { Copy-Item -Recurse videos docs\videos } }

mkdocs serve
```

然后打开浏览器访问 `http://127.0.0.1:8000`。完成后记得把 `docs/README.md` 和 `docs/videos`（若是复制而非 junction）加入 `.gitignore`，以免和 workflow 动态生成的版本冲突。
