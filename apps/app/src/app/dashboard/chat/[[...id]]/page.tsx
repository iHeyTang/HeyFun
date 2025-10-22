/**
 * Chat 页面
 * 使用自包含的 ChatContainer，内置 session 管理
 */

'use client';

import { ChatContainer } from '@/components/features/chat/chat-container';
import { useParams } from 'next/navigation';

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.id?.[0];

  return (
    <div className="h-full">
      <ChatContainer 
        sessionManagerType="remote"
        sessionId={sessionId}
      />
    </div>
  );
}
