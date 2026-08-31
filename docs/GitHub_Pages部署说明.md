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
├── requirements.docs.txt                              # 文档构建依赖列表（setup-python 的 pip 缓存 key 依赖该文件）
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

### 2.2 `requirements.docs.txt` 要点

- 作用 1：把文档构建所需的 Python 依赖（`mkdocs`、`mkdocs-material`、`pymdown-extensions`、`pygments`、`mkdocs-minify-plugin`、`mkdocs-glightbox` 等）集中声明，方便**本地一键安装** `pip install -r requirements.docs.txt`。
- 作用 2：供 GitHub Actions 中 `actions/setup-python@v5` 用作 **pip 缓存 key 的输入**。
  - 如果 workflow 只写了 `cache: pip` 但仓库里**没有** `requirements.txt` / `pyproject.toml` / 自定义 `cache-dependency-path`，setup-python 会直接失败：
    > `Error: No file in /home/runner/work/... matched to [**/requirements.txt or **/pyproject.toml]`
  - 本仓库在 workflow 里把 `cache-dependency-path: requirements.docs.txt` 指向本文件后，setup-python 就能正确恢复缓存，不再出现上面的报错。
- 维护建议：升级主题/插件版本时，修改本文件的版本上限（或固定精确版本），本地跑通后再一起推送。

### 2.3 `.github/workflows/deploy-docs.yml` 要点

1. **触发**：
   - `push` 到 `main` / `master`，且文件路径匹配 `docs/**`、`videos/**`、`README.md`、`mkdocs.yml`、`requirements.docs.txt`、`.github/workflows/deploy-docs.yml`；
   - 或在 Actions 面板手动 `Run workflow`。
2. **并发控制**：`concurrency.group: pages` + `cancel-in-progress: true`，避免多跑排队。
3. **权限**：`contents: read` + `pages: write` + `id-token: write`，这是 `actions/deploy-pages` 官方要求的最小权限组合；注意 **GITHUB_TOKEN 的合法作用域列表里没有 `administration`**，所以不应当在 workflow 顶层声明 `permissions.administration`（写了 GitHub 会直接报 `Invalid workflow file: Unexpected value 'administration'`，同时也意味着 configure-pages 的 `enablement: true` 无法靠默认的 GITHUB_TOKEN 生效——首次启用 Pages 仍需管理员手动在 Settings 完成）。
4. **构建步骤**（`build` job）：
   1. `actions/checkout@v7` 拉取代码（兼容 Node 24）；
   2. 把根目录 `README.md` 复制为 `docs/README.md`，把 `videos/` 链接/复制为 `docs/videos/`，并确保 `docs/javascripts/katex.js` 与 `docs/stylesheets/extra.css` 存在（已一并写入仓库，如缺失也会由脚本动态生成）；
   3. `actions/setup-python@v6` 安装 Python 3.12，开启 `pip` 缓存，并通过 `cache-dependency-path: requirements.docs.txt` 告诉 setup-python 用哪个文件生成缓存 key；
   4. `pip install --requirement requirements.docs.txt`（安装的包列表与缓存 key 完全一致，避免依赖漂移）；
   5. 用 `actions/configure-pages@v7` 推断 Pages 的真实 `base_url`；**首次构建前请先手动到 Settings → Pages 把 Source 选为 GitHub Actions**（GITHUB_TOKEN 没有 `administration` 作用域，不能用 `enablement: true` 自动替你开 Pages）；
   6. 调用 `mkdocs build --site-url "${MKDOCS_SITE_URL}/"` 注入正确的站点前缀，避免部署在 `/<repo>/` 子路径时静态资源 404；
   7. 生成 `site/.nojekyll` 禁用 Jekyll；
   8. `actions/upload-pages-artifact@v5` 上传 `site/`（兼容 Node 24）。
5. **部署步骤**（`deploy` job，依赖 `build`）：
   - `actions/deploy-pages@v5` 直接发布，并把部署 URL 写入 `environment.github-pages`（兼容 Node 24）。

