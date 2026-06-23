import { useCallback, useEffect, useState } from "react";

import type {
  AuditEntry,
  Bid,
  Dispute,
  DisputeEvidence,
  EscrowContract,
  Milestone,
  MilestoneEvidence,
  PortfolioItem,
  Registration,
  Tender,
} from "@/lib/types";

import { TENDERHUB_REMOTE_SYNC_EVENT } from "./useTenderHubSync";

/**
 * A localStorage-backed store for the Cardano Tender Hub.
 *
 * In production this would be an Aiken smart-contract + Cardano indexer,
 * but the interface stays the same.
 *
 * Cross-device sync is handled by `useTenderHubSync` (see that file for
 * details). Each store hook here:
 *  - Saves to localStorage on every change
 *  - Broadcasts to other tabs via BroadcastChannel (same-browser sync)
 *  - Calls the `onSyncChange` callback (provided by the sync hook) to
 *    trigger a debounced Nostr publish for cross-device sync
 *  - Listens for `tenderhub:remote-sync` custom events (dispatched by the
 *    sync hook when remote data has been merged into localStorage) and
 *    re-reads from localStorage to update React state
 *  - Listens for `storage` events and BroadcastChannel messages for
 *    same-browser cross-tab sync
 */

const REGISTRATIONS_KEY = "cardano-tender-hub:registrations";
const TENDERS_KEY = "cardano-tender-hub:tenders";
const BIDS_KEY = "cardano-tender-hub:bids";
const CONTRACTS_KEY = "cardano-tender-hub:contracts";

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

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function auditEntry(actor: string, actorName: string, action: string, details: string, txHash?: string): AuditEntry {
  return { id: uid(), timestamp: Date.now(), actor, actorName, action, details, txHash };
}

function broadcastChange(key: string, data: unknown[]): void {
  try {
    const channel = new BroadcastChannel(`tenderhub:${key}`);
    channel.postMessage({ type: "sync", data });
    channel.close();
  } catch {
    // ignore
  }
}

/**
 * Set up listeners for cross-tab and cross-device updates.
 *
 * - `storage` events: fired by the browser when another tab writes to
 *   localStorage (same-origin, same-browser).
 * - `BroadcastChannel`: more reliable cross-tab messaging within the same
 *   browser. The sync hook also uses this to notify tabs when it has merged
 *   remote Nostr data into localStorage.
 * - `TENDERHUB_REMOTE_SYNC_EVENT`: a custom window event dispatched by the
 *   sync hook when remote data from another device has been merged into
 *   localStorage. This is the key mechanism for cross-device sync within
 *   the current tab.
 */
function setupStorageSync<T>(
  key: string,
  setter: (data: T[]) => void,
): () => void {
  const reread = () => setter(load<T>(key));

  const handleStorage = (e: StorageEvent) => {
    if (e.key !== key || !e.newValue) return;
    reread();
  };

  const handleRemoteSync = () => reread();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(TENDERHUB_REMOTE_SYNC_EVENT, handleRemoteSync);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(`tenderhub:${key}`);
    channel.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "sync" && Array.isArray(e.data.data)) {
        setter(e.data.data as T[]);
      }
    };
  } catch {
    // BroadcastChannel not available
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(TENDERHUB_REMOTE_SYNC_EVENT, handleRemoteSync);
    channel?.close();
  };
}

// ─── Registration ──────────────────────────────────────────────────────

export interface UseRegistrationStore {
  registrations: Registration[];
  getRegistration: (address: string) => Registration | undefined;
  upsertRegistration: (reg: Registration) => void;
  updateRegistration: (address: string, updates: Partial<Registration>) => void;
  addPortfolioItem: (address: string, item: Omit<PortfolioItem, "id">) => void;
  updatePortfolioItem: (address: string, itemId: string, updates: Partial<PortfolioItem>) => void;
  removePortfolioItem: (address: string, itemId: string) => void;
}

