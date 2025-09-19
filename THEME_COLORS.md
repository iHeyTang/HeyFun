# 主题颜色参考文档

## 概述
本项目已完全适配暗色主题，所有颜色都使用CSS变量定义，支持浅色和暗色两种主题模式。

## 主题文件结构
- `src/styles/theme.css` - 主题颜色变量定义
- `src/app/globals.css` - 全局样式，引用主题变量
- `src/app/page.css` - 页面特定样式，使用主题变量

## 颜色变量定义

### 基础颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | 页面背景色 |
| `--theme-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 主要文字颜色 |
| `--theme-card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | 卡片背景色 |
| `--theme-card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 卡片文字颜色 |
| `--theme-popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | 弹出层背景色 |
| `--theme-popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 弹出层文字颜色 |

### 主要颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | 主要按钮/链接颜色 |
| `--theme-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | 主要按钮文字颜色 |
| `--theme-secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 次要按钮颜色 |
| `--theme-secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 次要按钮文字颜色 |

### 辅助颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 静音背景色 |
| `--theme-muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | 静音文字颜色 |
| `--theme-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 强调色背景 |
| `--theme-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 强调色文字 |

### 状态颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | 危险/删除按钮颜色 |
| `--theme-destructive-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | 危险按钮文字颜色 |
| `--theme-success` | `oklch(0.6 0.15 142)` | `oklch(0.7 0.15 142)` | 成功状态颜色 |
| `--theme-success-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | 成功状态文字颜色 |
| `--theme-success-bg` | `oklch(0.95 0.05 142)` | `oklch(0.2 0.05 142)` | 成功状态背景色 |

### 边框和输入
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | 边框颜色 |
| `--theme-input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | 输入框背景色 |
| `--theme-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | 焦点环颜色 |

### 图表颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` | 图表颜色1 |
| `--theme-chart-2` | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` | 图表颜色2 |
| `--theme-chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)` | 图表颜色3 |
| `--theme-chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` | 图表颜色4 |
| `--theme-chart-5` | `oklch(0.769 0.188 70.08)` | `oklch(0.645 0.246 16.439)` | 图表颜色5 |

### 侧边栏颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | 侧边栏背景色 |
| `--theme-sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 侧边栏文字颜色 |
| `--theme-sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | 侧边栏主要颜色 |
| `--theme-sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | 侧边栏主要文字颜色 |
| `--theme-sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 侧边栏强调色 |
| `--theme-sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 侧边栏强调文字颜色 |
| `--theme-sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | 侧边栏边框颜色 |
| `--theme-sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | 侧边栏焦点环颜色 |

### 特殊效果颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-silver-gradient-start` | `#f7f8fa` | `#2a2a2a` | 银色渐变起始色 |
| `--theme-silver-gradient-end` | `#f3f4f7` | `#1a1a1a` | 银色渐变结束色 |
| `--theme-silver-gradient-hover-start` | `#eceef0` | `#3a3a3a` | 银色渐变悬停起始色 |
| `--theme-silver-gradient-hover-end` | `#e9eaed` | `#2a2a2a` | 银色渐变悬停结束色 |

### 网格和图案颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-grid-color` | `#e5e7eb` | `#374151` | 网格线颜色 |
| `--theme-mesh-color` | `rgba(0, 0, 0, 0.02)` | `rgba(255, 255, 255, 0.02)` | 网格图案颜色 |

### 动画效果颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-glow-color` | `rgba(107, 114, 128, 0.3)` | `rgba(156, 163, 175, 0.3)` | 发光效果颜色 |
| `--theme-glow-color-hover` | `rgba(107, 114, 128, 0.5)` | `rgba(156, 163, 175, 0.5)` | 发光效果悬停颜色 |
| `--theme-luxury-glow-light` | `rgba(107, 114, 128, 0.1)` | `rgba(156, 163, 175, 0.1)` | 奢华发光浅色 |
| `--theme-luxury-glow-medium` | `rgba(156, 163, 175, 0.05)` | `rgba(107, 114, 128, 0.05)` | 奢华发光中色 |
| `--theme-luxury-glow-dark` | `rgba(209, 213, 219, 0.1)` | `rgba(75, 85, 99, 0.1)` | 奢华发光深色 |

### 文字效果颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-typewriter-border` | `#4b5563` | `#9ca3af` | 打字机效果边框颜色 |
| `--theme-shimmer-start` | `#374151` | `#d1d5db` | 闪烁效果起始色 |
| `--theme-shimmer-middle` | `#6b7280` | `#9ca3af` | 闪烁效果中间色 |
| `--theme-shimmer-end` | `#374151` | `#d1d5db` | 闪烁效果结束色 |

### 粒子效果颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-particle-color` | `#d1d5db` | `#6b7280` | 粒子效果颜色 |

### 阴影颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-shadow-light` | `rgba(0, 0, 0, 0.1)` | `rgba(0, 0, 0, 0.3)` | 浅阴影颜色 |
| `--theme-shadow-medium` | `rgba(0, 0, 0, 0.15)` | `rgba(0, 0, 0, 0.4)` | 中等阴影颜色 |

### 文字颜色层级
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-text-primary` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 主要文字颜色 |
| `--theme-text-secondary` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | 次要文字颜色 |
| `--theme-text-tertiary` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | 第三级文字颜色 |
| `--theme-text-quaternary` | `oklch(0.8 0 0)` | `oklch(0.4 0 0)` | 第四级文字颜色 |

### 背景颜色层级
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-bg-primary` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | 主要背景色 |
| `--theme-bg-secondary` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | 次要背景色 |
| `--theme-bg-tertiary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 第三级背景色 |
| `--theme-bg-quaternary` | `oklch(0.95 0 0)` | `oklch(0.3 0 0)` | 第四级背景色 |

### 边框颜色层级
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-border-primary` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | 主要边框颜色 |
| `--theme-border-secondary` | `oklch(0.9 0 0)` | `oklch(1 0 0 / 15%)` | 次要边框颜色 |
| `--theme-border-tertiary` | `oklch(0.85 0 0)` | `oklch(1 0 0 / 20%)` | 第三级边框颜色 |

