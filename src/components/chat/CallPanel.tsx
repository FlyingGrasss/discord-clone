"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { CallParticipant } from "@/lib/webrtc/use-call";

export interface CallPanelProps {
  localScreenStream: MediaStream | null;
  remoteParticipants: CallParticipant[];
  remoteStreams: Record<string, MediaStream>;
  onStopScreenShare: () => void;
}

interface ShareTile {
  key: string;
  label: string;
  stream: MediaStream;
  local: boolean;
}

function hasVideoTrack(stream: MediaStream): boolean {
  return stream
    .getVideoTracks()
    .some((track) => track.readyState !== "ended");
}

function StreamVideo({
  stream,
  label,
  className,
}: {
  stream: MediaStream;
  label: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    element.muted = true;
    element.srcObject = stream;
    void element.play().catch(() => undefined);

    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      aria-label={label}
      autoPlay
      className={cn("block bg-black object-contain", className)}
      muted
      playsInline
      ref={videoRef}
    />
  );
}

function RemoteAudio({
  userId,
  stream,
}: {
  userId: string;
  stream: MediaStream;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    element.srcObject = stream;
    void element.play().catch(() => undefined);

    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <audio
      aria-hidden="true"
      autoPlay
      className="hidden"
      data-call-audio={userId}
      muted={false}
      ref={audioRef}
    />
  );
}

export function CallPanel({
  localScreenStream,
  remoteParticipants,
  remoteStreams,
  onStopScreenShare,
}: CallPanelProps) {
  const panelId = useId();
  const [collapsed, setCollapsed] = useState(false);

  const remoteTiles = useMemo<ShareTile[]>(() => {
    return remoteParticipants.flatMap((participant) => {
      if (!participant.screenSharing) return [];
      const stream = remoteStreams[participant.userId];
      if (!stream || !hasVideoTrack(stream)) return [];

      return [
        {
          key: `remote-${participant.userId}`,
          label: `${participant.username} ekran paylaşımı`,
          stream,
          local: false,
        },
      ];
    });
  }, [remoteParticipants, remoteStreams]);

  const localTile = useMemo<ShareTile | null>(() => {
    if (!localScreenStream) return null;
    return {
      key: "local-screen",
      label: "Ekran paylaşımı önizlemesi",
      stream: localScreenStream,
      local: true,
    };
  }, [localScreenStream]);

  const primaryRemote = remoteTiles[0] ?? null;
  const primary = primaryRemote ?? localTile;
  const thumbnails = [
    ...remoteTiles.slice(primaryRemote ? 1 : 0),
    ...(primaryRemote && localTile ? [localTile] : []),
  ];
  const hasVisibleContent = primary !== null;

  useEffect(() => {
    if (!hasVisibleContent) setCollapsed(false);
  }, [hasVisibleContent]);

  const audioStreams = Object.entries(remoteStreams);

  return (
    <>
      {audioStreams.map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} userId={userId} />
      ))}

      {hasVisibleContent ? (
        <section
          aria-label="Ekran paylaşımı"
          className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
            <p className="text-xs font-medium text-[color:var(--muted)]">
              Ekran paylaşımı
            </p>
            <button
              aria-controls={panelId}
              aria-expanded={!collapsed}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)]"
              onClick={() => setCollapsed((current) => !current)}
              type="button"
            >
              {collapsed ? "Göster" : "Gizle"}
              <Icon
                className={cn(collapsed ? "" : "rotate-180")}
                name="chevron-down"
                size={14}
              />
            </button>
          </div>

          {collapsed ? null : (
            <div className="px-3 pb-2 sm:px-4" id={panelId}>
              {primary ? (
                <div className="relative overflow-hidden rounded-lg border border-[color:var(--border)] bg-black">
                  <StreamVideo
                    className="aspect-video max-h-[45vh] w-full rounded-lg"
                    label={primary.label}
                    stream={primary.stream}
                  />
                  {primary.local ? (
                    <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/70 px-2 py-1.5">
                      <span className="text-xs font-medium text-white">
                        Ekranın paylaşılıyor
                      </span>
                      <Button
                        onClick={onStopScreenShare}
                        size="sm"
                        variant="danger"
                      >
                        Paylaşımı durdur
                      </Button>
                    </div>
                  ) : (
                    <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                      {primary.label}
                    </span>
                  )}
                </div>
              ) : null}

              {thumbnails.length > 0 ? (
                <ul
                  aria-label="Diğer ekran paylaşımları"
                  className="mt-2 flex items-start gap-2 overflow-x-auto pb-1"
                >
                  {thumbnails.map((tile) => (
                    <li
                      className="w-44 shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] sm:w-52"
                      key={tile.key}
                    >
                      <StreamVideo
                        className="aspect-video w-full rounded-t-lg"
                        label={tile.label}
                        stream={tile.stream}
                      />
                      {tile.local ? (
                        <div className="flex flex-col gap-1 p-1.5">
                          <span className="truncate text-[11px] font-medium text-[color:var(--text)]">
                            Ekranın paylaşılıyor
                          </span>
                          <Button
                            className="w-full"
                            onClick={onStopScreenShare}
                            size="sm"
                            variant="danger"
                          >
                            Paylaşımı durdur
                          </Button>
                        </div>
                      ) : (
                        <p className="truncate px-1.5 py-1 text-[11px] font-medium text-[color:var(--text)]">
                          {tile.label}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
