import type {
  MessageDeletedEvent,
  MessageNewEvent,
  MessageUpdatedEvent,
} from "../shared/types.js";

export interface AppEvents {
  "message:new": MessageNewEvent;
  "message:updated": MessageUpdatedEvent;
  "message:deleted": MessageDeletedEvent;
}

type Listener<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

/**
 * Small typed in-process event bus. U2 subscribes here to fan out chat events
 * over WebSocket; the chat service is the only current emitter.
 */
export class EventBus {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on<K extends keyof AppEvents>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    const wrapped = listener as (payload: unknown) => void;
    set.add(wrapped);

    return () => {
      set?.delete(wrapped);
    };
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[events] ${event} dinleyicisi hata verdi:`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
