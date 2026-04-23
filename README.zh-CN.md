# dagdo

[English](README.md) | 中文

依赖感知的任务管理器。任务构成一个 DAG（有向无环图）——拓扑排序告诉你下一步该做什么。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/hero-dark.svg">
  <img alt="dagdo graph" src="docs/hero.svg">
</picture>

大多数待办工具把任务当作扁平列表。但真实的工作存在依赖关系：测试没跑完就不能部署，API 没写好就不能测试。**dagdo** 把任务建模为一张图，始终告诉你当前哪些任务可以立即开始（入度为零的节点）。

---

## 给人类用户

### 特性

- **依赖图** — 用 `dagdo link` 关联任务，自动拒绝成环
- **下一步做什么？** — `dagdo next` 显示所有无未完成前置的任务（拓扑排序）
- **智能完成** — `dagdo done` 会告诉你哪些任务刚被解除阻塞
- **备注** — 给任务附加纯文本备注（验收标准、链接、上下文等）
- **可视化** — ASCII 树、Mermaid 语法，或 PNG/SVG 图片（`--dot` 使用 Graphviz）
- **Web 视图** — `dagdo ui` 打开一个支持实时更新的交互式图编辑器
- **云同步** — `dagdo sync` 通过任意 git 远端在多台机器间同步任务
- **优先级和标签** — 按你关心的维度过滤和排序
- **ID 前缀匹配** — 输入 `a3f` 即可代替完整的 `a3f1b2`
- **明暗主题** — Web 视图跟随系统主题（也可手动切换）
- **单文件二进制** — 编译为独立可执行文件，无需运行时

### 安装

#### npm

```bash
npm install -g @coiggahou2002/dagdo
```

#### 从源码构建（需要 [Bun](https://bun.sh)）

```bash
git clone https://github.com/Coiggahou2002/dagdo.git
cd dagdo
bun install
bun run build   # 生成 ./dagdo 二进制文件
```

#### 预编译二进制

