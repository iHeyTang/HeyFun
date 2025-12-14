# Agents 架构文档

## 概述

Agents 模块采用三层架构设计，实现了 Agent 框架、预设场景和工具实现的解耦。整体架构分为三个核心模块：**core（核心层）**、**presets（预设层）** 和 **toolboxes（工具包层）**。

## 架构分层

### 1. Core（核心层）

核心层维护框架基础设施和微代理系统，为上层提供基础能力。

#### 1.1 Frameworks（框架层）

**位置**：`core/frameworks/`

**职责**：
- 提供 Agent 基础框架和抽象接口
- 实现 ReAct（Reasoning + Acting）循环框架
- 管理 Agent 注册表

**主要组件**：
- **base**：定义 `AgentConfig`、`IAgent` 接口和 `BaseAgent` 抽象基类
- **react**：实现 `ReactAgent` 框架，提供 ReAct 循环的流式执行能力
- **registry**：实现 `AgentRegistry`，管理所有注册的 Agent 实例

**特点**：
- 框架层不关心具体业务场景
- 提供可继承的基类，供预设层扩展
- 支持流式响应和工具调用

#### 1.2 Micro-Agents（微代理系统）

**位置**：`core/micro-agents/`

**职责**：
- 管理轻量级、专门化的微代理
- 在特定时机触发微代理执行
- 支持意图检测、场景分析等辅助功能

**主要组件**：
- **types**：定义微代理的类型系统（`MicroAgentContext`、`MicroAgentResult`、`MicroAgentTrigger` 等）
- **manager**：实现 `MicroAgentManager`，负责注册、调度和执行微代理
- **intent-detector-agent**：意图检测微代理示例

**触发时机**：
- `PRE_ITERATION`：每次迭代前
- `POST_ITERATION`：每次迭代后
- `PRE_TOOL_CALL`：工具调用前
- `POST_TOOL_CALL`：工具调用后
- `PRE_FINAL_ANSWER`：最终答案生成前
- `ON_DEMAND`：按需触发
- `INITIALIZATION`：初始化时

#### 1.3 Tools（工具抽象层）

**位置**：`core/tools/`

**职责**：
- 定义工具系统的抽象接口和类型
- 提供工具注册表基类
- 区分工具定义和工具实现

**主要组件**：
- **tool-definition**：定义 `ToolDefinition` 接口，包含工具名称、描述、参数 Schema、运行时环境等元数据
- **tool-implementation**：定义 `ToolImplementation` 接口，描述工具执行逻辑
- **base-tool-registry**：提供 `BaseToolbox` 基类，实现工具注册和执行的基础功能

**运行时环境**：
- `SERVER`：服务端运行，需要 API、数据库等服务端资源
- `CLIENT`：客户端运行，需要用户确认、浏览器数据/运行时等

### 2. Presets（预设层）

预设层定义各类场景的 Agent 配置和工具 Schema，不关心具体工具的实现。

#### 2.1 职责

- 定义特定场景的 Agent（继承自 core 框架）
- 配置 Agent 的系统提示词和工作流程
- 定义 Agent 需要的工具 Schema（`ToolDefinition`）
- 不实现具体工具逻辑，只声明工具接口

#### 2.2 结构

**位置**：`presets/`

