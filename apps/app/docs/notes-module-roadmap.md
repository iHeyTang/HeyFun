# HeyFun 笔记模块实现路线图

## 概述

本文档详细描述了 HeyFun 笔记模块的 step-by-step 实现路径，包括数据库设计、API 开发、前端组件、AI 集成等各个阶段的详细任务。

## 技术栈

- **后端**：Next.js Server Actions + Prisma ORM
- **数据库**：PostgreSQL
- **前端**：React + Next.js App Router
- **编辑器**：Tiptap (已集成)
- **认证**：Clerk (已集成)
- **存储**：S3 兼容存储 (已集成)

---

## Phase 1: 数据库设计与基础架构 (Week 1)

### Step 1.1: 数据库 Schema 设计

**文件**：`apps/app/prisma/schema.prisma`

**任务清单**：
- [ ] 设计 `Notes` 表（核心笔记表）
  - id, organizationId, title, content (JSON/Text)
  - folderId (可选，支持文件夹)
  - isPinned, isArchived, isDeleted
  - createdAt, updatedAt
  - 索引：organizationId, folderId, createdAt, updatedAt

- [ ] 设计 `NoteFolders` 表（文件夹系统）
  - id, organizationId, name, parentId (支持嵌套)
  - createdAt, updatedAt
  - 索引：organizationId, parentId

- [ ] 设计 `NoteTags` 表（标签系统）
  - id, organizationId, name, color (可选)
  - createdAt
  - 索引：organizationId, name

- [ ] 设计 `NoteTagRelations` 表（笔记-标签关联）
  - noteId, tagId
  - 唯一索引：(noteId, tagId)

- [ ] 设计 `NoteLinks` 表（双向链接）
  - id, organizationId
  - sourceNoteId, targetNoteId
  - linkType (可选：双向、单向)
  - createdAt
  - 索引：organizationId, sourceNoteId, targetNoteId

- [ ] 设计 `NoteAttachments` 表（附件）
  - id, organizationId, noteId
  - fileKey (OSS key), fileName, fileType, fileSize
  - createdAt
  - 索引：organizationId, noteId

- [ ] 设计 `NoteVersions` 表（版本历史，Phase 3）
  - id, noteId, content, createdAt
  - 索引：noteId, createdAt

**执行步骤**：
```bash
# 1. 编辑 schema.prisma，添加上述表定义
# 2. 运行迁移
npx prisma db push
# 3. 生成 Prisma Client
npx prisma generate
```

**预计时间**：2-3 小时

---

### Step 1.2: 类型定义

**文件**：`apps/app/src/types/notes.ts`

**任务清单**：
- [ ] 定义 `Note` 类型
- [ ] 定义 `NoteFolder` 类型
- [ ] 定义 `NoteTag` 类型
- [ ] 定义 `NoteLink` 类型
- [ ] 定义 `NoteAttachment` 类型
- [ ] 定义 API 请求/响应类型
- [ ] 定义编辑器内容类型（Tiptap JSON）

**预计时间**：1 小时

---

### Step 1.3: Server Actions 基础结构

**文件**：`apps/app/src/actions/notes.ts`

**任务清单**：
- [ ] 创建基础 CRUD 操作框架
  - `createNote`
  - `getNote`
  - `updateNote`
  - `deleteNote`
  - `getNotes` (列表查询)

- [ ] 实现文件夹操作
  - `createFolder`
  - `getFolders`
  - `updateFolder`
  - `deleteFolder`

- [ ] 实现标签操作
  - `createTag`
  - `getTags`
  - `updateTag`
  - `deleteTag`
  - `addTagToNote`
  - `removeTagFromNote`

**代码模板**：
```typescript
'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

export const createNote = withUserAuth(
  'notes/createNote',
  async ({ orgId, args }: AuthWrapperContext<{ title: string; content: any; folderId?: string }>) => {
    // 实现逻辑
  }
);
```

**预计时间**：4-5 小时

---

## Phase 2: 前端基础 UI (Week 1-2)

### Step 2.1: 路由和布局

**文件**：
- `apps/app/src/app/dashboard/notes/page.tsx` (列表页)
- `apps/app/src/app/dashboard/notes/[id]/page.tsx` (详情/编辑页)
- `apps/app/src/app/dashboard/notes/layout.tsx` (布局)

**任务清单**：
- [ ] 创建笔记列表页面
  - 侧边栏：文件夹树、标签列表
  - 主区域：笔记列表（卡片/列表视图）
  - 顶部：搜索栏、新建按钮、视图切换

- [ ] 创建笔记详情/编辑页面
  - 左侧：笔记列表（可选）
  - 中间：编辑器区域
  - 右侧：属性面板（标签、文件夹、元数据）

- [ ] 更新侧边栏导航
  - 在 `apps/app/src/app/dashboard/sidebar.tsx` 添加笔记入口

