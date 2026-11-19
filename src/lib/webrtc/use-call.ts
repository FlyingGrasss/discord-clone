"use client";

import {
  CALL_STUN_URLS,
  callAvatarColor,
  type CallIceCandidate,
  type CallPeer,
  type CallServerMessage,
  type CallSignalData,
  type ClientMessage,
  type ErrorPayload,
} from "@shared/protocol";
import type { RealtimeStatus } from "@/lib/realtime/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SPEAKING_THRESHOLD = 0.02;
const SPEAKING_POLL_MS = 100;
const JOIN_ACK_TIMEOUT_MS = 15_000;
const MICROPHONE_DENIED_MESSAGE = "Mikrofon izni verilmedi.";
const CALL_CONNECTION_FAILED_MESSAGE = "Ses bağlantısı kurulamadı.";
const CALL_DISCONNECTED_MESSAGE = "Bağlantı kesildi, görüşmeden ayrıldın.";
const SCREEN_DENIED_MESSAGE = "Ekran paylaşımı izni verilmedi.";
const SCREEN_FAILED_MESSAGE = "Ekran paylaşımı başlatılamadı.";

const SPEAKING_CLASSES = [
  "ring-2",
  "ring-[color:var(--success)]",
] as const;

export interface CallParticipant extends CallPeer {
  muted: boolean;
}

export interface MeydanCallDebugPeer {
  userId: string;
  username: string;
  connectionState: RTCPeerConnectionState;
  screenSharing: boolean;
}

export interface MeydanCallDebugState {
  channelId: string;
  selfId: string;
  joined: boolean;
  muted: boolean;
  screenSharing: boolean;
  participantCount: number;
  peers: MeydanCallDebugPeer[];
}

declare global {
  interface Window {
    /** Debug hook used by the Playwright call smoke test. */
    __meydanCallState?: MeydanCallDebugState;
  }
}

interface PeerRuntime {
  userId: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  remoteStream: MediaStream;
  videoSender: RTCRtpSender | null;
  analyser: AnalyserNode | null;
  analyserSource: MediaStreamAudioSourceNode | null;
  analyserSink: GainNode | null;
  timeData: Uint8Array<ArrayBuffer> | null;
  failureNotified: boolean;
}

export interface UseCallOptions {
  channelId: string;
  currentUser: { id: string; username: string };
  connectionState: RealtimeStatus;
  sendMessage: (message: ClientMessage) => boolean;
}

export interface CallController {
  joined: boolean;
  joining: boolean;
  muted: boolean;
  localScreenStream: MediaStream | null;
  participants: CallParticipant[];
  remoteParticipants: CallParticipant[];
  remoteStreams: Record<string, MediaStream>;
  peerConnectionStates: Record<string, RTCPeerConnectionState>;
  participantCount: number;
  /** Socket status, mirrored so the bar can gate joining while reconnecting. */
  connectionState: RealtimeStatus;
  /** Last user-facing call failure; cleared by the next successful action. */
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  toggleScreenShare: () => Promise<void>;
  handleCallEvent: (message: CallServerMessage) => void;
  handleServerError: (payload: ErrorPayload) => void;
  registerSpeakingTarget: (userId: string, element: HTMLElement | null) => void;
}

function applySpeakingState(element: HTMLElement, speaking: boolean): void {
  const next = speaking ? "true" : "false";
  if (element.dataset.speaking === next) return;

  element.dataset.speaking = next;
  for (const className of SPEAKING_CLASSES) {
    element.classList.toggle(className, speaking);
  }
}

function toIceCandidateJson(candidate: RTCIceCandidate): CallIceCandidate {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid ?? null,
    sdpMLineIndex: candidate.sdpMLineIndex ?? null,
    ...(candidate.usernameFragment === null
      ? {}
      : { usernameFragment: candidate.usernameFragment }),
  };
}

