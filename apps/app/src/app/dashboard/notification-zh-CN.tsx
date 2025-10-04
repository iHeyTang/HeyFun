'use client';

import { Markdown } from '@/components/block/markdown/markdown';

export default function NotificationZh() {
  return (
    <Markdown className="h-128 w-full">
      {`
## 欢迎来到 HeyFun

嗨，感谢你尝试 HeyFun！

作为一个独立开发的项目，HeyFun 目前还处于早期开发阶段。我正在努力打磨这个应用，但难免会有一些不完善的地方。

## 当前状态

你可能会遇到：

- 部分功能尚未完成或需要改进
- 偶尔的性能问题或加载延迟
- 界面和用户体验有待优化
- 可能出现的小故障或数据异常

## 期待你的参与

作为独立开发者，我真诚地希望能听到你的想法：

- 使用过程中的问题和建议
- 你希望看到的新功能
- 任何能让 HeyFun 变得更好的想法

每一条反馈都会被认真考虑，这些意见将直接帮助 HeyFun 成长。

## 持续改进

我承诺会定期更新应用，修复问题，并根据反馈不断完善。希望你能见证 HeyFun 逐步成长的过程。

感谢你的理解和支持！

---
*如有任何疑问和兴趣，欢迎随时交流*

邮箱：dehui1012@qq.com

微信：iheytang
`}
    </Markdown>
  );
}