export function useRegistrationStore(onSyncChange?: () => void): UseRegistrationStore {
  const [registrations, setRegistrations] = useState<Registration[]>(() =>
    load<Registration>(REGISTRATIONS_KEY),
  );

  useEffect(() => {
    save(REGISTRATIONS_KEY, registrations);
    broadcastChange(REGISTRATIONS_KEY, registrations);
    onSyncChange?.();
  }, [registrations, onSyncChange]);

  // Listen for cross-tab/cross-device updates
  useEffect(() => {
    return setupStorageSync<Registration>(REGISTRATIONS_KEY, setRegistrations);
  }, []);

  const getRegistration = useCallback(
    (address: string) => registrations.find((r) => r.walletAddress === address),
    [registrations],
  );

  const upsertRegistration = useCallback((reg: Registration) => {
    setRegistrations((prev) => {
      const idx = prev.findIndex((r) => r.walletAddress === reg.walletAddress);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = reg;
        return next;
      }
      return [...prev, reg];
    });
  }, []);

  const updateRegistration = useCallback(
    (address: string, updates: Partial<Registration>) => {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.walletAddress === address
            ? { ...r, ...updates, updatedAt: Date.now() }
            : r,
        ),
      );
    },
    [],
  );

  const addPortfolioItem = useCallback(
    (address: string, item: Omit<PortfolioItem, "id">) => {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.walletAddress === address
            ? { ...r, updatedAt: Date.now(), portfolio: [...r.portfolio, { ...item, id: uid() }] }
            : r,
        ),
      );
    },
    [],
  );

  const updatePortfolioItem = useCallback(
    (address: string, itemId: string, updates: Partial<PortfolioItem>) => {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.walletAddress === address
            ? { ...r, updatedAt: Date.now(), portfolio: r.portfolio.map((p) => (p.id === itemId ? { ...p, ...updates } : p)) }
            : r,
        ),
      );
    },
    [],
  );

  const removePortfolioItem = useCallback((address: string, itemId: string) => {
    setRegistrations((prev) =>
      prev.map((r) =>
        r.walletAddress === address
          ? { ...r, updatedAt: Date.now(), portfolio: r.portfolio.filter((p) => p.id !== itemId) }
          : r,
      ),
    );
  }, []);

  return { registrations, getRegistration, upsertRegistration, updateRegistration, addPortfolioItem, updatePortfolioItem, removePortfolioItem };
}

// ─── Tenders ───────────────────────────────────────────────────────────

export interface UseTenderStore {
  tenders: Tender[];
  getTender: (id: string) => Tender | undefined;
  createTender: (tender: Omit<Tender, "id" | "createdAt" | "updatedAt">) => Tender;
  updateTender: (id: string, updates: Partial<Tender>) => void;
  deleteTender: (id: string) => void;
}