从 [GitHub Releases](https://github.com/Coiggahou2002/dagdo/releases) 下载。

### 快速开始

```bash
# 添加任务
dagdo add "设计数据库 schema" --priority high --tag backend
dagdo add "实现 API" --tag backend
dagdo add "构建前端" --tag frontend
dagdo add "集成测试"

# 添加依赖关系（使用 ID 前缀）
dagdo link <design-id> --before <api-id>       # 设计必须在 API 之前完成
dagdo link <design-id> --before <frontend-id>  # 设计必须在前端之前完成
dagdo link <api-id> --before <testing-id>      # API 必须在测试之前完成
dagdo link <frontend-id> --before <testing-id> # 前端必须在测试之前完成

# 现在能做什么？
dagdo next
# a3f1b2  HIGH  设计数据库 schema [backend]

# 完成一个任务
dagdo done <design-id>
# Done a3f1b2  设计数据库 schema
#   Unblocked: b2c3d4  实现 API
#   Unblocked: e5f6a7  构建前端

# 查看依赖图
dagdo graph              # 终端内 ASCII 树
dagdo graph --mermaid    # Mermaid 语法（粘贴到 GitHub/Notion）
dagdo graph --all --png graph.png  # 包含已完成任务的 PNG 图
```

### 命令一览

| 命令 | 说明 |
|------|------|
| `dagdo add <title>` | 添加任务（`--priority`、`--tag`、`--after`、`--before`） |
| `dagdo done <id>` | 标记完成，显示新解除阻塞的任务 |
| `dagdo next` | 显示可以开始的任务（入度 = 0） |
| `dagdo list` | 列出所有活跃任务及阻塞数 |
| `dagdo link <id> --before <other>` | 添加依赖边（自动环检测） |
| `dagdo unlink <id> <other>` | 移除依赖边（方向无关） |
| `dagdo graph` | 可视化 DAG（`--mermaid`、`--png <file>`、`--dot`、`--all`） |
| `dagdo edit <id>` | 编辑任务（`--title`、`--priority`、`--tag`、`--untag`、`--note`、`--clear-note`） |
| `dagdo rm <id>` | 删除任务及其关联边 |
| `dagdo view` | 渲染完整图为 SVG 并在浏览器中打开 |
| `dagdo ui` | 交互式 Web 视图，支持实时更新和图编辑 |
| `dagdo status` | 总览：总数、已完成、就绪、阻塞 |
| `dagdo sync init <url>` | 配置 git 远端云同步 |
| `dagdo sync` | 同步全局任务（快进式；冲突时报错） |
| `dagdo sync status` | 查看同步状态（领先/落后/分叉） |
| `dagdo upgrade` | 检查更新并升级 |
| `dagdo help` | 显示帮助 |
| `dagdo --version` | 打印版本号 |

#### ID 前缀匹配

每个任务有一个 6 位十六进制 ID（如 `a3f1b2`）。可以使用任意唯一前缀：

```bash
dagdo done a3f    # 匹配 a3f1b2
dagdo done a      # 如果只有一个 ID 以 "a" 开头，也能匹配
```

### 可视化

```bash
# ASCII 树（默认）
dagdo graph

# Mermaid（复制到 GitHub issue、Notion 等）
dagdo graph --mermaid

# 通过 Mermaid 生成 PNG 或 SVG（需要 mermaid-isomorphic 和 playwright）
dagdo graph --png output.png
dagdo graph --png output.svg
dagdo graph --all --png full.png   # 包含已完成任务（灰显）
dagdo graph --png output.png --dot # 改用 Graphviz
```

### 数据存储

任务存储在 `~/.dagdo/data.json` —— 一个跨所有项目的用户级待办列表。如需跨设备同步，请参阅下一节。

### Web 视图

`dagdo ui` 在 `http://localhost:3737` 启动本地 HTTP 服务器，打开浏览器，渲染交互式任务图。其他终端的 CLI 变更会在一秒内同步到浏览器；浏览器中也可以编辑：拖拽节点重新排列、从一个节点的底部手柄拖到另一个节点的顶部手柄创建依赖（服务端环检测，冲突时弹出 toast 提示）、选中节点或边按 `Delete` 删除、双击节点标题重命名、点击标题栏的 **+ New task** 按钮添加任务。点击节点打开一个紧凑的浮层面板——可重命名、修改优先级、增删标签、编写纯文本备注（最多 2000 字符）、标记完成。支持亮色、暗色和跟随系统三种主题。

**画布快捷键：**

- **Space + 左键拖拽** — 平移画布（按住时显示抓手光标；借鉴自 Figma/Sketch）
- **Option + 点击**（macOS）/ **Alt + 点击**（其他平台）空白区域 — 在点击位置创建新任务
- **Esc** — 关闭浮层面板

```bash
dagdo ui                  # 默认端口 3737，自动打开浏览器
dagdo ui --port 8080      # 指定端口
dagdo ui --no-open        # 不自动打开浏览器——适用于远程/SSH 场景
```

端口冲突时自动递增（如第二个实例会使用 3738）。`Ctrl+C` 停止服务。

### 云同步（可选）

如果你在多台设备上使用 dagdo，可以通过任意 git 远端同步任务（GitHub、GitLab、自建——只要你有就行）。

**前提：** 本地安装了 `git`，且有一个你能推送的空的（或已有 dagdo 数据的）远端仓库。认证方式沿用你的 git 配置（SSH 密钥、credential helper 等）——dagdo 不会碰你的凭据。

```bash
# 在第一台设备上（已有任务）
dagdo sync init git@github.com:you/my-dagdo-tasks.git
# → 将本地任务推送到远端

# 在第二台设备上（全新安装）
dagdo sync init git@github.com:you/my-dagdo-tasks.git
# → 从远端克隆到 ~/.dagdo/

# 日常使用：改完后同步
dagdo sync
# → 快进推送（或拉取，如果远端更新）

# 查看同步状态
dagdo sync status
```

**模型。** 同步假设单用户、同一时间只在一台设备上操作。每次 dagdo 写入都会自动本地提交；`dagdo sync` 以快进方式推送或拉取。如果两端分叉（你在两台设备上都做了修改但没有同步），dagdo 会拒绝合并并要求你明确选择：

```bash
dagdo sync --accept-local    # 保留本地，覆盖远端
dagdo sync --accept-remote   # 保留远端，覆盖本地
```

---

## 给 AI Agent

dagdo 附带一个 [Claude Code](https://claude.ai/code) 技能，让 AI Agent 可以通过 CLI 管理任务。Agent 会将工作分解为任务、关联依赖，并使用 `dagdo next` 推荐下一步——全程自然语言交互。

### 安装技能

```bash
cp -r skills/dagdo ~/.claude/skills/dagdo
```

### 用法

只需描述你的工作，Agent 会处理剩下的：

- *"帮我把 API 重构拆成 dagdo 任务"* — 分解工作、创建任务、关联依赖
- *"我下一步该做什么？"* — 执行 `dagdo next`，按优先级推荐
- *"数据库迁移做完了"* — 找到对应任务、标记完成、汇报解除阻塞的任务
- *"提醒我找 Jack 要服务器凭据"* — 快速创建一条任务

完整命令参考、存储细节和交互指南见 [`skills/dagdo/SKILL.md`](skills/dagdo/SKILL.md)。

## 许可证

MIT
