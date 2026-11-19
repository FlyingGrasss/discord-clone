"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface WorkspacePresenceValue {
  onlineUserIds: Set<string>;
  setOnlineUsers: (ids: string[]) => void;
  addOnlineUser: (id: string) => void;
  removeOnlineUser: (id: string) => void;
}

const WorkspacePresenceContext = createContext<WorkspacePresenceValue | null>(null);

export interface WorkspacePresenceProviderProps {
  children: ReactNode;
  /** The current user is online from the moment the workspace shell renders. */
  initialOnlineUserIds?: string[];
}

export function WorkspacePresenceProvider({
  children,
  initialOnlineUserIds = [],
}: WorkspacePresenceProviderProps) {
  const [onlineUserIds, setOnlineUserIdsState] = useState<Set<string>>(
    () => new Set(initialOnlineUserIds),
  );

  const setOnlineUsers = useCallback((ids: string[]) => {
    setOnlineUserIdsState(new Set(ids));
  }, []);

  const addOnlineUser = useCallback((id: string) => {
    setOnlineUserIdsState((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const removeOnlineUser = useCallback((id: string) => {
    setOnlineUserIdsState((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<WorkspacePresenceValue>(
    () => ({
      onlineUserIds,
      setOnlineUsers,
      addOnlineUser,
      removeOnlineUser,
    }),
    [onlineUserIds, setOnlineUsers, addOnlineUser, removeOnlineUser],
  );

  return (
    <WorkspacePresenceContext.Provider value={value}>
      {children}
    </WorkspacePresenceContext.Provider>
  );
}

export function useWorkspacePresence(): WorkspacePresenceValue {
  const context = useContext(WorkspacePresenceContext);
  if (!context) {
    throw new Error(
      "useWorkspacePresence, WorkspacePresenceProvider içinde kullanılmalı.",
    );
  }
  return context;
}
