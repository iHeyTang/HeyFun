import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatInputAttachment } from '@/components/block/chat-input';

/**
 * 输入数据管理 Store
 * 负责输入值和附件的持久化存储
 */
interface ChatInputState {
  // 每个 session 的输入框值（持久化）
  sessionInputValues: Record<string, string>;
  // 每个 session 的附件列表（持久化）
  sessionAttachments: Record<string, ChatInputAttachment[]>;
}

interface ChatInputActions {
  // 设置 session 输入值
  setSessionInputValue: (sessionId: string, value: string) => void;
  // 设置 session 附件列表
  setSessionAttachments: (sessionId: string, attachments: ChatInputAttachment[]) => void;
  // 检查 HTML 内容是否真的为空（去除 HTML 标签后检查文本内容）
  hasRealContent: (html: string | undefined) => boolean;
}

type ChatInputStore = ChatInputState & ChatInputActions;

export const useChatInputStore = create<ChatInputStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      sessionInputValues: {},
      sessionAttachments: {},

      // 检查 HTML 内容是否真的为空
      hasRealContent: (html: string | undefined): boolean => {
        if (!html) return false;
        if (typeof window === 'undefined') return false;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        return textContent.trim().length > 0;
      },

      // 设置 session 输入值
      setSessionInputValue: (sessionId, value) => {
        const state = get();
        const attachments = state.sessionAttachments[sessionId] || [];
        const hasContent = state.hasRealContent(value) || attachments.length > 0;

        set(state => {
          if (!hasContent) {
            // 如果内容为空且没有附件，删除该 session 的输入值
            const { [sessionId]: removed, ...rest } = state.sessionInputValues;
            return { sessionInputValues: rest };
          } else {
            // 否则更新输入值
            return {
              sessionInputValues: {
                ...state.sessionInputValues,
                [sessionId]: value,
              },
            };
          }
        });
      },

      // 设置 session 附件列表
      setSessionAttachments: (sessionId, attachments) => {
        const state = get();
        const inputValue = state.sessionInputValues[sessionId] || '';
        const hasContent = state.hasRealContent(inputValue) || attachments.length > 0;

        set(state => {
          if (!hasContent) {
            // 如果内容为空且没有附件，删除该 session 的附件列表
            const { [sessionId]: removed, ...rest } = state.sessionAttachments;
            return { sessionAttachments: rest };
          } else {
            // 否则更新附件列表
            return {
              sessionAttachments: {
                ...state.sessionAttachments,
                [sessionId]: attachments,
              },
            };
          }
        });
      },
    }),
    {
      name: 'chat-input-store', // localStorage key
      partialize: state => ({
        // 只持久化输入值和附件列表
        sessionInputValues: state.sessionInputValues,
        sessionAttachments: state.sessionAttachments,
      }),
    },
  ),
);
