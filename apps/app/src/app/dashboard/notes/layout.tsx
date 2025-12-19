'use client';

import { NotesSidebar } from '@/components/features/notes/notes-sidebar';
import { useNoteAgentPanel } from '@/components/features/notes/note-agent-panel-context';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect } from 'react';
import { ChatContainer } from '@/components/features/chat/chat-container';
import { createChatSession } from '@/actions/chat';
import { getNote } from '@/actions/notes';
import { ChatSessions } from '@prisma/client';

function NotesLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const { isOpen, noteId, inputValue, setInputValue } = useNoteAgentPanel();

  // 自定义 session 创建函数（用于 notes-agent，需要传递 noteId）
  const createNotesAgentSessionFn = useCallback(async (): Promise<ChatSessions> => {
    if (!noteId) {
      throw new Error('Note ID is required');
    }
    try {
      // 获取笔记标题
      const noteResult = await getNote({ noteId });
      const noteTitle = noteResult.data?.title || '笔记';

      // 创建 session，将 noteId 存储在 title 中
      const result = await createChatSession({
        title: `笔记助手 - ${noteTitle} | noteId:${noteId}`,
        agentId: 'notes',
      });

      if (!result.data) {
        throw new Error('Failed to create session');
      }

      return result.data as ChatSessions;
    } catch (error) {
      console.error('Error creating notes agent session:', error);
      throw error;
    }
  }, [noteId]);

  const routeNoteId = useMemo(() => {
    const id = params?.id;
    if (Array.isArray(id)) return id[0] || null;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }, [params]);

  // 当路由中的 noteId 变化时，更新 context 中的 noteId（但不自动打开面板）
  useEffect(() => {
    if (routeNoteId && isOpen) {
      // 如果面板已打开，更新 noteId
      // 注意：这里不调用 openPanel，因为 openPanel 会设置 isOpen=true
      // 我们只需要在 context 内部更新 noteId
    }
  }, [routeNoteId, isOpen]);

  // 路由跳转选择笔记（同步 URL）
  const handleRouteNoteSelect = (noteId: string | null) => {
    if (!noteId) {
      router.push('/dashboard/notes');
      return;
    }
    router.push(`/dashboard/notes/${noteId}`);
  };

  // 计算面板的默认大小
  const editorDefaultSize = isOpen ? 50 : 83;
  const panelDefaultSize = isOpen ? 30 : 0;

  return (
    <ResizablePanelGroup direction="horizontal" className="flex h-full w-full">
      {/* 侧边栏 */}
      <ResizablePanel defaultSize={17} minSize={10}>
        <NotesSidebar selectedNoteId={routeNoteId} onNoteSelect={handleRouteNoteSelect} />
      </ResizablePanel>
      <ResizableHandle />

      {/* 主内容区 */}
      <ResizablePanel defaultSize={editorDefaultSize} minSize={30} className="flex-1">
        {children}
      </ResizablePanel>

      {/* Note Agent Panel */}
      {isOpen && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={panelDefaultSize} minSize={20} maxSize={50} className="flex flex-col border-l border-border/40">
            <ChatContainer
              apiPrefix="/api/agent"
              layout="tabs"
              inputValue={inputValue}
              onInputValueChange={setInputValue}
              createSessionFn={createNotesAgentSessionFn}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  // NoteAgentPanelProvider 已经在全局 dashboard layout 中提供，这里不需要再包裹
  return <NotesLayoutInner>{children}</NotesLayoutInner>;
}