> 关于 "Node 20 is being deprecated…running with Node 24 by default"：
> 该提示本身是**信息级**而非错误。如果你仍在用旧版 action（`checkout@v4`、`setup-python@v5`、`configure-pages@v5`、`upload-pages-artifact@v3`、`deploy-pages@v4`），这些旧版本是按 Node 20 构建的，GitHub 在 Runner 层面把它们回退/运行于 Node 24，功能上通常可用，但后续某一天 Node 20 被彻底移除后可能会被强制失败。**最佳做法就是像本仓库一样把上述 action 大版本升级到官方最新**（checkout@v7 / setup-python@v6 / configure-pages@v7 / upload-pages-artifact@v5 / deploy-pages@v5），从根本上消除这条提醒；只有在组织/企业自定义 Runner 环境确实不兼容 Node 24 时，才退而求其次设置 `env.ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` 继续使用 Node 20。

### 2.4 `docs/javascripts/katex.js` 要点

- 挂在 Material 主题提供的 `document$.subscribe(...)` 钩子上，这样 SPA 导航切换页面后公式也会重新渲染；
- 分隔符覆盖 `$ / $$ / \( / \[`；忽略 `<pre>`、`<code>`、`arithmatex` 类，避免双重渲染；
- `throwOnError:false`、`strict:false`、`trust:true`，对不常见命令尽量降级显示而不是报错中断。

### 2.4 `docs/stylesheets/extra.css` 要点

- KaTeX 字号、行间公式横向滚动、深浅色模式符号颜色继承；
- 光箱图片高度限制、代码块自动换行。

---

## 三、在 GitHub 上启用 Pages 的步骤

1. **推送变更**：把本附录提到的新增文件（含根目录新增的 `requirements.docs.txt`）一起 `push` 到仓库的默认分支（`main` 或 `master`）；
   - ⚠️ **必须包含 `requirements.docs.txt`**，否则 `actions/setup-python@v6` 在开启 `cache: pip` 时仍会报 `No file matched to [**/requirements.txt or **/pyproject.toml]`。
2. **配置 Pages 源**（仓库端一次性设置，必做）：
   - 进入仓库 **Settings → Pages**；
   - **Build and deployment → Source**：选择 **GitHub Actions**（不要选 `Deploy from a branch`，那样需要额外维护 `gh-pages` 分支）；
   - **Custom domain** 留空（默认使用 `https://<user>.github.io/<repo>/`），或按需填入自己的域名。
   - ⚠️ **为什么必须手动做这一步？** GitHub Actions 默认的 `GITHUB_TOKEN` 合法权限列表里**没有** `administration` 这个作用域，因此 `actions/configure-pages@v7` 的 `enablement: true` 无法通过普通的 GITHUB_TOKEN 生效；如果要在 workflow 里自动化启用 Pages，需要用一枚带 `repo` / `administration` 权限的 Personal Access Token 或 GitHub App，并显式传入 configure-pages 的 `token` 输入，复杂度显著更高；对于普通仓库，"手动在 Settings 里切一次 Source"是最简单也最稳妥的做法。
3. **给 Actions 授权**：
   - **Settings → Actions → General → Workflow permissions**：选择 **Read and write permissions**；
   - 由于 deploy-pages 官方三件套（`pages:write` + `id-token:write` + `contents:read`）已在 workflow 顶层声明，一般不需要做其他额外修改。
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
pip install --requirement requirements.docs.txt   # 与 CI 使用完全相同的依赖列表

# 资源准备（等同于 workflow 中的 Prepare docs assets 步骤）
if (-not (Test-Path docs\README.md)) { Copy-Item README.md docs\README.md }
if (-not (Test-Path docs\videos))    { cmd /c mklink /J docs\videos videos 2>$null; if (-not (Test-Path docs\videos)) { Copy-Item -Recurse videos docs\videos } }

mkdocs serve
```

然后打开浏览器访问 `http://127.0.0.1:8000`。完成后记得把 `docs/README.md` 和 `docs/videos`（若是复制而非 junction）加入 `.gitignore`，以免和 workflow 动态生成的版本冲突。

---

## 六、排障

### Q1. Actions 报 `Error: No file in /home/runner/work/<repo>/<repo> matched to [**/requirements.txt or **/pyproject.toml]`

- **根因**：`actions/setup-python@v6` 启用了 `cache: pip`，但在仓库中找不到任何 `requirements.txt` / `pyproject.toml` 来生成缓存键，便直接失败；这是 setup-python 的内置校验，不是 `pip install` 自身的报错。
- **修复**（本仓库已应用）：
  1. 在仓库根目录新增 `requirements.docs.txt` 并填入构建依赖；
  2. 在 workflow 的 `setup-python` 步骤中显式指定 `cache-dependency-path: requirements.docs.txt`；
  3. 安装步骤改用 `pip install --requirement requirements.docs.txt`，保证实际安装与缓存 key 一致。