export function useTenderStore(onSyncChange?: () => void): UseTenderStore {
  const [tenders, setTenders] = useState<Tender[]>(() => load<Tender>(TENDERS_KEY));

  useEffect(() => {
    save(TENDERS_KEY, tenders);
    broadcastChange(TENDERS_KEY, tenders);
    onSyncChange?.();
  }, [tenders, onSyncChange]);

  // Listen for cross-tab/cross-device updates
  useEffect(() => {
    return setupStorageSync<Tender>(TENDERS_KEY, setTenders);
  }, []);

  const getTender = useCallback((id: string) => tenders.find((t) => t.id === id), [tenders]);

  const createTender = useCallback((tender: Omit<Tender, "id" | "createdAt" | "updatedAt">): Tender => {
    const now = Date.now();
    const full: Tender = { ...tender, id: uid(), createdAt: now, updatedAt: now };
    setTenders((prev) => [full, ...prev]);
    return full;
  }, []);

  const updateTender = useCallback((id: string, updates: Partial<Tender>) => {
    setTenders((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)));
  }, []);

  const deleteTender = useCallback((id: string) => {
    setTenders((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tenders, getTender, createTender, updateTender, deleteTender };
}

// ─── Bids ──────────────────────────────────────────────────────────────

export interface UseBidStore {
  bids: Bid[];
  getBidsForTender: (tenderId: string) => Bid[];
  getBidsBySupplier: (address: string) => Bid[];
  createBid: (bid: Omit<Bid, "id" | "createdAt" | "updatedAt" | "status">) => Bid;
  updateBid: (id: string, updates: Partial<Bid>) => void;
}

export function useBidStore(onSyncChange?: () => void): UseBidStore {
  const [bids, setBids] = useState<Bid[]>(() => load<Bid>(BIDS_KEY));

  useEffect(() => {
    save(BIDS_KEY, bids);
    broadcastChange(BIDS_KEY, bids);
    onSyncChange?.();
  }, [bids, onSyncChange]);

  // Listen for cross-tab/cross-device updates
  useEffect(() => {
    return setupStorageSync<Bid>(BIDS_KEY, setBids);
  }, []);

  const getBidsForTender = useCallback((tenderId: string) => bids.filter((b) => b.tenderId === tenderId), [bids]);
  const getBidsBySupplier = useCallback((address: string) => bids.filter((b) => b.supplierAddress === address), [bids]);

  const createBid = useCallback((bid: Omit<Bid, "id" | "createdAt" | "updatedAt" | "status">): Bid => {
    const now = Date.now();
    const full: Bid = { ...bid, id: uid(), status: "submitted", createdAt: now, updatedAt: now };
    setBids((prev) => [full, ...prev]);
    return full;
  }, []);

  const updateBid = useCallback((id: string, updates: Partial<Bid>) => {
    setBids((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b)));
  }, []);

  return { bids, getBidsForTender, getBidsBySupplier, createBid, updateBid };
}

// ─── Escrow Contracts ──────────────────────────────────────────────────

export interface UseContractStore {
  contracts: EscrowContract[];
  getContract: (id: string) => EscrowContract | undefined;
  getContractByTender: (tenderId: string) => EscrowContract | undefined;
  createContract: (contract: Omit<EscrowContract, "id" | "createdAt" | "updatedAt" | "auditLog" | "releasedAmountAda">) => EscrowContract;
  updateContract: (id: string, updates: Partial<EscrowContract>) => void;
  /** Update a specific milestone within a contract. */
  updateMilestone: (contractId: string, milestoneId: string, updates: Partial<Milestone>) => void;
  /** Add evidence to a milestone. */
  addMilestoneEvidence: (contractId: string, milestoneId: string, evidence: Omit<MilestoneEvidence, "id" | "submittedAt">) => void;
  /** Add an audit entry to a contract. */
  addAuditEntry: (contractId: string, entry: Omit<AuditEntry, "id" | "timestamp">) => void;
  /** File a dispute on a contract. */
  fileDispute: (contractId: string, dispute: Omit<Dispute, "id" | "createdAt" | "updatedAt" | "status" | "evidence">) => void;
  /** Add evidence to a dispute. */
  addDisputeEvidence: (contractId: string, disputeId: string, evidence: Omit<DisputeEvidence, "id" | "submittedAt">) => void;
  /** Resolve a dispute. */
  resolveDispute: (contractId: string, disputeId: string, resolution: { status: Dispute["status"]; ruling: string; splitPercentage?: number; arbitrator: string; arbitratorName: string }) => void;
  /** Request a mid-process cancellation. */
  requestCancellation: (contractId: string, cancellation: { initiatedBy: "buyer" | "supplier"; initiatorAddress: string; initiatorName: string; reason: string }) => void;
  /** Accept a pending cancellation request (mutual cancel). */
  acceptCancellation: (contractId: string, acceptorAddress: string, acceptorName: string) => void;
  /** Reject a pending cancellation request. */
  rejectCancellation: (contractId: string, rejectorAddress: string, rejectorName: string) => void;
}

export function useContractStore(onSyncChange?: () => void): UseContractStore {
  const [contracts, setContracts] = useState<EscrowContract[]>(() => load<EscrowContract>(CONTRACTS_KEY));

  useEffect(() => {
    save(CONTRACTS_KEY, contracts);
    broadcastChange(CONTRACTS_KEY, contracts);
    onSyncChange?.();
  }, [contracts, onSyncChange]);

  // Listen for cross-tab/cross-device updates
  useEffect(() => {
    return setupStorageSync<EscrowContract>(CONTRACTS_KEY, setContracts);
  }, []);

  const getContract = useCallback((id: string) => contracts.find((c) => c.id === id), [contracts]);
  const getContractByTender = useCallback((tenderId: string) => contracts.find((c) => c.tenderId === tenderId), [contracts]);

  const createContract = useCallback((contract: Omit<EscrowContract, "id" | "createdAt" | "updatedAt" | "auditLog" | "releasedAmountAda">): EscrowContract => {
    const now = Date.now();
    const full: EscrowContract = {
      ...contract,
      id: uid(),
      releasedAmountAda: 0,
      createdAt: now,
      updatedAt: now,
      auditLog: [auditEntry(contract.buyerAddress, contract.buyerName, "contract_created", `Escrow funded with ${contract.totalAmountAda} ₳`, contract.fundingTxHash)],
    };
    setContracts((prev) => [full, ...prev]);
    return full;
  }, []);

  const updateContract = useCallback((id: string, updates: Partial<EscrowContract>) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)));
  }, []);

  const updateMilestone = useCallback((contractId: string, milestoneId: string, updates: Partial<Milestone>) => {
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        updatedAt: Date.now(),
        milestones: c.milestones.map((m) => (m.id === milestoneId ? { ...m, ...updates } : m)),
      };
    }));
  }, []);

  const addMilestoneEvidence = useCallback((contractId: string, milestoneId: string, evidence: Omit<MilestoneEvidence, "id" | "submittedAt">) => {
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        updatedAt: Date.now(),
        milestones: c.milestones.map((m) => m.id === milestoneId
          ? { ...m, evidence: [...m.evidence, { ...evidence, id: uid(), submittedAt: Date.now() }] }
          : m),
      };
    }));
  }, []);

  const addAuditEntry = useCallback((contractId: string, entry: Omit<AuditEntry, "id" | "timestamp">) => {
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      return { ...c, updatedAt: Date.now(), auditLog: [...c.auditLog, { ...entry, id: uid(), timestamp: Date.now() }] };
    }));
  }, []);

  const fileDispute = useCallback((contractId: string, dispute: Omit<Dispute, "id" | "createdAt" | "updatedAt" | "status" | "evidence">) => {
    const now = Date.now();
    const fullDispute: Dispute = { ...dispute, id: uid(), status: "open", evidence: [], createdAt: now, updatedAt: now };
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        updatedAt: now,
        status: "disputed",
        disputes: [...c.disputes, fullDispute],
        auditLog: [...c.auditLog, auditEntry(dispute.filedBy, dispute.filedByName, "dispute_filed", `Dispute filed: ${dispute.title}`)],
      };
    }));
  }, []);

  const addDisputeEvidence = useCallback((contractId: string, disputeId: string, evidence: Omit<DisputeEvidence, "id" | "submittedAt">) => {
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        updatedAt: Date.now(),
        disputes: c.disputes.map((d) => d.id === disputeId
          ? { ...d, updatedAt: Date.now(), evidence: [...d.evidence, { ...evidence, id: uid(), submittedAt: Date.now() }] }
          : d),
      };
    }));
  }, []);

  const resolveDispute = useCallback((contractId: string, disputeId: string, resolution: { status: Dispute["status"]; ruling: string; splitPercentage?: number; arbitrator: string; arbitratorName: string }) => {
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      const now = Date.now();
      const newStatus = resolution.status === "resolved_buyer" || resolution.status === "resolved_supplier" || resolution.status === "resolved_split" ? "completed" : "active";
      return {
        ...c,
        updatedAt: now,
        status: newStatus as EscrowContract["status"],
        disputes: c.disputes.map((d) => d.id === disputeId
          ? { ...d, status: resolution.status, ruling: resolution.ruling, splitPercentage: resolution.splitPercentage, resolvedAt: now, updatedAt: now, arbitrator: resolution.arbitrator, arbitratorName: resolution.arbitratorName }
          : d),
        auditLog: [...c.auditLog, auditEntry(resolution.arbitrator, resolution.arbitratorName, "dispute_resolved", `Ruling: ${resolution.ruling}`)],
      };
    }));
  }, []);

  const requestCancellation = useCallback((contractId: string, cancellation: { initiatedBy: "buyer" | "supplier"; initiatorAddress: string; initiatorName: string; reason: string }) => {
    const now = Date.now();
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId) return c;
      // Determine fair settlement based on completed milestones
      const completedMilestones = c.milestones.filter((m) => m.status === "approved");
      const hasInProgress = c.milestones.some((m) => m.status === "in_progress" || m.status === "submitted");
      let settlement: "full_refund_buyer" | "supplier_paid_completed" | "partial_split" = "full_refund_buyer";
      let supplierKeepPercent: number | undefined;

      if (completedMilestones.length > 0 && !hasInProgress) {
        // Supplier keeps released amounts; buyer gets the rest
        settlement = "supplier_paid_completed";
      } else if (hasInProgress) {
        // There's in-progress work — supplier should get partial compensation
        settlement = "partial_split";
        supplierKeepPercent = 50; // Default 50% of remaining for in-progress work
      } else {
        // No work done — full refund
        settlement = "full_refund_buyer";
      }

      return {
        ...c,
        updatedAt: now,
        cancellation: {
          initiatedBy: cancellation.initiatedBy,
          initiatorAddress: cancellation.initiatorAddress,
          initiatorName: cancellation.initiatorName,
          reason: cancellation.reason,
          requestedAt: now,
          status: "requested",
          settlement,
          supplierKeepPercent,
        },
        auditLog: [...c.auditLog, auditEntry(cancellation.initiatorAddress, cancellation.initiatorName, "cancellation_requested", `${cancellation.initiatedBy === "buyer" ? "Buyer" : "Supplier"} requested cancellation: ${cancellation.reason}`)],
      };
    }));
  }, []);

  const acceptCancellation = useCallback((contractId: string, acceptorAddress: string, acceptorName: string) => {
    const now = Date.now();
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId || !c.cancellation) return c;
      const txHash = `cancel_${now.toString(36)}`;
      return {
        ...c,
        updatedAt: now,
        status: "cancelled" as const,
        cancellation: {
          ...c.cancellation,
          initiatedBy: "mutual" as const,
          acceptedAt: now,
          status: "enforced" as const,
          txHash,
        },
        auditLog: [...c.auditLog, auditEntry(acceptorAddress, acceptorName, "cancellation_accepted", `Cancellation accepted. Settlement: ${c.cancellation.settlement}`, txHash)],
      };
    }));
  }, []);

  const rejectCancellation = useCallback((contractId: string, rejectorAddress: string, rejectorName: string) => {
    const now = Date.now();
    setContracts((prev) => prev.map((c) => {
      if (c.id !== contractId || !c.cancellation) return c;
      return {
        ...c,
        updatedAt: now,
        cancellation: { ...c.cancellation, status: "rejected" as const },
        auditLog: [...c.auditLog, auditEntry(rejectorAddress, rejectorName, "cancellation_rejected", `Cancellation request rejected`)],
      };
    }));
  }, []);

  return {
    contracts,
    getContract,
    getContractByTender,
    createContract,
    updateContract,
    updateMilestone,
    addMilestoneEvidence,
    addAuditEntry,
    fileDispute,
    addDisputeEvidence,
    resolveDispute,
    requestCancellation,
    acceptCancellation,
    rejectCancellation,
  };
}

export { uid };
