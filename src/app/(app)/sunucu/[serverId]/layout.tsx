import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getMyServers, getWorkspace, requireUser } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sunucu",
  robots: { index: false, follow: false },
};

interface WorkspaceLayoutProps {
  children: ReactNode;
  params: Promise<{ serverId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { serverId } = await params;
  const nextPath = `/sunucu/${encodeURIComponent(serverId)}`;

  const [user, workspace, servers] = await Promise.all([
    requireUser(nextPath),
    getWorkspace(serverId),
    getMyServers(),
  ]);

  if (!workspace) {
    notFound();
  }

  return (
    <WorkspaceShell
      channels={workspace.channels}
      inviteCode={workspace.inviteCode}
      isOwner={workspace.isOwner}
      members={workspace.members}
      server={workspace}
      servers={servers}
      user={user}
    >
      {children}
    </WorkspaceShell>
  );
}