### 装饰元素颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-decoration-light` | `oklch(0.95 0 0)` | `oklch(0.3 0 0)` | 浅色装饰元素 |
| `--theme-decoration-medium` | `oklch(0.9 0 0)` | `oklch(0.4 0 0)` | 中等装饰元素 |
| `--theme-decoration-dark` | `oklch(0.8 0 0)` | `oklch(0.5 0 0)` | 深色装饰元素 |

### 按钮颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-button-primary` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | 主要按钮颜色 |
| `--theme-button-primary-hover` | `oklch(0.1 0 0)` | `oklch(0.9 0 0)` | 主要按钮悬停颜色 |
| `--theme-button-secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 次要按钮颜色 |
| `--theme-button-secondary-hover` | `oklch(0.95 0 0)` | `oklch(0.3 0 0)` | 次要按钮悬停颜色 |

### 徽章颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-badge-bg` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 徽章背景色 |
| `--theme-badge-border` | `oklch(0.9 0 0)` | `oklch(1 0 0 / 15%)` | 徽章边框颜色 |
| `--theme-badge-text` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | 徽章文字颜色 |

### 特殊徽章颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-badge-amber-bg` | `oklch(0.95 0.05 60)` | `oklch(0.3 0.05 60)` | 琥珀色徽章背景 |
| `--theme-badge-amber-text` | `oklch(0.6 0.1 60)` | `oklch(0.7 0.1 60)` | 琥珀色徽章文字 |
| `--theme-badge-blue-bg` | `oklch(0.95 0.05 240)` | `oklch(0.3 0.05 240)` | 蓝色徽章背景 |
| `--theme-badge-blue-text` | `oklch(0.6 0.1 240)` | `oklch(0.7 0.1 240)` | 蓝色徽章文字 |
| `--theme-badge-green-bg` | `oklch(0.95 0.05 142)` | `oklch(0.3 0.05 142)` | 绿色徽章背景 |
| `--theme-badge-green-text` | `oklch(0.4 0.1 142)` | `oklch(0.6 0.1 142)` | 绿色徽章文字 |
| `--theme-badge-purple-bg` | `oklch(0.95 0.05 300)` | `oklch(0.3 0.05 300)` | 紫色徽章背景 |
| `--theme-badge-purple-text` | `oklch(0.4 0.1 300)` | `oklch(0.6 0.1 300)` | 紫色徽章文字 |

### 代码高亮颜色
| 变量名 | 浅色主题 | 暗色主题 | 用途 |
|--------|----------|----------|------|
| `--theme-code-bg` | `oklch(0.98 0 0)` | `oklch(0.2 0 0)` | 代码块背景色 |
| `--theme-code-border` | `oklch(0.9 0 0)` | `oklch(0.3 0 0)` | 代码块边框颜色 |
| `--theme-code-text` | `oklch(0.2 0 0)` | `oklch(0.9 0 0)` | 代码文字颜色 |
| `--theme-code-comment` | `oklch(0.6 0 0)` | `oklch(0.5 0 0)` | 注释颜色 |
| `--theme-code-keyword` | `oklch(0.3 0.15 280)` | `oklch(0.7 0.15 280)` | 关键字颜色 |
| `--theme-code-string` | `oklch(0.4 0.15 120)` | `oklch(0.7 0.15 120)` | 字符串颜色 |
| `--theme-code-number` | `oklch(0.4 0.15 60)` | `oklch(0.7 0.15 60)` | 数字颜色 |
| `--theme-code-function` | `oklch(0.3 0.15 200)` | `oklch(0.7 0.15 200)` | 函数名颜色 |
| `--theme-code-variable` | `oklch(0.3 0.15 30)` | `oklch(0.7 0.15 30)` | 变量名颜色 |
| `--theme-code-type` | `oklch(0.3 0.15 300)` | `oklch(0.7 0.15 300)` | 类型名颜色 |
| `--theme-code-constant` | `oklch(0.3 0.15 180)` | `oklch(0.7 0.15 180)` | 常量颜色 |

## 使用方法

### 在CSS中使用
```css
.my-component {
  background-color: var(--theme-background);
  color: var(--theme-foreground);
  border: 1px solid var(--theme-border);
}
```

### 在Tailwind CSS中使用
```html
<div class="bg-theme-background text-theme-foreground border-theme-border">
  内容
</div>
```

### 使用主题工具类
```html
<!-- 基础颜色 -->
<div class="bg-theme-background text-theme-foreground">基础颜色</div>

<!-- 特殊效果 -->
<div class="bg-theme-silver-gradient">银色渐变</div>
<div class="bg-theme-grid">网格背景</div>
<div class="bg-theme-mesh">网格图案</div>
<div class="shadow-theme-glow">发光阴影</div>
<div class="shadow-theme-luxury">奢华阴影</div>
```

## 主题切换
项目使用 `next-themes` 库进行主题切换，支持：
- 浅色主题 (`light`)
- 暗色主题 (`dark`) 
- 系统主题 (`system`)

主题切换组件位于 `src/components/features/theme-toggle.tsx`。

## 注意事项
1. 所有颜色都使用 `oklch` 色彩空间，提供更好的色彩一致性
2. 暗色主题的颜色对比度经过优化，确保可读性
3. 特殊效果颜色（如渐变、阴影）在暗色主题下进行了相应调整
4. 图表颜色在暗色主题下使用了更适合的颜色搭配
