import { useCallback, useEffect, useRef } from "react";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";

import { useCurrentUser } from "./useCurrentUser";
import type { Registration, Tender, Bid, EscrowContract } from "@/lib/types";

/**
 * Cross-device sync for TenderHub via Nostr NIP-78 (kind 30078).
 *
 * All platform state (registrations, tenders, bids, contracts) is published
 * as a single addressable event with d-tag "tenderhub-state". When another
 * device publishes a newer snapshot, this hook merges it into localStorage
 * using a per-entity last-write-wins strategy (by `updatedAt`), then notifies
 * the store hooks via a custom window event so React state stays in sync.
 *
 * Publishing is debounced (2 s) to avoid flooding relays on rapid changes.
 */

const KIND = 30078;
const D_TAG = "tenderhub-state";

// Storage keys — kept in sync with useTenderStore.ts
const REGISTRATIONS_KEY = "cardano-tender-hub:registrations";
const TENDERS_KEY = "cardano-tender-hub:tenders";
const BIDS_KEY = "cardano-tender-hub:bids";
const CONTRACTS_KEY = "cardano-tender-hub:contracts";

// Custom event dispatched when remote data has been merged into localStorage.
// Store hooks in the SAME tab listen for this and re-read from localStorage.
export const TENDERHUB_REMOTE_SYNC_EVENT = "tenderhub:remote-sync";

interface SyncState {
  registrations: Registration[];
  tenders: Tender[];
  bids: Bid[];
  contracts: EscrowContract[];
  syncedAt: number;
}

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

/**
 * Merge two arrays of entities by `id`, keeping the one with the latest
 * `updatedAt` timestamp. Entities that exist in only one side are kept.
 * This is a CRDT-style last-write-wins merge — concurrent creates on
 * different devices both survive.
 */
function mergeEntities<T extends { id: string; updatedAt: number }>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
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
  const pubkey = user?.pubkey;

  // Track the last remote `syncedAt` we applied so we don't re-apply the
  // same snapshot (e.g. our own echo coming back from relays).
  const lastAppliedSync = useRef(0);

  // Debounced publish timer
  const publishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether we are currently applying remote state (prevents publish loops)
  const isApplyingRemote = useRef(false);

  // ─── Publish ─────────────────────────────────────────────────────────

  const publishState = useCallback(async () => {
    if (!user) return;

    const state: SyncState = {
      registrations: load<Registration>(REGISTRATIONS_KEY),
      tenders: load<Tender>(TENDERS_KEY),
      bids: load<Bid>(BIDS_KEY),
      contracts: load<EscrowContract>(CONTRACTS_KEY),
      syncedAt: Date.now(),
    };

    try {
      const event = await user.signer.signEvent({
        kind: KIND,
        content: JSON.stringify(state),
        tags: [["d", D_TAG], ["client", "tenderhub"]],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      console.warn("[TenderHub sync] Failed to publish state:", err);
    }
  }, [user, nostr]);

  /**
   * Request a debounced publish. Called by store hooks whenever local data
   * changes. Multiple rapid changes are coalesced into a single publish.
   */
  const requestPublish = useCallback(() => {
    if (isApplyingRemote.current) return; // Don't re-publish remote changes
    if (publishTimeout.current) clearTimeout(publishTimeout.current);
    publishTimeout.current = setTimeout(() => {
      publishState().catch(() => {});
    }, 2000);
  }, [publishState]);

  // ─── Subscribe ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!pubkey) return;

    let cancelled = false;

    /**
     * Apply a remote Nostr event: parse, merge into localStorage, and
     * notify store hooks in the current tab.
     */
    const applyRemoteState = (event: NostrEvent) => {
      try {
        const remote = JSON.parse(event.content) as SyncState;
        if (!remote.syncedAt || remote.syncedAt <= lastAppliedSync.current) {
          return; // Stale or already applied
        }

        isApplyingRemote.current = true;
        lastAppliedSync.current = remote.syncedAt;

        // Merge each entity type
        const mergedRegs = mergeEntities(
          load<Registration>(REGISTRATIONS_KEY),
          remote.registrations ?? [],
        );
        save(REGISTRATIONS_KEY, mergedRegs);

        const mergedTenders = mergeEntities(
          load<Tender>(TENDERS_KEY),
          remote.tenders ?? [],
        );
        save(TENDERS_KEY, mergedTenders);

        const mergedBids = mergeEntities(
          load<Bid>(BIDS_KEY),
          remote.bids ?? [],
        );
        save(BIDS_KEY, mergedBids);

        const mergedContracts = mergeEntities(
          load<EscrowContract>(CONTRACTS_KEY),
          remote.contracts ?? [],
        );
        save(CONTRACTS_KEY, mergedContracts);

        // Broadcast to other tabs in this browser
        broadcastChange(REGISTRATIONS_KEY, mergedRegs);
        broadcastChange(TENDERS_KEY, mergedTenders);
        broadcastChange(BIDS_KEY, mergedBids);
        broadcastChange(CONTRACTS_KEY, mergedContracts);

        // Notify store hooks in THIS tab to re-read localStorage
        window.dispatchEvent(new CustomEvent(TENDERHUB_REMOTE_SYNC_EVENT));

        console.log("[TenderHub sync] Applied remote state from", event.created_at);
        isApplyingRemote.current = false;
      } catch (err) {
        isApplyingRemote.current = false;
        console.warn("[TenderHub sync] Failed to apply remote state:", err);
      }
    };

    /**
     * Initial fetch + live subscription + polling fallback.
     */
    const startSync = async () => {
      // 1. Initial fetch — get the latest snapshot
      try {
        const events = await nostr.query(
          [{ kinds: [KIND], authors: [pubkey!], "#d": [D_TAG], limit: 1 }],
          { signal: AbortSignal.timeout(5000) },
        );
        if (!cancelled && events.length > 0) {
          applyRemoteState(events[0]);
        }
      } catch (err) {
        console.warn("[TenderHub sync] Initial fetch failed:", err);
      }

      // 2. Live subscription for real-time updates
      try {
        const sub = nostr.req([
          { kinds: [KIND], authors: [pubkey!], "#d": [D_TAG], limit: 0 },
        ]);

        for await (const event of sub) {
          if (cancelled) break;
          applyRemoteState(event);
        }
      } catch (err) {
        // If the live subscription fails, fall back to polling
        console.warn("[TenderHub sync] Live subscription failed, falling back to polling:", err);
      }
    };

    startSync();

    // 3. Polling fallback — every 15 seconds, re-fetch the latest event.
    // This catches updates if the live subscription silently dies.
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      try {
        const events = await nostr.query(
          [{ kinds: [KIND], authors: [pubkey!], "#d": [D_TAG], limit: 1 }],
          { signal: AbortSignal.timeout(5000) },
        );
        if (!cancelled && events.length > 0) {
          applyRemoteState(events[0]);
        }
      } catch {
        // best-effort
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [pubkey, nostr]);

  return { requestPublish };
}
