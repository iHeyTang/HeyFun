import { create } from 'zustand';
import { ChatMessages } from '@prisma/client';
import { useChatSessionsListStore } from './use-chat-sessions-list';

/**
 * 深度比较两条消息是否相等（只比较关键字段）
 */
function areMessagesEqual(msg1: ChatMessages, msg2: ChatMessages): boolean {
  return (
    msg1.id === msg2.id &&
    msg1.content === msg2.content &&
    msg1.isComplete === msg2.isComplete &&
    msg1.isStreaming === msg2.isStreaming &&
    JSON.stringify(msg1.toolCalls) === JSON.stringify(msg2.toolCalls) &&
    JSON.stringify(msg1.toolResults) === JSON.stringify(msg2.toolResults) &&
    JSON.stringify(msg1.metadata) === JSON.stringify(msg2.metadata)
  );
}

/**
 * 深度比较两个消息列表是否相等
 * 只要消息列表的内容相同（即使对象引用不同），就认为相等
 */
function areMessageListsEqual(list1: ChatMessages[], list2: ChatMessages[]): boolean {
  if (list1.length !== list2.length) {
    return false;
  }

  for (let i = 0; i < list1.length; i++) {
    const msg1 = list1[i];
    const msg2 = list2[i];
    if (!msg1 || !msg2 || !areMessagesEqual(msg1, msg2)) {
      return false;
    }
  }

  return true;
}

/**
 * 消息管理 Store
 * 负责消息的获取、更新和同步
 */
interface ChatMessagesState {
  // 每个 session 的消息列表
  sessionMessages: Record<string, ChatMessages[]>;
  // 每个 session 的加载状态（用于发送消息时的 loading）
  sessionLoadingStates: Record<string, boolean>;
}

interface ChatMessagesActions {
  // 获取并更新消息（自动处理状态和标题更新）
  // lastMessageId: 可选，如果提供则只获取该消息之后的新消息（游标分页）
  fetchAndUpdateMessages: (params: {
    sessionId: string;
    lastMessageId?: string;
  }) => Promise<{ status: string; shouldContinue: boolean; messages: ChatMessages[] }>;
  // 设置 session 消息
  setSessionMessages: (sessionId: string, messages: ChatMessages[]) => void;
  // 添加消息到 session
  addMessageToSession: (sessionId: string, message: ChatMessages) => void;
  // 更新单个消息（用于实时更新）
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessages> | { data?: Partial<ChatMessages> }) => void;
  // 清空 session 消息
  clearSessionMessages: (sessionId: string) => void;
  // 设置 session 的加载状态
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  // 处理消息数据（从 API 返回的原始消息转换为处理后的消息）
  processMessages: (rawMessages: ChatMessages[]) => ChatMessages[];
}

type ChatMessagesStore = ChatMessagesState & ChatMessagesActions;

