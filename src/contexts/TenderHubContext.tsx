import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useCardanoWallet, type UseCardanoWalletReturn } from "@/hooks/useCardanoWallet";
import { useTenderHubSync } from "@/hooks/useTenderHubSync";
import {
  useRegistrationStore,
  useTenderStore,
  useBidStore,
  useContractStore,
  type UseRegistrationStore,
  type UseTenderStore,
  type UseBidStore,
  type UseContractStore,
} from "@/hooks/useTenderStore";

interface TenderHubContextValue {
  wallet: UseCardanoWalletReturn;
  registrations: UseRegistrationStore;
  tenders: UseTenderStore;
  bids: UseBidStore;
  contracts: UseContractStore;
}

const TenderHubContext = createContext<TenderHubContextValue | undefined>(undefined);

export function TenderHubProvider({ children }: { children: ReactNode }) {
  const wallet = useCardanoWallet();

  // Cross-device sync via Nostr NIP-78. Returns a debounced publish
  // function that each store calls when local data changes.
  const { requestPublish } = useTenderHubSync();

  const registrations = useRegistrationStore(requestPublish);
  const tenders = useTenderStore(requestPublish);
  const bids = useBidStore(requestPublish);
  const contracts = useContractStore(requestPublish);

  const value = useMemo<TenderHubContextValue>(
    () => ({ wallet, registrations, tenders, bids, contracts }),
    [wallet, registrations, tenders, bids, contracts],
  );

  return (
    <TenderHubContext.Provider value={value}>
      {children}
    </TenderHubContext.Provider>
  );
}

export function useTenderHub(): TenderHubContextValue {
  const ctx = useContext(TenderHubContext);
  if (!ctx) {
    throw new Error("useTenderHub must be used within a TenderHubProvider");
  }
  return ctx;
}
