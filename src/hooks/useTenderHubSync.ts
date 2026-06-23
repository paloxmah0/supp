import { useCallback, useEffect, useRef } from "react";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";

import { useCurrentUser } from "./useCurrentUser";
import type { Registration, Tender, Bid, EscrowContract } from "@/lib/types";

/**
 * TenderHub public cross-user sync protocol via Nostr NIP-78.
 *
 * ## The problem this solves
 *
 * The old sync only queried the current user's own events
 * (`authors: [myPubkey]`), so a buyer using Nostr account A could never
 * see a tender published by a supplier using account B.  Data was trapped
 * per-user.
 *
 * ## The protocol
 *
 * Every TenderHub entity (registration, tender, bid, contract) is published
 * as a **separate, public** NIP-78 addressable event (kind 30078):
 *
 *   kind: 30078
 *   tags: [["t", "tenderhub"], ["d", "<entity-type>:<entity-id>"], ["entity", "<type>"], ...]
 *   content: JSON of the entity
 *
 * The `#t` tag (`tenderhub`) is the global discovery tag — **any** user on
 * **any** device can subscribe to `{ kinds: [30078], "#t": ["tenderhub"] }`
 * and see tenders/bids/contracts from everyone, not just themselves.
 *
 * Each entity type gets a distinct `d`-tag prefix so relays store them as
 * separate addressable events (not one giant blob):
 *
 *   d = "tender:<id>"       — a tender
 *   d = "bid:<id>"          — a bid
 *   d = "contract:<id>"     — an escrow contract
 *   d = "registration:<id>" — a user registration
 *
 * ## Merge strategy
 *
 * Incoming remote events are merged per-entity (by `id`, last-write-wins
 * by `updatedAt`). This is a CRDT-style merge: concurrent creates on
 * different devices both survive; updates from the device with the newer
 * `updatedAt` win.
 *
 * ## Echo prevention
 *
 * When we apply a remote event we set a flag so our own store hooks don't
 * immediately re-publish it (which would create an infinite loop).
 * Additionally, the merge function only replaces an entity if the remote
 * `updatedAt` is strictly greater than the local one.
 */

const KIND = 30078;
const T_TAG = "tenderhub";

// Entity type strings
const ENTITY_REGISTRATION = "registration";
const ENTITY_TENDER = "tender";
const ENTITY_BID = "bid";
const ENTITY_CONTRACT = "contract";

// Storage keys — kept in sync with useTenderStore.ts
const REGISTRATIONS_KEY = "cardano-tender-hub:registrations";
const TENDERS_KEY = "cardano-tender-hub:tenders";
const BIDS_KEY = "cardano-tender-hub:bids";
const CONTRACTS_KEY = "cardano-tender-hub:contracts";

// Custom event dispatched when remote data has been merged into localStorage.
// Store hooks in the SAME tab listen for this and re-read from localStorage.
export const TENDERHUB_REMOTE_SYNC_EVENT = "tenderhub:remote-sync";

// ─── localStorage helpers (mirror useTenderStore.ts) ───────────────────

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Merge logic ───────────────────────────────────────────────────────

interface Entity {
  id: string;
  updatedAt: number;
}

/**
 * Merge two arrays of entities by `id`, keeping the one with the latest
 * `updatedAt` timestamp. Entities that exist in only one side are kept.
 * This is a CRDT-style last-write-wins merge — concurrent creates on
 * different devices both survive.
 *
 * Returns the merged array, or `null` if nothing changed (so the caller
 * can skip unnecessary writes / broadcasts).
 */
function mergeEntities<T extends Entity>(
  local: T[],
  remote: T[],
): T[] | null {
  let changed = false;
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      changed = true;
    } else if (item.updatedAt > existing.updatedAt) {
      map.set(item.id, item);
      changed = true;
    }
  }
  return changed ? [...map.values()] : null;
}

