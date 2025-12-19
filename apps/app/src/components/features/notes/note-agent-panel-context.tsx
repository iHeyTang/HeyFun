'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NoteAgentPanelContextValue {
  /** 面板是否打开 */
  isOpen: boolean;
  /** 当前关联的 noteId */
  noteId: string | null;
  /** 打开面板 */
  openPanel: (noteId: string) => void;
  /** 关闭面板 */
  closePanel: () => void;
  /** 切换面板 */
  togglePanel: (noteId?: string) => void;
  /** 设置输入框的值（用于从编辑器插入 mention） */
  setInputValue: (value: string) => void;
  /** 获取输入框的值 */
  inputValue: string;
}

const NoteAgentPanelContext = createContext<NoteAgentPanelContextValue | null>(null);

export function NoteAgentPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const openPanel = useCallback((newNoteId: string) => {
    setNoteId(newNoteId);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // 注意：不重置 noteId，保持上下文以便面板知道当前关联的笔记
  }, []);

  const togglePanel = useCallback(
    (newNoteId?: string) => {
      if (isOpen && (!newNoteId || noteId === newNoteId)) {
        // 如果面板已打开且是同一个笔记，则关闭
        closePanel();
      } else if (newNoteId) {
        // 如果提供了 noteId，打开面板并设置 noteId
        openPanel(newNoteId);
      } else if (noteId) {
        // 如果没有提供 noteId 但已有 noteId，切换显示状态
        setIsOpen(prev => !prev);
      }
    },
    [isOpen, noteId, openPanel, closePanel],
  );

  return (
    <NoteAgentPanelContext.Provider
      value={{ isOpen, noteId, openPanel, closePanel, togglePanel, setInputValue, inputValue }}
    >
      {children}
    </NoteAgentPanelContext.Provider>
  );
}

export function useNoteAgentPanel() {
  const context = useContext(NoteAgentPanelContext);
  if (!context) {
    // 如果没有 Provider，返回默认值（用于只读模式或非笔记场景）
    return {
      isOpen: false,
      noteId: null,
      openPanel: () => {},
      closePanel: () => {},
      togglePanel: () => {},
      setInputValue: () => {},
      inputValue: '',
    };
  }
  return context;
}

