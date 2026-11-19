import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateChannelModal } from "@/components/workspace/CreateChannelModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWorkspace } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sunucu",
  robots: { index: false, follow: false },
};

interface WorkspaceIndexPageProps {
  params: Promise<{ serverId: string }>;
}

export default async function WorkspaceIndexPage({
  params,
}: WorkspaceIndexPageProps) {
  const { serverId } = await params;
  const workspace = await getWorkspace(serverId);

  if (!workspace) {
    notFound();
  }

  const firstChannel = [...workspace.channels].sort(
    (left, right) =>
      left.position - right.position ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id),
  )[0];

  if (firstChannel) {
    redirect(
      `/sunucu/${encodeURIComponent(serverId)}/${encodeURIComponent(firstChannel.id)}`,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <EmptyState
        action={
          workspace.isOwner ? (
            <CreateChannelModal serverId={workspace.id} />
          ) : undefined
        }
        description={
          workspace.isOwner
            ? "Sohbeti başlatmak için ilk kanalı oluştur."
            : "Kanal açıldığında sohbet burada görünecek."
        }
        icon="hash"
        title={
          workspace.isOwner
            ? "Bu sunucuda henüz kanal yok."
            : "Sunucu sahibi henüz bir kanal oluşturmadı."
        }
      />
    </div>
  );
}
