"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface WorkspaceUIValue {
  channelsOpen: boolean;
  membersOpen: boolean;
  openChannels: () => void;
  closeChannels: () => void;
  openMembers: () => void;
  closeMembers: () => void;
}

const WorkspaceUIContext = createContext<WorkspaceUIValue | null>(null);

export function WorkspaceUIProvider({ children }: { children: ReactNode }) {
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const openChannels = useCallback(() => {
    setMembersOpen(false);
    setChannelsOpen(true);
  }, []);

  const closeChannels = useCallback(() => {
    setChannelsOpen(false);
  }, []);

  const openMembers = useCallback(() => {
    setChannelsOpen(false);
    setMembersOpen(true);
  }, []);

  const closeMembers = useCallback(() => {
    setMembersOpen(false);
  }, []);

  const value = useMemo<WorkspaceUIValue>(
    () => ({
      channelsOpen,
      membersOpen,
      openChannels,
      closeChannels,
      openMembers,
      closeMembers,
    }),
    [
      channelsOpen,
      membersOpen,
      openChannels,
      closeChannels,
      openMembers,
      closeMembers,
    ],
  );

  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI(): WorkspaceUIValue {
  const context = useContext(WorkspaceUIContext);
  if (!context) {
    throw new Error("useWorkspaceUI, WorkspaceUIProvider içinde kullanılmalı.");
  }
  return context;
}
