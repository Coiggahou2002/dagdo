# depdo — 基于 DAG 的 CLI TODO 管理工具

## Context

用图结构管理任务依赖的 CLI 工具。核心场景：任务之间有依赖关系，需要像拓扑排序一样找到当前可执行的任务（入度为 0 的节点）。用 TypeScript + Bun 开发，`bun build --compile` 产出独立二进制。

## 项目结构

```
depdo/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # 入口，解析 argv，分发到子命令
│   ├── types.ts            # 类型定义
│   ├── ids.ts              # 短 ID 生成 + 前缀匹配
│   ├── storage.ts          # 读写 ~/.depdo/data.json
│   ├── format.ts           # 终端输出格式化（颜色、表格）
│   ├── graph/
│   │   ├── dag.ts          # DAG 操作：邻接表构建、环检测
│   │   ├── topo.ts         # 拓扑排序、入度为 0 查询
│   │   └── render.ts       # ASCII 渲染 DAG
│   └── commands/
│       ├── add.ts          # depdo add
│       ├── remove.ts       # depdo rm
│       ├── edit.ts         # depdo edit
│       ├── list.ts         # depdo list / ls
│       ├── done.ts         # depdo done
│       ├── next.ts         # depdo next
│       ├── link.ts         # depdo link（加依赖边）
│       ├── unlink.ts       # depdo unlink（删依赖边）
│       └── graph.ts        # depdo graph（可视化）
├── tests/
│   ├── dag.test.ts
│   ├── topo.test.ts
│   └── storage.test.ts
└── scripts/
    └── build.sh
```

## 数据模型

```typescript
type TaskId = string;  // 6 位 hex，如 "a3f1b2"
type Priority = "low" | "med" | "high";

interface Task {
  id: TaskId;
  title: string;
  priority: Priority;
  tags: string[];
  createdAt: string;   // ISO 8601
  doneAt: string | null;
}

// from 完成后才能做 to
interface Edge { from: TaskId; to: TaskId; }

interface GraphData {
  version: 1;
  tasks: Task[];
  edges: Edge[];
}
```

存储位置：`~/.depdo/data.json`，平铺的 JSON，人类可读。

## CLI 命令设计

| 命令 | 用途 | 示例 |
|------|------|------|
| `add <title> [--priority high\|med\|low] [--tag <t>] [--after <id>] [--before <id>]` | 添加任务 | `depdo add "设计 API" --priority high --tag backend` |
| `rm <id> [--force]` | 删除任务及相关边 | `depdo rm a3f` |
| `edit <id> [--title] [--priority] [--tag] [--untag]` | 修改任务 | `depdo edit a3f --priority low` |
| `list [--all\|--done] [--tag <t>]` | 列出任务 | `depdo list --tag work` |
| `done <id> [--force]` | 标记完成，打印新解锁的任务 | `depdo done a3f` |
| `next [--limit <n>]` | 显示入度为 0 的任务（可以做的） | `depdo next` |
| `link <from> <to>` | 加依赖边，带环检测 | `depdo link a3f c7e` |
| `unlink <from> <to>` | 删依赖边 | `depdo unlink a3f c7e` |
| `graph [--all]` | ASCII 可视化 DAG | `depdo graph` |

ID 支持前缀匹配：输入 `a3f` 即可，不需要完整 ID。

## 核心算法

**环检测（link 时）**：从 `to` 节点 BFS 沿 outEdges 方向搜索，如果能到达 `from`，则会产生环，拒绝添加。

**入度为 0 查询（next 命令）**：遍历活跃任务，过滤出 inEdges 为空的节点，按优先级 > 创建时间排序。

**ASCII 渲染（graph 命令）**：基于拓扑层级的分层渲染，每个根节点展开为树形，DAG 中多父节点用引用标记。

## 依赖

- **picocolors**（3.8kB）— 终端颜色
- **@types/bun** — 开发时类型
- 参数解析用 Bun 内置的 `util.parseArgs`，无需外部库

## 实现顺序

### Phase 1: 基础骨架
1. 初始化项目（package.json, tsconfig.json）
2. `types.ts` — 数据模型
3. `ids.ts` — ID 生成 + 前缀匹配
4. `storage.ts` — JSON 读写
5. `cli.ts` — 入口 + 命令分发
6. `format.ts` — 输出格式化

### Phase 2: 基本 CRUD
7. `commands/add.ts`
8. `commands/list.ts`
9. `commands/remove.ts`
10. `commands/edit.ts`
11. `commands/done.ts`（暂不检查依赖）

### Phase 3: 图操作
12. `graph/dag.ts` — 邻接表 + 环检测
13. `graph/topo.ts` — 拓扑排序 + 入度查询
14. `commands/link.ts` + `commands/unlink.ts`
15. 更新 `done.ts` 加依赖检查
16. `commands/next.ts`
17. 更新 `list.ts` 显示依赖数

### Phase 4: 可视化 + 收尾
18. `graph/render.ts` — ASCII DAG 渲染
19. `commands/graph.ts`
20. help 文本
21. `scripts/build.sh`
22. 测试

## 验证方式

```bash
# 开发时运行
bun run src/cli.ts add "任务A" --priority high
bun run src/cli.ts add "任务B" --after <A的id>
bun run src/cli.ts next        # 应只显示任务A
bun run src/cli.ts done <A的id> # 应提示任务B被解锁
bun run src/cli.ts graph       # 可视化

# 测试
bun test

# 编译
bash scripts/build.sh
./depdo next
```