**预计时间**：3-4 小时

---

### Step 2.2: 笔记列表组件

**文件**：`apps/app/src/components/features/notes/notes-list.tsx`

**任务清单**：
- [ ] 实现笔记卡片组件
  - 显示标题、预览、标签、更新时间
  - 支持点击、右键菜单

- [ ] 实现列表视图
  - 虚拟滚动（大量笔记时）
  - 分页或无限滚动

- [ ] 实现文件夹树组件
  - 可折叠、拖拽排序

- [ ] 实现标签列表组件
  - 标签云、颜色标记

**预计时间**：5-6 小时

---

### Step 2.3: 笔记编辑器组件

**文件**：`apps/app/src/components/features/notes/note-editor.tsx`

**任务清单**：
- [ ] 基于 Tiptap 创建编辑器组件
  - 参考 `FlowCanvasTextEditor` 的实现
  - 支持标题、段落、列表、引用、代码块
  - 支持 Markdown 快捷键

- [ ] 实现工具栏
  - 格式化按钮（加粗、斜体、链接等）
  - 插入按钮（图片、代码块、表格等）

- [ ] 实现自动保存
  - 防抖保存（3 秒无操作后保存）
  - 保存状态提示

- [ ] 实现快捷键
  - `Cmd/Ctrl + S` 保存
  - `Cmd/Ctrl + K` 快速搜索
  - `Cmd/Ctrl + N` 新建笔记

**预计时间**：6-8 小时

---

## Phase 3: 核心功能实现 (Week 2-3)

### Step 3.1: 文件夹和标签系统

**任务清单**：
- [ ] 完善文件夹 Server Actions
  - 支持嵌套文件夹
  - 文件夹移动、重命名
  - 文件夹删除（处理子文件夹和笔记）

- [ ] 完善标签 Server Actions
  - 标签自动创建（输入时）
  - 标签统计（笔记数量）
  - 标签颜色管理

- [ ] 实现前端交互
  - 拖拽笔记到文件夹
  - 标签选择器（支持多选、创建新标签）
  - 标签颜色选择器

**预计时间**：4-5 小时

---

### Step 3.2: 搜索功能

**文件**：
- `apps/app/src/actions/notes.ts` (添加搜索 action)
- `apps/app/src/components/features/notes/notes-search.tsx`

**任务清单**：
- [ ] 实现全文搜索
  - 使用 PostgreSQL 全文搜索
  - 支持标题、内容搜索
  - 支持标签、文件夹筛选

- [ ] 实现搜索 UI
  - 全局搜索框（`Cmd/Ctrl + K`）
  - 搜索结果高亮
  - 高级搜索（日期范围、类型等）

- [ ] 实现搜索索引优化
  - 考虑使用 `tsvector` 类型（PostgreSQL）

**预计时间**：4-5 小时

---

### Step 3.3: 附件上传

**文件**：
- `apps/app/src/components/features/notes/note-attachments.tsx`
- `apps/app/src/actions/notes.ts` (添加附件相关 actions)

**任务清单**：
- [ ] 实现文件上传组件
  - 拖拽上传
  - 文件类型限制
  - 上传进度显示

- [ ] 集成 OSS 存储
  - 使用现有的 `storage` 服务
  - 文件路径：`{orgId}/notes/{noteId}/{filename}`

- [ ] 实现附件列表
  - 显示附件、预览、下载、删除

**预计时间**：3-4 小时

---

## Phase 4: AI 集成 (Week 3-4)

### Step 4.1: 从对话保存笔记

**文件**：
- `apps/app/src/components/features/chat/chat-session.tsx` (添加保存按钮)
- `apps/app/src/actions/notes.ts` (添加 `saveFromChat` action)

**任务清单**：
- [ ] 在聊天界面添加"保存为笔记"按钮
  - 可选择保存整个对话或单条消息
  - 自动提取关键信息作为标题

- [ ] 实现保存逻辑
  - 解析对话内容（Markdown 格式）
  - 自动生成标题（使用 AI 或规则）
  - 自动提取标签建议

- [ ] 实现 AI 辅助标题生成
  - 调用 LLM 生成简洁标题
  - 缓存机制（相同内容不重复调用）

**预计时间**：4-5 小时

---

### Step 4.2: 笔记作为 AI 上下文

**文件**：
- `apps/app/src/components/features/chat/chat-input.tsx` (添加笔记选择)
- `apps/app/src/app/api/chat/stream/route.ts` (修改上下文构建)

**任务清单**：
- [ ] 实现笔记选择器
  - 在聊天输入框添加笔记选择按钮
  - 支持多选笔记
  - 显示笔记预览

- [ ] 修改聊天 API
  - 将选中的笔记内容添加到系统消息
  - 支持笔记内容摘要（如果太长）