export const useChatMessagesStore = create<ChatMessagesStore>()((set, get) => ({
  // 初始状态
  sessionMessages: {},
  sessionLoadingStates: {},

  // 处理消息数据
  processMessages: rawMessages => {
    const processedMessages: ChatMessages[] = [];
    for (const msg of rawMessages) {
      if (!msg) continue;

      // 跳过 role='tool' 的消息，它们已经作为 toolResults 存储在 assistant 消息中
      if (msg.role === 'tool') {
        continue;
      }

      // 只处理 user 和 assistant 消息
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        continue;
      }

      const chatMessage: ChatMessages = msg;

      // 如果这是一个有 toolCalls 的 assistant 消息，从 toolResults 读取工具结果
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolResults) {
        const toolCalls = msg.toolCalls as any[];
        const toolResults = msg.toolResults as any[];
        const processedToolResults: any[] = [];

        // 处理每个工具结果
        for (const toolResult of toolResults) {
          const toolCallId = toolResult.toolCallId;
          const toolCall = toolCalls.find((tc: any) => tc.id === toolCallId);

          // 提取工具结果数据
          const resultData = {
            toolName: toolCall?.function?.name || 'unknown',
            success: toolResult.success ?? true,
            data: toolResult.data,
            error: toolResult.error,
            message: toolResult.message,
          };

          processedToolResults.push(resultData);
        }

        if (processedToolResults.length > 0) {
          chatMessage.toolResults = processedToolResults;
        }
      }

      processedMessages.push(chatMessage);
    }

    return processedMessages;
  },

  // 获取并更新消息（自动处理状态和标题更新）
  // lastMessageId: 可选，如果提供则只获取该消息之后的新消息（游标分页）
  fetchAndUpdateMessages: async ({ sessionId, lastMessageId }) => {
    try {
      const url = new URL('/api/agent/messages', window.location.origin);
      url.searchParams.set('sessionId', sessionId);

      // 如果提供了 lastMessageId，使用游标分页（只获取新消息）
      // 否则获取所有消息（limit 100）
      if (lastMessageId) {
        url.searchParams.set('cursor', lastMessageId);
        url.searchParams.set('limit', '50'); // 轮询时限制获取数量
      } else {
        url.searchParams.set('limit', '100'); // 首次加载获取更多消息
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data: { messages: ChatMessages[]; status: string; title: string } = await response.json();
      const rawMessages = data.messages || [];

      // 获取处理状态和标题
      const sessionStatus = data.status || 'idle';
      const sessionTitle = data.title;

      // 自动更新状态和标题到 store
      const { updateSessionStatus, updateSessionTitle } = useChatSessionsListStore.getState();
      updateSessionStatus(sessionId, sessionStatus);
      if (sessionTitle) {
        updateSessionTitle(sessionId, sessionTitle);
      }

      // 处理消息
      const processedMessages = get().processMessages(rawMessages);

      // 更新消息列表
      const state = get();
      const existingMessages = state.sessionMessages[sessionId] || [];

      // 如果使用游标分页（有 lastMessageId），返回的消息都是新消息，直接添加到现有消息后面
      // 否则，需要合并和去重（首次加载或全量更新）
      if (lastMessageId && processedMessages.length > 0) {
        // 游标分页模式：只处理新消息
        const messageMap = new Map<string, ChatMessages>();
        // 先添加现有消息（包括临时消息）
        existingMessages.forEach(msg => messageMap.set(msg.id, msg));

        let hasChanges = false; // 跟踪是否有实际变化

        // 添加或更新新消息
        processedMessages.forEach((newMsg: ChatMessages) => {
          const existing = messageMap.get(newMsg.id);
          const createdAtDate = newMsg.createdAt instanceof Date ? newMsg.createdAt : new Date(newMsg.createdAt);

          if (existing) {
            // 检查消息是否真的变化了（深度比较关键字段）
            const contentChanged = existing.content !== newMsg.content;
            const toolCallsChanged = JSON.stringify(existing.toolCalls) !== JSON.stringify(newMsg.toolCalls);
            const isCompleteChanged = existing.isComplete !== newMsg.isComplete;
            const isStreamingChanged = existing.isStreaming !== newMsg.isStreaming;
            const metadataChanged = JSON.stringify(existing.metadata) !== JSON.stringify(newMsg.metadata);

            // 只有当消息真正变化时才更新
            if (contentChanged || toolCallsChanged || isCompleteChanged || isStreamingChanged || metadataChanged) {
              hasChanges = true;
              // 更新现有消息（保留 toolResults 等前端状态）
              messageMap.set(newMsg.id, {
                ...existing,
                ...newMsg,
                createdAt: createdAtDate,
                toolResults: newMsg.toolResults || existing.toolResults,
                inputTokens: newMsg.inputTokens ?? existing.inputTokens,
                outputTokens: newMsg.outputTokens ?? existing.outputTokens,
                cachedInputTokens: newMsg.cachedInputTokens ?? existing.cachedInputTokens,
                cachedOutputTokens: newMsg.cachedOutputTokens ?? existing.cachedOutputTokens,
                tokenCount: newMsg.tokenCount ?? existing.tokenCount,
              });
            }
            // 如果消息没有变化，保持原有引用，不更新 messageMap
          } else {
            // 新消息，标记为有变化
            hasChanges = true;
            // 检查是否有对应的临时消息（通过内容和角色匹配）
            if (newMsg.role === 'user') {
              let tempMessageFound = false;
              for (const [tempId, tempMsg] of messageMap.entries()) {
                if (tempId.startsWith('temp_user_') && tempMsg.role === 'user' && tempMsg.content === newMsg.content) {
                  // 找到匹配的临时消息，用真实消息替换
                  messageMap.delete(tempId);
                  messageMap.set(newMsg.id, {
                    ...newMsg,
                    createdAt: createdAtDate,
                  });
                  tempMessageFound = true;
                  break;
                }
              }
              if (!tempMessageFound) {
                messageMap.set(newMsg.id, {
                  ...newMsg,
                  createdAt: createdAtDate,
                });
              }
            } else {
              messageMap.set(newMsg.id, {
                ...newMsg,
                createdAt: createdAtDate,
              });
            }
          }
        });

        // 清理所有剩余的临时消息（可能因为某些原因没有被替换）
        for (const [msgId] of Array.from(messageMap.entries())) {
          if (msgId.startsWith('temp_')) {
            messageMap.delete(msgId);
            hasChanges = true; // 删除临时消息也算变化
          }
        }

        // 只有当有实际变化时才更新状态，避免不必要的重新渲染
        if (hasChanges) {
          // 转换为数组并按时间排序
          const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return timeA - timeB;
          });

          // 深度比较最终的消息列表和现有的消息列表
          // 如果内容相同，保持原有引用，避免重新渲染
          if (areMessageListsEqual(sortedMessages, existingMessages)) {
            return {
              status: sessionStatus,
              shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
              messages: existingMessages,
            };
          }

          set(state => ({
            sessionMessages: {
              ...state.sessionMessages,
              [sessionId]: sortedMessages,
            },
          }));

          return {
            status: sessionStatus,
            shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
            messages: sortedMessages,
          };
        } else {
          // 没有变化，返回现有消息，避免重新渲染
          return {
            status: sessionStatus,
            shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
            messages: existingMessages,
          };
        }
      } else if (processedMessages.length > 0) {
        // 全量更新模式：合并所有消息
        const messageMap = new Map<string, ChatMessages>();
        existingMessages.forEach(msg => messageMap.set(msg.id, msg));

        let hasChanges = false; // 跟踪是否有实际变化

        // 更新或添加消息
        processedMessages.forEach((newMsg: ChatMessages) => {
          const existing = messageMap.get(newMsg.id);
          const createdAtDate = newMsg.createdAt instanceof Date ? newMsg.createdAt : new Date(newMsg.createdAt);

          if (existing) {
            // 检查消息是否真的变化了（深度比较关键字段）
            const contentChanged = existing.content !== newMsg.content;
            const toolCallsChanged = JSON.stringify(existing.toolCalls) !== JSON.stringify(newMsg.toolCalls);
            const isCompleteChanged = existing.isComplete !== newMsg.isComplete;
            const isStreamingChanged = existing.isStreaming !== newMsg.isStreaming;
            const metadataChanged = JSON.stringify(existing.metadata) !== JSON.stringify(newMsg.metadata);

            // 只有当消息真正变化时才更新
            if (contentChanged || toolCallsChanged || isCompleteChanged || isStreamingChanged || metadataChanged) {
              hasChanges = true;
              // 更新现有消息（保留 toolResults 等前端状态）
              messageMap.set(newMsg.id, {
                ...existing,
                ...newMsg,
                createdAt: createdAtDate,
                toolResults: newMsg.toolResults || existing.toolResults,
                inputTokens: newMsg.inputTokens ?? existing.inputTokens,
                outputTokens: newMsg.outputTokens ?? existing.outputTokens,
                cachedInputTokens: newMsg.cachedInputTokens ?? existing.cachedInputTokens,
                cachedOutputTokens: newMsg.cachedOutputTokens ?? existing.cachedOutputTokens,
                tokenCount: newMsg.tokenCount ?? existing.tokenCount,
              });
            }
            // 如果消息没有变化，保持原有引用，不更新 messageMap
          } else {
            // 新消息，标记为有变化
            hasChanges = true;
            // 检查是否有对应的临时消息（通过内容和角色匹配）
            if (newMsg.role === 'user') {
              let tempMessageFound = false;
              for (const [tempId, tempMsg] of messageMap.entries()) {
                if (tempId.startsWith('temp_user_') && tempMsg.role === 'user' && tempMsg.content === newMsg.content) {
                  messageMap.delete(tempId);
                  messageMap.set(newMsg.id, {
                    ...newMsg,
                    createdAt: createdAtDate,
                  });
                  tempMessageFound = true;
                  break;
                }
              }
              if (!tempMessageFound) {
                messageMap.set(newMsg.id, {
                  ...newMsg,
                  createdAt: createdAtDate,
                });
              }
            } else {
              messageMap.set(newMsg.id, {
                ...newMsg,
                createdAt: createdAtDate,
              });
            }
          }
        });

        // 清理所有剩余的临时消息
        for (const [msgId] of Array.from(messageMap.entries())) {
          if (msgId.startsWith('temp_')) {
            messageMap.delete(msgId);
            hasChanges = true; // 删除临时消息也算变化
          }
        }

        // 只有当有实际变化时才更新状态，避免不必要的重新渲染
        if (hasChanges) {
          // 转换为数组并按时间排序
          const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return timeA - timeB;
          });

          set(state => ({
            sessionMessages: {
              ...state.sessionMessages,
              [sessionId]: sortedMessages,
            },
          }));

          return {
            status: sessionStatus,
            shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
            messages: sortedMessages,
          };
        } else {
          // 没有变化，返回现有消息，避免重新渲染
          return {
            status: sessionStatus,
            shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
            messages: existingMessages,
          };
        }
      }

      // 基于处理状态判断是否继续轮询
      const shouldContinue = sessionStatus === 'pending' || sessionStatus === 'processing';

      // 如果没有新消息，返回现有的消息
      const currentMessages = get().sessionMessages[sessionId] || [];

      return {
        status: sessionStatus,
        shouldContinue,
        messages: currentMessages,
      };
    } catch (error) {
      console.error('[ChatMessages] 获取消息失败:', error);
      // 出错时继续轮询，避免因网络问题导致轮询停止
      return {
        status: 'unknown',
        shouldContinue: true,
        messages: get().sessionMessages[sessionId] || [],
      };
    }
  },

  // 设置 session 消息
  setSessionMessages: (sessionId, messages) => {
    set(state => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: messages,
      },
    }));
  },

  // 添加消息到 session
  addMessageToSession: (sessionId, message) => {
    set(state => {
      const existingMessages = state.sessionMessages[sessionId] || [];
      const newMessages = [...existingMessages, message];
      // 按时间排序，确保消息顺序正确
      const sortedMessages = newMessages.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      });
      return {
        sessionMessages: {
          ...state.sessionMessages,
          [sessionId]: sortedMessages,
        },
      };
    });
  },

  // 更新单个消息（用于实时更新）
  updateMessage: (sessionId, messageId, updates) => {
    set(state => {
      const messages = state.sessionMessages[sessionId] || [];
      const index = messages.findIndex(m => m.id === messageId);

      if (index >= 0 && index < messages.length) {
        const existingMessage = messages[index];
        if (!existingMessage) {
          return state;
        }

        // 处理 updates 可能是 { data: {...} } 或直接是更新对象
        const updateData = 'data' in updates && updates.data ? updates.data : (updates as Partial<ChatMessages>);

        if (!updateData) {
          return state;
        }

        // 检查消息是否真的变化了（深度比较关键字段）
        const contentChanged = updateData.content !== undefined && existingMessage.content !== updateData.content;
        const toolCallsChanged =
          updateData.toolCalls !== undefined && JSON.stringify(existingMessage.toolCalls) !== JSON.stringify(updateData.toolCalls);
        const isCompleteChanged = updateData.isComplete !== undefined && existingMessage.isComplete !== updateData.isComplete;
        const isStreamingChanged = updateData.isStreaming !== undefined && existingMessage.isStreaming !== updateData.isStreaming;
        const metadataChanged = updateData.metadata !== undefined && JSON.stringify(existingMessage.metadata) !== JSON.stringify(updateData.metadata);

        // 只有当消息真正变化时才更新，避免不必要的重新渲染
        if (contentChanged || toolCallsChanged || isCompleteChanged || isStreamingChanged || metadataChanged) {
          // 合并更新，避免覆盖未更新的字段
          const updatedMessages = [...messages];
          updatedMessages[index] = {
            ...existingMessage,
            ...updateData,
            // 特殊处理 content：如果是增量更新，需要合并；如果是完整更新，直接替换
            content: updateData.content !== undefined ? updateData.content : existingMessage.content,
          } as ChatMessages;

          // 深度比较更新后的消息列表和现有的消息列表
          // 如果内容相同，保持原有引用，避免重新渲染
          if (areMessageListsEqual(updatedMessages, messages)) {
            return state;
          }

          return {
            sessionMessages: {
              ...state.sessionMessages,
              [sessionId]: updatedMessages,
            },
          };
        }
        // 如果消息没有变化，保持原有引用，不更新状态
      }

      return state;
    });
  },

  // 清空 session 消息
  clearSessionMessages: sessionId => {
    set(state => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: [],
      },
    }));
  },

  // 设置 session 的加载状态
  setSessionLoading: (sessionId, loading) => {
    set(state => ({
      sessionLoadingStates: {
        ...state.sessionLoadingStates,
        [sessionId]: loading,
      },
    }));
  },
}));