每个预设 Agent 包含：
- **index.ts**：Agent 类定义，继承自 `ReactAgent` 或其他框架
- **tools/**：工具定义目录，包含该 Agent 需要的所有工具 Schema

#### 2.3 现有预设

**General Agent**（`presets/general/`）
- 通用智能助手
- 基于 ReAct 框架
- 不包含特定领域工具

**Coordinator Agent**（`presets/coordinator/`）
- 工作流协调者
- 支持工作流创建、编辑和管理
- 包含画布操作相关的工具定义：
  - `edit_flow_canvas`：编辑工作流画布
  - `get_canvas_state`：获取画布状态
  - `get_canvas_capabilities`：获取画布能力
  - `get_node_type_info`：获取节点类型信息
  - `auto_layout_canvas`：自动布局
  - `run_canvas_workflow`：执行工作流

### 3. Toolboxes（工具包层）

工具包层负责实现 presets 中定义的工具，在对应环境通过注册的形式注入并启用。

#### 3.1 职责

- 实现 presets 层定义的工具 Schema
- 提供工具执行逻辑
- 在特定环境（客户端/服务端）注册工具
- 管理工具执行上下文

#### 3.2 结构

**位置**：`toolboxes/`

每个工具包包含：
- **index.ts**：工具注册表实例，注册该工具包的所有工具实现
- **context.ts**：定义工具执行上下文类型
- **tools/**：工具实现目录，每个工具对应一个实现文件
- **utils.ts**：工具包共用的工具函数

#### 3.3 现有工具包

**Canvas Toolbox**（`toolboxes/canvas-toolbox/`）
- 实现 Coordinator Agent 所需的画布操作工具
- 客户端工具包，需要浏览器环境
- 提供画布引用、状态管理等上下文
- 实现工具：
  - `auto_layout_canvas`：自动布局实现
  - `edit_flow_canvas`：编辑画布实现
  - `get_canvas_capabilities`：获取画布能力实现
  - `get_canvas_state`：获取画布状态实现
  - `get_node_type`：获取节点类型实现
  - `run_canvas_workflow`：执行工作流实现

## 工作流程

### Agent 注册流程

1. **Core 层**：提供框架和基础设施
2. **Presets 层**：定义 Agent 类和工具 Schema
3. **Toolboxes 层**：实现工具逻辑并注册
4. **入口文件**（`index.ts`）：注册所有预设 Agent 到注册表

### 工具调用流程

1. **Presets 层**：Agent 配置工具 Schema，LLM 根据 Schema 决定调用哪个工具
2. **Toolboxes 层**：工具注册表根据工具名称找到对应的实现
3. **执行**：在对应环境（客户端/服务端）执行工具实现
4. **返回**：工具结果返回给 Agent，继续 ReAct 循环

## 设计原则

### 1. 关注点分离

- **Core**：框架和基础设施
- **Presets**：业务场景和工具接口
- **Toolboxes**：工具实现和环境适配

### 2. 解耦设计

- Presets 层不依赖 Toolboxes 层的具体实现
- 工具定义（Schema）与工具实现分离
- 通过注册机制实现动态绑定

### 3. 可扩展性

- 新增场景：在 Presets 层添加新的 Agent 预设
- 新增工具：在 Presets 层定义 Schema，在 Toolboxes 层实现
- 新增框架：在 Core 层扩展框架能力

### 4. 环境适配

- 通过 `ToolRuntime` 区分客户端和服务端工具
- 工具包根据运行环境提供不同的上下文
- 支持跨环境工具调用

## 目录结构

```
agents/
├── core/                    # 核心层
│   ├── frameworks/         # 框架层
│   │   ├── base/          # 基础接口和抽象类
│   │   ├── react/         # ReAct 框架实现
│   │   └── registry.ts    # Agent 注册表
│   ├── micro-agents/      # 微代理系统
│   │   ├── types.ts       # 类型定义
│   │   ├── manager.ts     # 微代理管理器
│   │   └── intent-detector-agent.ts  # 意图检测微代理
│   └── tools/             # 工具抽象层
│       ├── tool-definition.ts      # 工具定义接口
│       ├── tool-implementation.ts # 工具实现接口
│       └── base-tool-registry.ts   # 工具注册表基类
├── presets/                # 预设层
│   ├── general/           # 通用 Agent
│   │   └── index.ts
│   └── coordinator/       # 协调者 Agent
│       ├── index.ts
│       └── tools/         # 工具定义
│           ├── index.ts
│           ├── edit-flow-canvas.ts
│           ├── get-canvas-state.ts
│           └── ...
├── toolboxes/             # 工具包层
│   └── canvas-toolbox/    # 画布工具包
│       ├── index.ts       # 工具注册表
│       ├── context.ts     # 执行上下文
│       ├── utils.ts       # 工具函数
│       └── tools/         # 工具实现
│           ├── edit-flow-canvas.ts
│           ├── get-canvas-state.ts
│           └── ...
└── index.ts               # 入口文件，注册所有 Agent
```

## 架构评价

### 优点

1. **清晰的分层架构**
   - 三层职责明确，关注点分离良好
   - 每层都有明确的边界和职责，便于理解和维护

2. **良好的解耦设计**
   - Presets 层与 Toolboxes 层完全解耦，通过 Schema 定义接口
   - 工具定义与实现分离，支持不同环境的实现

3. **优秀的可扩展性**
   - 新增 Agent 场景只需在 Presets 层扩展
   - 新增工具只需定义 Schema 和实现，无需修改其他层
   - 支持多种框架（目前是 ReAct，可扩展其他框架）

4. **环境适配能力**
   - 通过 `ToolRuntime` 明确区分客户端和服务端工具
   - 不同环境可以有不同的实现方式

5. **微代理系统设计**
   - 提供了灵活的触发时机机制
   - 支持轻量级的辅助功能扩展

### 缺点与改进建议

1. **缺乏类型安全保障**
   - **问题**：Presets 中定义的工具 Schema 和 Toolboxes 中的实现仅通过字符串名称连接，没有编译时类型检查
   - **风险**：工具名称不一致、参数类型不匹配等问题只能在运行时发现
   - **建议**：考虑使用 TypeScript 的 const assertion 或工具函数确保名称一致性，或引入构建时验证机制

2. **缺少运行时验证机制**
   - **问题**：没有机制验证 Toolbox 中注册的工具是否与 Preset 中定义的 Schema 匹配（参数类型、返回值等）
   - **风险**：Schema 变更后，实现可能未同步更新，导致运行时错误
   - **建议**：在开发环境或构建时添加 Schema 验证，确保定义与实现的一致性

3. **工具注册分散且缺乏统一管理**
   - **问题**：工具注册分散在各个 Toolbox 的 `index.ts` 中，缺乏全局视图和统一验证
   - **风险**：可能出现重复注册、遗漏注册等问题
   - **建议**：考虑引入工具注册中心，统一管理和验证所有工具

4. **上下文管理的复杂性**
   - **问题**：不同 Toolbox 需要不同的 Context 类型，但 Context 的提供和验证机制不够明确
   - **风险**：Context 缺失或类型不匹配时，错误信息可能不够清晰
   - **建议**：在工具执行前添加 Context 验证，提供更清晰的错误提示

5. **缺乏工具版本管理**
   - **问题**：如果工具 Schema 发生变化，没有版本控制机制
   - **风险**：Schema 变更可能导致现有实现不兼容
   - **建议**：考虑在 `ToolDefinition` 中添加版本字段，支持多版本共存或迁移机制

6. **微代理系统的调试复杂度**
   - **问题**：微代理系统提供了多个触发时机，增加了执行流程的复杂度
   - **风险**：调试时难以追踪微代理的执行顺序和影响
   - **建议**：添加微代理执行日志和可视化工具，便于调试和性能分析

7. **错误处理不够统一**
   - **问题**：工具执行失败时的错误处理机制可能不够完善，错误信息可能不够详细
   - **风险**：问题定位困难
   - **建议**：统一错误处理机制，提供结构化的错误信息和错误码

8. **文档和示例不足**
   - **问题**：对于新开发者来说，理解如何添加新工具或新 Agent 可能不够直观
   - **风险**：开发效率低，容易出错
   - **建议**：提供详细的开发指南和示例代码，包括常见场景的最佳实践

9. **工具查找性能**
   - **问题**：当前通过 Map 查找工具，在工具数量较少时性能良好，但缺乏优化机制
   - **风险**：工具数量大幅增加时可能影响性能
   - **建议**：考虑添加工具分类索引或缓存机制（如果未来工具数量显著增加）

10. **工具依赖关系不明确**
    - **问题**：工具之间可能存在依赖关系，但当前架构没有明确的依赖管理机制
    - **风险**：工具执行顺序错误可能导致问题
    - **建议**：如果存在工具依赖，考虑添加依赖声明和验证机制

### 总体评价

这是一套**设计良好、结构清晰**的架构，在可扩展性和可维护性方面表现优秀。分层设计使得系统易于理解和扩展，解耦机制保证了各层的独立性。

主要改进方向集中在**类型安全**、**运行时验证**和**开发体验**方面。通过添加类型检查、Schema 验证和更好的错误处理，可以进一步提升架构的健壮性和开发效率。

对于当前项目规模，这套架构是合适的。随着项目发展，建议逐步引入上述改进措施，以应对更复杂的场景和更大的团队协作需求。

## 总结

三层架构实现了清晰的职责划分：

- **Core 层**提供框架能力，不关心业务场景
- **Presets 层**定义业务场景和工具接口，不关心实现细节
- **Toolboxes 层**实现具体工具，适配不同运行环境

这种设计使得系统具有良好的可扩展性和可维护性，新增场景或工具时只需在对应层进行扩展，无需修改其他层。