- [ ] 实现笔记引用
  - 在对话中显示引用的笔记
  - 支持点击跳转到笔记

**预计时间**：5-6 小时

---

### Step 4.3: AI 辅助功能

**文件**：
- `apps/app/src/components/features/notes/note-ai-assistant.tsx`
- `apps/app/src/actions/notes.ts` (添加 AI 相关 actions)

**任务清单**：
- [ ] 实现 AI 摘要生成
  - 按钮触发摘要生成
  - 显示摘要结果（可编辑）

- [ ] 实现 AI 标签建议
  - 自动分析笔记内容
  - 推荐相关标签

- [ ] 实现 AI 内容优化
  - 语法检查
  - 内容润色建议

- [ ] 实现 AI 洞察（Phase 2 功能）
  - 分析笔记关联
  - 推荐相关笔记

**预计时间**：6-8 小时

---

## Phase 5: 高级功能 (Week 4-5)

### Step 5.1: 双向链接

**文件**：
- `apps/app/src/components/features/notes/note-link-editor.tsx`
- `apps/app/src/actions/notes.ts` (添加链接相关 actions)

**任务清单**：
- [ ] 实现 `[[笔记名称]]` 语法
  - Tiptap 扩展：检测 `[[` 触发自动完成
  - 显示笔记列表供选择

- [ ] 实现反向链接显示
  - 在笔记详情页显示"被链接到"
  - 支持点击跳转

- [ ] 实现链接管理
  - 创建、删除链接
  - 链接统计

**预计时间**：5-6 小时

---

### Step 5.2: 代码块和表格

**任务清单**：
- [ ] 扩展 Tiptap 编辑器
  - 添加代码块扩展（语法高亮）
  - 添加表格扩展

- [ ] 实现代码块功能
  - 语言选择
  - 语法高亮（使用 highlight.js 或 prism）
  - 代码复制按钮

- [ ] 实现表格功能
  - 插入表格
  - 表格编辑（增删行列）
  - 表格样式

**预计时间**：4-5 小时

---

### Step 5.3: 收藏和置顶

**任务清单**：
- [ ] 更新数据库 Schema
  - 在 `Notes` 表添加 `isPinned`, `isStarred` 字段

- [ ] 实现 Server Actions
  - `pinNote`, `unpinNote`
  - `starNote`, `unstarNote`

- [ ] 实现前端交互
  - 置顶笔记显示在顶部
  - 收藏笔记单独分组
  - 快速操作按钮

**预计时间**：2-3 小时

---

## Phase 6: 用户体验优化 (Week 5-6)

### Step 6.1: 快速记录功能

**文件**：`apps/app/src/components/features/notes/quick-note.tsx`

**任务清单**：
- [ ] 实现全局快速输入
  - `Cmd/Ctrl + K` 打开快速输入
  - 极简输入界面（类似 flomo）
  - 支持标签快捷输入（`#标签`）

- [ ] 实现语音输入（可选）
  - 集成 Web Speech API
  - AI 转写（如果支持）

- [ ] 实现剪贴板快速创建
  - 监听剪贴板变化
  - 一键创建笔记

**预计时间**：4-5 小时

---

### Step 6.2: 持续回顾功能（借鉴 flomo）

**文件**：`apps/app/src/components/features/notes/notes-review.tsx`

**任务清单**：
- [ ] 实现每日回顾
  - 随机展示过往笔记
  - 每日提醒（可选）

- [ ] 实现热力图
  - 使用日历视图
  - 显示每日记录数量
  - 颜色深浅表示活跃度

- [ ] 实现量化统计
  - 笔记总数、标签分布
  - 记录趋势图

**预计时间**：5-6 小时

---

### Step 6.3: 响应式设计和移动端优化

**任务清单**：
- [ ] 实现响应式布局
  - 桌面端：三栏布局
  - 平板端：两栏布局
  - 移动端：单栏布局（列表/编辑切换）

- [ ] 优化移动端体验
  - 触摸手势
  - 移动端专用工具栏
  - 简化操作流程

**预计时间**：4-5 小时

---

## Phase 7: 高级功能（后续迭代）

### Step 7.1: 知识图谱可视化

**任务清单**：
- [ ] 实现图谱数据生成
  - 分析笔记链接关系
  - 生成节点和边数据

- [ ] 实现可视化组件
  - 使用 D3.js 或 vis.js
  - 支持缩放、拖拽
  - 点击节点跳转到笔记

**预计时间**：6-8 小时

---

### Step 7.2: 版本历史

**任务清单**：
- [ ] 实现版本保存
  - 自动保存版本（每次编辑后）
  - 版本限制（最多保留 N 个版本）

- [ ] 实现版本对比
  - 并排对比
  - 差异高亮

- [ ] 实现版本恢复
  - 选择版本恢复
  - 确认对话框

**预计时间**：5-6 小时

---

