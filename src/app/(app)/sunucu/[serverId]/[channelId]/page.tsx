import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChannelChat } from "@/components/chat/ChannelChat";
import { getChannelMessages } from "@/lib/chat-data";
import { getSessionUser, getWorkspace } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanal",
  robots: { index: false, follow: false },
};

interface ChannelPageProps {
  params: Promise<{ serverId: string; channelId: string }>;
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { serverId, channelId } = await params;
  const nextPath = `/sunucu/${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}`;

  const [user, workspace, messagesResult] = await Promise.all([
    getSessionUser(),
    getWorkspace(serverId),
    getChannelMessages(channelId),
  ]);

  if (!user || messagesResult.status === "unauthenticated") {
    redirect(`/giris?next=${encodeURIComponent(nextPath)}`);
  }

  if (!workspace || messagesResult.status !== "ok") {
    notFound();
  }

  if (messagesResult.page.channel.serverId !== serverId) {
    notFound();
  }

  const channel = workspace.channels.find((item) => item.id === channelId);
  if (!channel) {
    notFound();
  }

  const firstChannel = [...workspace.channels]
    .filter((item) => item.id !== channel.id)
    .sort(
      (left, right) =>
        left.position - right.position ||
        left.createdAt - right.createdAt ||
        left.id.localeCompare(right.id),
    )[0];

  const firstChannelHref = firstChannel
    ? `/sunucu/${encodeURIComponent(serverId)}/${encodeURIComponent(firstChannel.id)}`
    : `/sunucu/${encodeURIComponent(serverId)}`;

  return (
    <ChannelChat
      key={channel.id}
      channel={{ id: channel.id, name: channel.name }}
      currentUser={{
        id: user.id,
        username: user.username,
        isGuest: user.isGuest,
      }}
      firstChannelHref={firstChannelHref}
      initialMessages={messagesResult.page.messages}
      memberCount={workspace.members.length}
      server={{ id: workspace.id, name: workspace.name }}
    />
  );
}