async function flushPendingCandidates(peer: PeerRuntime): Promise<void> {
  const pending = peer.pendingCandidates.splice(0);
  for (const candidate of pending) {
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch {
      // A stale candidate from a superseded description is safe to drop.
    }
  }
}

export function useCall(options: UseCallOptions): CallController {
  const { channelId, currentUser, connectionState, sendMessage } = options;

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(
    null,
  );
  const [remoteParticipants, setRemoteParticipants] = useState<CallParticipant[]>(
    [],
  );
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [peerConnectionStates, setPeerConnectionStates] = useState<
    Record<string, RTCPeerConnectionState>
  >({});
  const [error, setError] = useState<string | null>(null);

  const channelIdRef = useRef(channelId);
  const currentUserIdRef = useRef(currentUser.id);
  const sendRef = useRef(sendMessage);
  const statusRef = useRef<RealtimeStatus>(connectionState);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const joinAckPendingRef = useRef(false);
  const joinAckTimerRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSharePendingRef = useRef(false);
  const peersRef = useRef<Map<string, PeerRuntime>>(new Map());
  const speakingTargetsRef = useRef<Map<string, HTMLElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeRef = useRef(true);
  const callChannelRef = useRef(channelId);

  useEffect(() => {
    channelIdRef.current = channelId;
    currentUserIdRef.current = currentUser.id;
  }, [channelId, currentUser.id]);

  useEffect(() => {
    sendRef.current = sendMessage;
  }, [sendMessage]);

  const clearJoinAck = useCallback(() => {
    joinAckPendingRef.current = false;
    if (joinAckTimerRef.current !== null) {
      window.clearTimeout(joinAckTimerRef.current);
      joinAckTimerRef.current = null;
    }
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    const current = audioContextRef.current;
    if (current && current.state !== "closed") return current;

    try {
      const context = new window.AudioContext();
      audioContextRef.current = context;
      return context;
    } catch {
      return null;
    }
  }, []);

  const attachAnalyser = useCallback(
    (peer: PeerRuntime) => {
      if (peer.analyser) return;

      const context = getAudioContext();
      if (!context) return;

      try {
        const source = context.createMediaStreamSource(peer.remoteStream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;

        // Keep the graph alive without playing the remote audio twice; the
        // hidden <audio> element owns playback.
        const sink = context.createGain();
        sink.gain.value = 0;

        source.connect(analyser);
        analyser.connect(sink);
        sink.connect(context.destination);

        peer.analyserSource = source;
        peer.analyser = analyser;
        peer.analyserSink = sink;
        peer.timeData = new Uint8Array(analyser.fftSize);
        void context.resume().catch(() => undefined);
      } catch {
        // Analysis is a visual enhancement; loss of it must not break the call.
      }
    },
    [getAudioContext],
  );

  const removePeerRuntime = useCallback((userId: string) => {
    const peer = peersRef.current.get(userId);
    if (!peer) return;

    peersRef.current.delete(userId);
    peer.pc.onnegotiationneeded = null;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;

    try {
      peer.pc.close();
    } catch {
      // Already closed.
    }

    for (const track of peer.remoteStream.getTracks()) track.stop();
    peer.analyserSource?.disconnect();
    peer.analyser?.disconnect();
    peer.analyserSink?.disconnect();

    const target = speakingTargetsRef.current.get(userId);
    if (target) applySpeakingState(target, false);

    setRemoteStreams((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setPeerConnectionStates((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }, []);

  const teardownAll = useCallback(() => {
    for (const userId of [...peersRef.current.keys()]) {
      removePeerRuntime(userId);
    }

    const screenStream = screenStreamRef.current;
    screenStreamRef.current = null;
    if (screenStream) {
      for (const track of screenStream.getTracks()) {
        track.onended = null;
        track.stop();
      }
    }

    const localStream = localStreamRef.current;
    localStreamRef.current = null;
    if (localStream) {
      for (const track of localStream.getTracks()) track.stop();
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) void audioContext.close().catch(() => undefined);

    clearJoinAck();
    joinedRef.current = false;
    joiningRef.current = false;
    mutedRef.current = false;
    screenSharePendingRef.current = false;

    setJoined(false);
    setJoining(false);
    setMuted(false);
    setLocalScreenStream(null);
    setRemoteParticipants([]);
    setRemoteStreams({});
    setPeerConnectionStates({});
  }, [clearJoinAck, removePeerRuntime]);

  const setPeerState = useCallback(
    (userId: string, state: RTCPeerConnectionState) => {
      setPeerConnectionStates((current) =>
        current[userId] === state ? current : { ...current, [userId]: state },
      );
    },
    [],
  );

  const createPeer = useCallback(
    (peer: CallPeer) => {
      if (peersRef.current.has(peer.userId)) return;

      const localStream = localStreamRef.current;
      if (!localStream) return;

      const pc = new RTCPeerConnection({
        iceServers: CALL_STUN_URLS.map((url) => ({ urls: url })),
      });

      const runtime: PeerRuntime = {
        userId: peer.userId,
        pc,
        // Lower userId wins the polite role; the other side is impolite.
        polite: currentUserIdRef.current.localeCompare(peer.userId) < 0,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
        remoteStream: new MediaStream(),
        videoSender: null,
        analyser: null,
        analyserSource: null,
        analyserSink: null,
        timeData: null,
        failureNotified: false,
      };

      pc.onnegotiationneeded = (): void => {
        void (async () => {
          try {
            runtime.makingOffer = true;
            await pc.setLocalDescription();
            const description = pc.localDescription;
            if (description?.type === "offer" && description.sdp) {
              sendRef.current({
                type: "call:signal",
                channelId: channelIdRef.current,
                toUserId: peer.userId,
                data: { kind: "offer", sdp: description.sdp },
              });
            }
          } catch {
            // A simultaneous description won the race; perfect negotiation
            // reconciles the next negotiation round.
          } finally {
            runtime.makingOffer = false;
          }
        })();
      };

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
        if (!event.candidate) return;
        sendRef.current({
          type: "call:signal",
          channelId: channelIdRef.current,
          toUserId: peer.userId,
          data: { kind: "ice", candidate: toIceCandidateJson(event.candidate) },
        });
      };

      pc.ontrack = (event: RTCTrackEvent): void => {
        const alreadyAdded = runtime.remoteStream
          .getTracks()
          .some((track) => track.id === event.track.id);
        if (!alreadyAdded) runtime.remoteStream.addTrack(event.track);
        if (event.track.kind === "audio") attachAnalyser(runtime);

        setRemoteStreams((current) => {
          if (current[peer.userId] === runtime.remoteStream) return current;
          return { ...current, [peer.userId]: runtime.remoteStream };
        });
      };

      pc.onconnectionstatechange = (): void => {
        const nextState = pc.connectionState;
        setPeerState(peer.userId, nextState);

        if (nextState === "failed" && !runtime.failureNotified) {
          runtime.failureNotified = true;
          setError(CALL_CONNECTION_FAILED_MESSAGE);
        }
      };

      peersRef.current.set(peer.userId, runtime);

      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }

      // Negotiate the video m-line up front so screen sharing only needs
      // replaceTrack instead of a renegotiation.
      runtime.videoSender = pc.addTransceiver("video", {
        direction: "sendrecv",
      }).sender;

      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      if (screenTrack) {
        void runtime.videoSender.replaceTrack(screenTrack).catch(() => undefined);
      }
    },
    [attachAnalyser, setPeerState],
  );

  const ensurePeer = useCallback(
    (peer: CallPeer) => {
      if (!joinedRef.current) return;
      createPeer(peer);
    },
    [createPeer],
  );

  const handleSignal = useCallback(
    async (fromUserId: string, data: CallSignalData) => {
      const runtime = peersRef.current.get(fromUserId);
      if (!runtime) return;

      const { pc } = runtime;

      if (data.kind === "ice") {
        if (!data.candidate || runtime.ignoreOffer) return;
        if (!pc.remoteDescription) {
          runtime.pendingCandidates.push(data.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(data.candidate);
        } catch {
          // Candidate from a rolled-back description; safe to ignore.
        }
        return;
      }

      if (!data.sdp) return;

      if (data.kind === "answer") {
        runtime.ignoreOffer = false;
      }

      const description: RTCSessionDescriptionInit = {
        type: data.kind,
        sdp: data.sdp,
      };

      const readyForOffer =
        !runtime.makingOffer &&
        (pc.signalingState === "stable" || runtime.isSettingRemoteAnswerPending);
      const offerCollision =
        description.type === "offer" && !readyForOffer;

      runtime.ignoreOffer = !runtime.polite && offerCollision;
      if (runtime.ignoreOffer) return;

      if (offerCollision && runtime.polite) {
        const rollback: RTCSessionDescriptionInit = { type: "rollback" };
        try {
          await pc.setLocalDescription(rollback);
        } catch {
          return;
        }
      }

      runtime.isSettingRemoteAnswerPending = description.type === "answer";
      try {
        await pc.setRemoteDescription(description);
      } catch {
        runtime.isSettingRemoteAnswerPending = false;
        return;
      }
      runtime.isSettingRemoteAnswerPending = false;

      if (description.type === "offer") {
        try {
          await pc.setLocalDescription();
          const answer = pc.localDescription;
          if (answer?.type === "answer" && answer.sdp) {
            sendRef.current({
              type: "call:signal",
              channelId: channelIdRef.current,
              toUserId: fromUserId,
              data: { kind: "answer", sdp: answer.sdp },
            });
          }
        } catch {
          return;
        }
      }

      await flushPendingCandidates(runtime);
    },
    [],
  );

  const handleCallEvent = useCallback(
    (message: CallServerMessage) => {
      if (message.channelId !== channelIdRef.current) return;

      switch (message.type) {
        case "call:peers": {
          if (
            !joinedRef.current &&
            !joiningRef.current &&
            !joinAckPendingRef.current
          ) {
            return;
          }

          clearJoinAck();
          joinedRef.current = true;
          joiningRef.current = false;
          setJoined(true);
          setJoining(false);
          setError(null);

          const nextParticipants = message.peers.map((peer) => ({
            ...peer,
            muted: false,
          }));
          const nextIds = new Set(nextParticipants.map((peer) => peer.userId));

          for (const existingId of [...peersRef.current.keys()]) {
            if (!nextIds.has(existingId)) removePeerRuntime(existingId);
          }

          setRemoteParticipants(nextParticipants);
          for (const peer of nextParticipants) ensurePeer(peer);
          break;
        }
        case "call:peer-joined": {
          setRemoteParticipants((current) => {
            if (current.some((peer) => peer.userId === message.user.userId)) {
              return current;
            }
            return [...current, { ...message.user, muted: false }];
          });
          ensurePeer(message.user);
          break;
        }
        case "call:peer-left": {
          removePeerRuntime(message.userId);
          setRemoteParticipants((current) =>
            current.filter((peer) => peer.userId !== message.userId),
          );
          break;
        }
        case "call:state": {
          if (message.userId === currentUserIdRef.current) return;
          setRemoteParticipants((current) =>
            current.map((peer) =>
              peer.userId === message.userId
                ? {
                    ...peer,
                    muted: message.muted,
                    screenSharing: message.screenSharing,
                  }
                : peer,
            ),
          );
          break;
        }
        case "call:signal": {
          const data: CallSignalData =
            message.kind === "ice"
              ? { kind: "ice", candidate: message.candidate }
              : { kind: message.kind, sdp: message.sdp };
          void handleSignal(message.fromUserId, data);
          break;
        }
      }
    },
    [clearJoinAck, ensurePeer, handleSignal, removePeerRuntime],
  );

  const handleServerError = useCallback(
    (payload: ErrorPayload) => {
      // Message-send failures carry a clientId; only setup failures should
      // roll back a join in progress.
      if (payload.clientId) return;
      if (!joinAckPendingRef.current) return;

      clearJoinAck();
      setError(payload.message);
      teardownAll();
    },
    [clearJoinAck, teardownAll],
  );

  const join = useCallback(async () => {
    if (joinedRef.current || joiningRef.current) return;
    setError(null);

    if (statusRef.current !== "open") {
      setError(CALL_CONNECTION_FAILED_MESSAGE);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(MICROPHONE_DENIED_MESSAGE);
      return;
    }

    joiningRef.current = true;
    setJoining(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      joiningRef.current = false;
      setJoining(false);
      setError(MICROPHONE_DENIED_MESSAGE);
      return;
    }

    if (!activeRef.current || statusRef.current !== "open") {
      for (const track of stream.getTracks()) track.stop();
      joiningRef.current = false;
      setJoining(false);
      return;
    }

    localStreamRef.current = stream;
    mutedRef.current = false;
    joinedRef.current = true;
    joiningRef.current = false;
    setJoined(true);
    setJoining(false);
    setMuted(false);

    const sent = sendRef.current({
      type: "call:join",
      channelId: channelIdRef.current,
    });
    if (!sent) {
      teardownAll();
      setError(CALL_CONNECTION_FAILED_MESSAGE);
      return;
    }

    joinAckPendingRef.current = true;
    joinAckTimerRef.current = window.setTimeout(() => {
      joinAckTimerRef.current = null;
      if (!joinAckPendingRef.current) return;
      joinAckPendingRef.current = false;
      teardownAll();
      setError(CALL_CONNECTION_FAILED_MESSAGE);
    }, JOIN_ACK_TIMEOUT_MS);
  }, [teardownAll]);

  const leave = useCallback(() => {
    if (joinedRef.current || joiningRef.current) {
      sendRef.current({
        type: "call:leave",
        channelId: channelIdRef.current,
      });
    }
    setError(null);
    teardownAll();
  }, [teardownAll]);

  const toggleMute = useCallback(() => {
    if (!joinedRef.current) return;

    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;

    const localStream = localStreamRef.current;
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        track.enabled = !nextMuted;
      }
    }

    setMuted(nextMuted);
    sendRef.current({
      type: "call:state",
      channelId: channelIdRef.current,
      muted: nextMuted,
      screenSharing: screenStreamRef.current !== null,
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    const stream = screenStreamRef.current;
    if (!stream) return;

    screenStreamRef.current = null;
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.stop();
    }

    for (const peer of peersRef.current.values()) {
      void peer.videoSender?.replaceTrack(null).catch(() => undefined);
    }

    setLocalScreenStream(null);
    if (joinedRef.current) {
      sendRef.current({
        type: "call:state",
        channelId: channelIdRef.current,
        muted: mutedRef.current,
        screenSharing: false,
      });
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!joinedRef.current || screenStreamRef.current) return;
    if (screenSharePendingRef.current) return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(SCREEN_FAILED_MESSAGE);
      return;
    }

    screenSharePendingRef.current = true;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch (error) {
        const denied =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError");
        setError(denied ? SCREEN_DENIED_MESSAGE : SCREEN_FAILED_MESSAGE);
        return;
      }

      const track = stream.getVideoTracks()[0];
      if (!activeRef.current || !joinedRef.current || !track) {
        for (const item of stream.getTracks()) item.stop();
        if (!track) setError(SCREEN_FAILED_MESSAGE);
        return;
      }

      track.onended = () => stopScreenShare();

      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      setError(null);

      for (const peer of peersRef.current.values()) {
        if (!peer.videoSender) continue;
        try {
          await peer.videoSender.replaceTrack(track);
        } catch {
          // The sender may have closed between the click and this loop.
        }
      }

      sendRef.current({
        type: "call:state",
        channelId: channelIdRef.current,
        muted: mutedRef.current,
        screenSharing: true,
      });
    } finally {
      screenSharePendingRef.current = false;
    }
  }, [stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (!joinedRef.current) return;
    if (screenStreamRef.current) {
      stopScreenShare();
      return;
    }
    await startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  const registerSpeakingTarget = useCallback(
    (userId: string, element: HTMLElement | null) => {
      const previous = speakingTargetsRef.current.get(userId);
      if (previous && previous !== element) {
        applySpeakingState(previous, false);
      }

      if (!element) {
        speakingTargetsRef.current.delete(userId);
        return;
      }

      speakingTargetsRef.current.set(userId, element);
      applySpeakingState(element, false);
    },
    [],
  );

  useEffect(() => {
    statusRef.current = connectionState;

    if (connectionState !== "open" && joinedRef.current) {
      teardownAll();
      setError(CALL_DISCONNECTED_MESSAGE);
    }
  }, [connectionState, teardownAll]);

  // The channel page is keyed by channel id, but this guard keeps a call from
  // surviving a prop-level channel switch without an unmount.
  useEffect(() => {
    if (callChannelRef.current === channelId) return;
    callChannelRef.current = channelId;

    if (joinedRef.current || joiningRef.current) {
      teardownAll();
      setError(null);
    }
  }, [channelId, teardownAll]);

  useEffect(() => {
    if (!joined) return;

    const timer = window.setInterval(() => {
      for (const [userId, peer] of peersRef.current) {
        const target = speakingTargetsRef.current.get(userId);
        if (!target || !peer.analyser || !peer.timeData) continue;

        peer.analyser.getByteTimeDomainData(peer.timeData);

        let sum = 0;
        for (const value of peer.timeData) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / peer.timeData.length);
        applySpeakingState(target, rms > SPEAKING_THRESHOLD);
      }
    }, SPEAKING_POLL_MS);

    return () => window.clearInterval(timer);
  }, [joined]);

  useEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
      if (joinedRef.current) {
        sendRef.current({
          type: "call:leave",
          channelId: channelIdRef.current,
        });
      }
      teardownAll();

      if (
        typeof window !== "undefined" &&
        window.__meydanCallState?.channelId === channelIdRef.current
      ) {
        delete window.__meydanCallState;
      }
    };
  }, [teardownAll]);

  const selfParticipant = useMemo<CallParticipant>(
    () => ({
      userId: currentUser.id,
      username: currentUser.username,
      avatarColor: callAvatarColor(currentUser.id),
      screenSharing: localScreenStream !== null,
      muted,
    }),
    [currentUser.id, currentUser.username, localScreenStream, muted],
  );

  const participants = useMemo(
    () => (joined ? [selfParticipant, ...remoteParticipants] : []),
    [joined, remoteParticipants, selfParticipant],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.__meydanCallState = {
      channelId,
      selfId: currentUser.id,
      joined,
      muted,
      screenSharing: localScreenStream !== null,
      participantCount: joined ? remoteParticipants.length + 1 : 0,
      peers: remoteParticipants.map((peer) => ({
        userId: peer.userId,
        username: peer.username,
        connectionState: peerConnectionStates[peer.userId] ?? "new",
        screenSharing: peer.screenSharing,
      })),
    };
  }, [
    channelId,
    currentUser.id,
    joined,
    localScreenStream,
    muted,
    peerConnectionStates,
    remoteParticipants,
  ]);

  return {
    joined,
    joining,
    muted,
    localScreenStream,
    participants,
    remoteParticipants,
    remoteStreams,
    peerConnectionStates,
    participantCount: participants.length,
    connectionState,
    error,
    join,
    leave,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    handleCallEvent,
    handleServerError,
    registerSpeakingTarget,
  };
}
