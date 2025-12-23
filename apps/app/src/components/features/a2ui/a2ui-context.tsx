'use client';

import React, { createContext, useContext } from 'react';

interface A2UIContextValue {
  sessionId?: string;
  apiPrefix?: string;
  onEvent?: (event: { messageId: string; type: string; componentId: string; data?: Record<string, unknown> }) => void;
}

const A2UIContext = createContext<A2UIContextValue>({});

export function A2UIProvider({
  children,
  sessionId,
  apiPrefix,
  onEvent,
}: {
  children: React.ReactNode;
  sessionId?: string;
  apiPrefix?: string;
  onEvent?: (event: { messageId: string; type: string; componentId: string; data?: Record<string, unknown> }) => void;
}) {
  return <A2UIContext.Provider value={{ sessionId, apiPrefix, onEvent }}>{children}</A2UIContext.Provider>;
}

export function useA2UIContext() {
  return useContext(A2UIContext);
}

