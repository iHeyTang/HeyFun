'use client';

import { Markdown } from '@/components/block/markdown/markdown';

export default function NotificationEn() {
  return (
    <Markdown className="h-128 w-full">
      {`
## Welcome to HeyFun

Hi there, thanks for checking out HeyFun!

As an independently developed project, HeyFun is currently in its early development stage. I'm working hard to refine this application, but there are bound to be some rough edges.

## Current Status

You might encounter:

- Some features that are still under development or need improvement
- Occasional performance issues or loading delays
- User interface and experience that needs refinement
- Possible minor bugs or data inconsistencies

## Your Input Matters

As an independent developer, I genuinely value your thoughts:

- Issues and suggestions from your experience
- New features you'd like to see
- Any ideas that could make HeyFun better

Every piece of feedback is carefully considered and will directly help shape HeyFun's growth.

## Continuous Improvement

I'm committed to regular updates, fixing issues, and evolving based on your feedback. I hope you'll stick around to see HeyFun develop into something truly valuable.

Thanks for your understanding and support!

---
*If you have any questions or suggestions, please feel free to contact me.*

Email: dehui1012@qq.com

WeChat: iheytang
`}
    </Markdown>
  );
}
