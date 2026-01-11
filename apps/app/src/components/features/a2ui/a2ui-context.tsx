'use client';

import React, { createContext, useContext } from 'react';

interface A2UIContextValue {
  sessionId?: string;
  onEvent?: (event: { messageId: string; type: string; componentId: string; data?: Record<string, unknown> }) => void;
}

const A2UIContext = createContext<A2UIContextValue>({});

export function A2UIProvider({
  children,
  sessionId,
  onEvent,
}: {
  children: React.ReactNode;
  sessionId?: string;
  onEvent?: (event: { messageId: string; type: string; componentId: string; data?: Record<string, unknown> }) => void;
}) {
  return <A2UIContext.Provider value={{ sessionId, onEvent }}>{children}</A2UIContext.Provider>;
}

export function useA2UIContext() {
  return useContext(A2UIContext);
}
