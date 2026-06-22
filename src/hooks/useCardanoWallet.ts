import { useCallback, useEffect, useState } from "react";

import {
  type CardanoWalletSession,
  type WalletInfo,
  discoverWallets,
  enableWallet,
  isCorrectNetwork,
  NETWORK_LABEL,
  TARGET_NETWORK_ID,
} from "@/lib/cardano";
import { useToast } from "@/hooks/useToast";

const STORAGE_KEY = "cardano-tender-hub:wallet-session";

interface PersistedSession {
  address: string;
  walletKey: string;
  walletName: string;
  networkId: number;
}

function loadPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function persist(session: PersistedSession | null): void {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export interface UseCardanoWalletReturn {
  /** Available wallets injected by the browser. */
  availableWallets: WalletInfo[];
  /** Active wallet session (null if not connected). */
  session: CardanoWalletSession | null;
  /** True when we're in the middle of enabling a wallet. */
  isConnecting: boolean;
  /** True when the user has no Cardano wallets injected. */
  noWalletsDetected: boolean;
  /** True when the wallet is on the wrong network (not testnet). */
  wrongNetwork: boolean;
  /** Connect to a specific wallet. */
  connect: (walletKey: string) => Promise<void>;
  /** Disconnect the current wallet. */
  disconnect: () => void;
}

/**
 * Cardano wallet connection hook (Eternl / Typhon / Nami / etc).
 *
 * Detects injected CIP-30 wallets, lets the user connect, and persists the
 * session so the user stays "logged in" on refresh.  The actual signing API
 * stays live in `session.api` for data-signing operations.
 */
export function useCardanoWallet(): UseCardanoWalletReturn {
  const { toast } = useToast();
  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);
  const [session, setSession] = useState<CardanoWalletSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // On mount, discover wallets and restore persisted session
  useEffect(() => {
    const discover = () => {
      const wallets = discoverWallets();
      setAvailableWallets(wallets);
    };
    discover();

    // Re-check after a delay — wallets inject asynchronously
    const timer = setTimeout(discover, 1500);

    const persisted = loadPersisted();
    if (persisted) {
      // Re-enable the wallet silently
      enableWallet(persisted.walletKey)
        .then((sess) => {
          setSession(sess);
        })
        .catch(() => {
          // Silently ignore — user can reconnect manually
          persist(null);
        });
    }

    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(
    async (walletKey: string) => {
      setIsConnecting(true);
      try {
        const sess = await enableWallet(walletKey);

        // Enforce testnet
        if (!isCorrectNetwork(sess.networkId)) {
          toast({
            variant: "destructive",
            title: "Wrong network",
            description: `This app runs on ${NETWORK_LABEL}. Please switch your ${sess.walletName} wallet to testnet (network ID ${TARGET_NETWORK_ID}).`,
          });
          // Still set the session so they can see the warning
        }

        setSession(sess);
        persist({
          address: sess.address,
          walletKey: sess.walletKey,
          walletName: sess.walletName,
          networkId: sess.networkId,
        });
        toast({
          title: "Wallet connected",
          description: `Connected to ${sess.walletName} on ${NETWORK_LABEL}`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect wallet";
        toast({
          variant: "destructive",
          title: "Connection failed",
          description: message,
        });
      } finally {
        setIsConnecting(false);
      }
    },
    [toast],
  );

  const disconnect = useCallback(() => {
    setSession(null);
    persist(null);
    toast({
      title: "Wallet disconnected",
    });
  }, [toast]);

  return {
    availableWallets,
    session,
    isConnecting,
    noWalletsDetected: availableWallets.length === 0,
    wrongNetwork: session ? !isCorrectNetwork(session.networkId) : false,
    connect,
    disconnect,
  };
}