### Step 7.3: 模板系统

**任务清单**：
- [ ] 实现模板数据模型
  - `NoteTemplates` 表
  - 模板内容、分类

- [ ] 实现模板选择器
  - 模板列表
  - 模板预览
  - 从模板创建笔记

- [ ] 实现自定义模板
  - 从现有笔记创建模板
  - 模板编辑

**预计时间**：4-5 小时

---

### Step 7.4: 导出功能

**任务清单**：
- [ ] 实现 Markdown 导出
  - 转换 Tiptap JSON 为 Markdown
  - 处理图片、附件

- [ ] 实现 PDF 导出
  - 使用 puppeteer 或类似工具
  - 自定义样式

- [ ] 实现批量导出
  - 选择多个笔记
  - 打包为 ZIP

**预计时间**：4-5 小时

---

## Phase 8: 协作功能（可选）

### Step 8.1: 笔记分享

**任务清单**：
- [ ] 实现分享链接生成
  - 生成唯一分享 ID
  - 设置过期时间

- [ ] 实现分享页面
  - 只读视图
  - 样式优化

**预计时间**：3-4 小时

---

### Step 8.2: 团队协作

**任务清单**：
- [ ] 实现权限系统
  - 笔记权限（只读、编辑）
  - 组织内共享

- [ ] 实现评论系统
  - 评论数据模型
  - 评论 UI
  - 通知系统

**预计时间**：8-10 小时

---

## 测试计划

### 单元测试
- [ ] Server Actions 测试
- [ ] 工具函数测试
- [ ] 组件测试（关键组件）

### 集成测试
- [ ] API 端点测试
- [ ] 数据库操作测试
- [ ] AI 集成测试

### E2E 测试
- [ ] 笔记创建流程
- [ ] 搜索功能
- [ ] AI 集成流程

---

## 性能优化

### 数据库优化
- [ ] 添加必要的索引
- [ ] 查询优化（避免 N+1）
- [ ] 分页优化

### 前端优化
- [ ] 虚拟滚动（大量笔记）
- [ ] 懒加载（笔记内容）
- [ ] 缓存策略（React Query）
- [ ] 代码分割

### 存储优化
- [ ] 图片压缩
- [ ] CDN 加速
- [ ] 文件大小限制

---

## 部署清单

### 数据库迁移
- [ ] 创建迁移脚本
- [ ] 测试迁移（开发环境）
- [ ] 生产环境迁移计划

### 环境变量
- [ ] 检查所需环境变量
- [ ] 更新 `.env.example`

### 文档更新
- [ ] 更新 README
- [ ] API 文档
- [ ] 用户指南

---

## 时间估算总结

| Phase | 功能 | 预计时间 |
|-------|------|----------|
| Phase 1 | 数据库设计与基础架构 | 7-9 小时 |
| Phase 2 | 前端基础 UI | 14-18 小时 |
| Phase 3 | 核心功能实现 | 11-14 小时 |
| Phase 4 | AI 集成 | 15-19 小时 |
| Phase 5 | 高级功能 | 11-14 小时 |
| Phase 6 | 用户体验优化 | 13-16 小时 |
| Phase 7 | 高级功能（后续） | 19-24 小时 |
| Phase 8 | 协作功能（可选） | 11-14 小时 |

**MVP 总时间**（Phase 1-4）：47-60 小时（约 6-8 个工作日）

**完整功能**（Phase 1-6）：81-100 小时（约 10-13 个工作日）

---

## 依赖关系图

```
Phase 1 (数据库) 
  ↓
Phase 2 (基础 UI)
  ↓
Phase 3 (核心功能)
  ↓
Phase 4 (AI 集成) ← 依赖 Phase 2, 3
  ↓
Phase 5 (高级功能) ← 依赖 Phase 3
  ↓
Phase 6 (体验优化) ← 依赖 Phase 2-5
  ↓
Phase 7 (后续功能) ← 依赖 Phase 5
  ↓
Phase 8 (协作功能) ← 依赖 Phase 1-3
```

---

## 风险与挑战

### 技术风险
1. **Tiptap 扩展开发**：可能需要自定义扩展，学习曲线
2. **全文搜索性能**：大量笔记时可能需要优化
3. **AI 集成成本**：频繁调用 AI 可能产生较高成本

### 解决方案
1. 参考现有 Tiptap 实现，逐步扩展
2. 使用 PostgreSQL 全文搜索索引，必要时引入 Elasticsearch
3. 实现缓存机制，减少重复 AI 调用

---

## 下一步行动

1. **立即开始**：Phase 1 - 数据库设计
2. **并行准备**：研究 Tiptap 扩展开发
3. **设计评审**：与团队评审数据库设计
4. **原型验证**：快速搭建 MVP 验证核心流程

---

## 更新日志

- 2024-XX-XX: 初始版本创建