### Q2. 日志里出现 `Node 20 is being deprecated. This workflow is running with Node 24 by default…`

- **本质**：这是 GitHub 给出的**提醒**（warning/info），不是构建失败的直接原因；意思是你当前用的某个 action 还是基于 Node 20 构建的，Runner 为了兼容先"降级/回退"在 Node 24 中跑它。当 Node 20 彻底下架后，这些旧版本 action 可能会被直接禁止执行。
- **最佳修复**（本仓库已应用）：把所有官方 action 升级到明确兼容 Node 24 的大版本：
  - `actions/checkout@v7`
  - `actions/setup-python@v6`
  - `actions/configure-pages@v7`
  - `actions/upload-pages-artifact@v5`
  - `actions/deploy-pages@v5`
- **临时兜底**：如果组织自定义 Runner 暂不支持 Node 24，可在 workflow 顶层加 `env.ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` 继续使用 Node 20。但这只是缓兵之计，不建议长期依赖。

### Q3. `actions/configure-pages@v7` 报 `Error: Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions… Not Found`

- **根因**：仓库还没在 **Settings → Pages** 中启用 Pages（或者 Source 不是 `GitHub Actions`）。`configure-pages` 的默认行为是"只读取 Pages 配置、不做写入"，当 Pages 根本没启用时，REST API 返回 `404 Not Found`，action 就打印上面那段报错。
- **修复（标准做法）**：
  1. 打开仓库 **Settings → Pages**；
  2. **Build and deployment → Source** 选择 **GitHub Actions**；
  3. 回到 Actions 面板重新 **Run workflow** / **Re-run jobs**。
- **关于 `enablement: true`**：`configure-pages@v7` 提供了 `with.enablement` 选项来"自动开启 Pages"，但它要求调用方带一个拥有 `administration` 权限的 token；而 workflow 默认的 `GITHUB_TOKEN` 在顶层 `permissions` 里**根本不存在 `administration` 作用域**（硬写还会被 GitHub 拒绝为 `Invalid workflow file`），因此不能只靠 workflow 默认 token 走这条路。如果你的自动化确实需要 0 人工介入启用 Pages，建议用一枚配置了 `pages:write` + 仓库设置权限的 **GitHub App** 或 **classic PAT**，并作为 `actions/configure-pages@v7.token` 传入；否则手动在 Settings 里切一次 Source 是最省心、也与 GITHUB_TOKEN 权限模型完全匹配的做法。

### Q4. Actions 解析失败：`Invalid workflow file (Line: xx, Col: yy): Unexpected value 'administration'`

- **根因**：在 workflow 顶层 `permissions:` 里写到了 `administration: write/read`，但 GitHub Actions 能识别的作用域列表（actions、checks、contents、deployments、id-token、issues、packages、pages、pull-requests、repository-projects、security-events、statuses、discussions、attestations 等）**不包含 `administration`**；GitHub 会在提交或运行时直接拒掉这份 YAML。
- **修复**：直接从 `permissions` 里删掉 `administration` 字段，回到 deploy-pages 官方推荐的最小三件套：
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write
  ```
  然后按 Q3 中的说明手动去 Settings → Pages 选 Source = GitHub Actions。

### Q5. 同样触发路径，但没有触发 Actions

- 检查 `on.push.paths` 是否覆盖了被改动的文件；如果改的是根目录 `requirements.docs.txt` 之外的 Python 依赖，也要把对应文件路径加入 `on.push.paths`。

### Q6. 页面访问 404（特别是静态资源 `.css`/`.js` 报 404）

- 因为仓库名 Pages 部署在 `https://<user>.github.io/<repo>/` 子路径下，必须让 MkDocs 知道这个前缀。当前 workflow 已通过：
  1. `actions/configure-pages@v7` 拿到正确的 `base_url`；
  2. 调用 `mkdocs build --site-url "${MKDOCS_SITE_URL}/"` 注入；
  因此直接推送即可。如果仍有问题，检查仓库 **Settings → Pages → Custom domain** 是否填错。

### Q7. `mkdocs build --strict` 失败，提示找不到链接目标

- `--strict` 会把所有坏掉的相对链接、缺少的图片当成**构建错误**；
  这通常意味着：
  - 新写了一个 `![](images/a.png)` 但该图片未提交；
  - 或在 `nav:` 里引用了一个不存在的 `.md` 文件名；
  对照报错路径逐一修正即可。