function broadcastChange(key: string, data: unknown[]): void {
  try {
    const channel = new BroadcastChannel(`tenderhub:${key}`);
    channel.postMessage({ type: "sync", data });
    channel.close();
  } catch {
    // BroadcastChannel not available
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useTenderHubSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Debounced publish timers, keyed by entity id so different entities
  // don't block each other.
  const publishTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Whether we are currently applying remote state (prevents publish loops)
  const isApplyingRemote = useRef(false);

  // ─── Publish a single entity ──────────────────────────────────────────

  const publishEntity = useCallback(
    async (entityType: string, entity: Entity) => {
      if (!user) return;

      const dTag = `${entityType}:${entity.id}`;

      try {
        const event = await user.signer.signEvent({
          kind: KIND,
          content: JSON.stringify(entity),
          tags: [
            ["t", T_TAG],
            ["d", dTag],
            ["entity", entityType],
            ["entity_id", entity.id],
            ["updated_at", String(entity.updatedAt)],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      } catch (err) {
        console.warn(`[TenderHub sync] Failed to publish ${entityType} ${entity.id}:`, err);
      }
    },
    [user, nostr],
  );

  /**
   * Request a debounced publish for a single entity.  Called by store hooks
   * whenever local data changes.  Each entity id gets its own timer so
   * rapid edits to different entities don't block each other.
   */
  const requestPublish = useCallback(
    (entityType: string, entity: Entity) => {
      if (isApplyingRemote.current) return; // Don't re-publish remote changes

      const timerKey = `${entityType}:${entity.id}`;
      const existing = publishTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        publishTimers.current.delete(timerKey);
        publishEntity(entityType, entity).catch(() => {});
      }, 1500);

      publishTimers.current.set(timerKey, timer);
    },
    [publishEntity],
  );

  // ─── Subscribe (global — ALL users, not just me) ──────────────────────

  useEffect(() => {
    let cancelled = false;

    /**
     * Apply a single remote Nostr event: parse, merge into localStorage, and
     * notify store hooks in the current tab.
     */
    const applyRemoteEvent = (event: NostrEvent) => {
      try {
        const entityType = event.tags.find(([n]) => n === "entity")?.[1];
        if (!entityType) return;

        const remote = JSON.parse(event.content) as Entity;
        if (!remote.id || !remote.updatedAt) return;

        isApplyingRemote.current = true;

        let merged: Entity[] | null = null;
        let storageKey = "";
        let setter: ((data: unknown[]) => void) | null = null;

        switch (entityType) {
          case ENTITY_REGISTRATION: {
            const local = load<Registration>(REGISTRATIONS_KEY);
            merged = mergeEntities(local, [remote as Registration]);
            storageKey = REGISTRATIONS_KEY;
            break;
          }
          case ENTITY_TENDER: {
            const local = load<Tender>(TENDERS_KEY);
            merged = mergeEntities(local, [remote as Tender]);
            storageKey = TENDERS_KEY;
            break;
          }
          case ENTITY_BID: {
            const local = load<Bid>(BIDS_KEY);
            merged = mergeEntities(local, [remote as Bid]);
            storageKey = BIDS_KEY;
            break;
          }
          case ENTITY_CONTRACT: {
            const local = load<EscrowContract>(CONTRACTS_KEY);
            merged = mergeEntities(local, [remote as EscrowContract]);
            storageKey = CONTRACTS_KEY;
            break;
          }
          default:
            isApplyingRemote.current = false;
            return;
        }

        if (merged && storageKey) {
          save(storageKey, merged);
          broadcastChange(storageKey, merged);
          window.dispatchEvent(new CustomEvent(TENDERHUB_REMOTE_SYNC_EVENT));
          console.log(`[TenderHub sync] Merged remote ${entityType} from ${event.pubkey.slice(0, 12)}…`);
        }

        isApplyingRemote.current = false;
      } catch (err) {
        isApplyingRemote.current = false;
        console.warn("[TenderHub sync] Failed to apply remote event:", err);
      }
    };

    /**
     * Initial fetch + live subscription + polling fallback.
     *
     * KEY: NO `authors` filter — we subscribe to ALL TenderHub events from
     * ALL users. This is how a buyer sees a supplier's bid, and vice versa.
     */
    const startSync = async () => {
      // 1. Initial fetch — get recent events from everyone
      try {
        const events = await nostr.query(
          [{ kinds: [KIND], "#t": [T_TAG], limit: 500 }],
          { signal: AbortSignal.timeout(8000) },
        );
        if (!cancelled) {
          // Apply oldest-first so the latest updatedAt wins
          for (const event of events.sort((a, b) => a.created_at - b.created_at)) {
            applyRemoteEvent(event);
          }
        }
      } catch (err) {
        console.warn("[TenderHub sync] Initial fetch failed:", err);
      }

      // 2. Live subscription for real-time updates from ALL users
      try {
        const sub = nostr.req([
          { kinds: [KIND], "#t": [T_TAG], limit: 0 },
        ]);

        for await (const event of sub) {
          if (cancelled) break;
          applyRemoteEvent(event);
        }
      } catch (err) {
        console.warn("[TenderHub sync] Live subscription failed, falling back to polling:", err);
      }
    };

    startSync();

    // 3. Polling fallback — every 15s, re-fetch recent events.
    // This catches updates if the live subscription silently dies.
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      try {
        const events = await nostr.query(
          [{ kinds: [KIND], "#t": [T_TAG], limit: 100 }],
          { signal: AbortSignal.timeout(5000) },
        );
        if (!cancelled) {
          for (const event of events) {
            applyRemoteEvent(event);
          }
        }
      } catch {
        // best-effort
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      // Clear any pending publish timers
      for (const timer of publishTimers.current.values()) {
        clearTimeout(timer);
      }
      publishTimers.current.clear();
    };
  }, [nostr]);

  return { requestPublish };
}
