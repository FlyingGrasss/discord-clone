"use client";

import { useCallback } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type {
  CallController,
  CallParticipant,
} from "@/lib/webrtc/use-call";

export interface CallBarProps {
  call: CallController;
}

const chipClass =
  "flex min-w-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--elevated)] px-2 py-1 text-xs text-[color:var(--text)] ring-offset-2 ring-offset-[color:var(--surface)]";

function ParticipantChip({
  participant,
  registerSpeakingTarget,
}: {
  participant: CallParticipant;
  registerSpeakingTarget: CallController["registerSpeakingTarget"];
}) {
  // A stable ref callback keeps the imperative speaking ring from resetting
  // every time the call bar re-renders for an unrelated state change.
  const targetRef = useCallback(
    (element: HTMLLIElement | null) => {
      registerSpeakingTarget(participant.userId, element);
    },
    [participant.userId, registerSpeakingTarget],
  );

  return (
    <li
      className={chipClass}
      data-call-participant={participant.userId}
      ref={targetRef}
    >
      <Avatar
        color={participant.avatarColor}
        name={participant.username}
        size="sm"
      />
      <span className="max-w-[9rem] truncate font-medium">
        {participant.username}
      </span>
      {participant.muted ? (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
          Sessiz
        </span>
      ) : null}
      {participant.screenSharing ? (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[color:var(--accent-text)]">
          Ekran
        </span>
      ) : null}
    </li>
  );
}

export function CallBar({ call }: CallBarProps) {
  const canJoin = call.connectionState === "open";

  return (
    <section
      aria-label="Sesli sohbet"
      className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {call.joined ? (
          <>
            <span
              aria-live="polite"
              className="mr-1 text-xs font-medium text-[color:var(--text)]"
            >
              {call.participantCount} kişi görüşmede
            </span>
            <Button
              aria-pressed={call.muted}
              onClick={call.toggleMute}
              size="sm"
              variant="secondary"
            >
              {call.muted ? "Sesi aç" : "Sustur"}
            </Button>
            <Button
              onClick={() => {
                void call.toggleScreenShare();
              }}
              size="sm"
              variant="secondary"
            >
              {call.localScreenStream ? "Paylaşımı durdur" : "Ekranı paylaş"}
            </Button>
            <Button onClick={call.leave} size="sm" variant="danger">
              Ayrıl
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={!canJoin}
              loading={call.joining}
              onClick={() => {
                void call.join();
              }}
              size="sm"
            >
              {call.joining ? "Katılınıyor…" : "Sesli sohbete katıl"}
            </Button>
            <Button disabled size="sm" variant="secondary">
              Ekranı paylaş
            </Button>
          </>
        )}
      </div>

      {call.joined && call.participants.length > 0 ? (
        <ul
          aria-label="Görüşmedeki kişiler"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          {call.participants.map((participant) => (
            <ParticipantChip
              key={participant.userId}
              participant={participant}
              registerSpeakingTarget={call.registerSpeakingTarget}
            />
          ))}
        </ul>
      ) : null}

      {call.error ? (
        <p
          className="mt-1.5 text-xs text-[color:var(--danger-text)]"
          role="status"
        >
          {call.error}
        </p>
      ) : null}
    </section>
  );
}
