import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useCardanoWallet, type UseCardanoWalletReturn } from "@/hooks/useCardanoWallet";
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
  const registrations = useRegistrationStore();
  const tenders = useTenderStore();
  const bids = useBidStore();
  const contracts = useContractStore();

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
