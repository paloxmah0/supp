import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ExternalLink, Loader2, Wallet, X } from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { formatAda, generateDID, IS_TESTNET, NETWORK_LABEL, TESTNET_FAUCET_URL } from "@/lib/cardano";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function WalletButton() {
  const { wallet } = useTenderHub();
  const { session, isConnecting, availableWallets, noWalletsDetected, wrongNetwork, connect, disconnect } = wallet;
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  if (session) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("gap-2 max-w-[220px] sm:max-w-none", wrongNetwork && "border-destructive")}>
            <span className={cn("size-2 rounded-full animate-pulse", wrongNetwork ? "bg-destructive" : "bg-emerald-500")} />
            <span className="truncate font-mono text-xs">{generateDID(session.address)}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span>{session.walletName}</span>
            <span className="text-xs font-normal text-muted-foreground truncate font-mono">
              {generateDID(session.address)}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-medium">{formatAda(session.lovelace)}</span>
          </div>
          <div className="px-2 py-1.5 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Network</span>
            <Badge variant={wrongNetwork ? "destructive" : "secondary"}>
              {session.networkId === 1 ? "Mainnet" : "Testnet (Preview)"}
            </Badge>
          </div>
          {wrongNetwork && (
            <div className="px-2 py-2 text-xs text-destructive space-y-1">
              <div className="flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3" /> Wrong Network
              </div>
              <p>Switch to {NETWORK_LABEL} in your {session.walletName} wallet settings.</p>
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnect} className="text-destructive focus:text-destructive">
            Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (isConnecting) {
    return (
      <Button disabled className="gap-2">
        <Loader2 className="size-4 animate-spin" />
        Connecting…
      </Button>
    );
  }

  if (noWalletsDetected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Wallet className="size-4" />
            Connect Wallet
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>No wallets detected</DropdownMenuLabel>
          <div className="px-2 py-2 text-sm text-muted-foreground space-y-2">
            <p>Install a Cardano wallet extension to continue:</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="https://eternl.io" target="_blank" rel="noopener noreferrer" className="gap-2">
              Eternl <ExternalLink className="size-3 ml-auto" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://typhonwallet.io" target="_blank" rel="noopener noreferrer" className="gap-2">
              Typhon <ExternalLink className="size-3 ml-auto" />
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (availableWallets.length === 1) {
    return (
      <Button onClick={() => connect(availableWallets[0].key)} className="gap-2">
        <Wallet className="size-4" />
        Connect {availableWallets[0].name}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setShowWalletPicker(true)} className="gap-2">
        <Wallet className="size-4" />
        Connect Wallet
      </Button>
      {showWalletPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowWalletPicker(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Select a wallet</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowWalletPicker(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {availableWallets.map((w) => (
                <button
                  key={w.key}
                  onClick={() => {
                    setShowWalletPicker(false);
                    connect(w.key);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent",
                  )}
                >
                  {w.icon ? (
                    <img src={w.icon} alt={w.name} className="size-8 rounded" />
                  ) : (
                    <div className="size-8 rounded bg-primary/10 flex items-center justify-center">
                      <Wallet className="size-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">Click to connect</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Navbar() {
  const { wallet, registrations } = useTenderHub();
  const session = wallet.session;
  const registration = session
    ? registrations.getRegistration(session.address)
    : undefined;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l9-4 9 4-9 4-9-4z" />
              <path d="M3 12l9 4 9-4" />
              <path d="M3 17l9 4 9-4" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-base leading-tight">TenderHub</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Cardano Smart Contracts</div>
          </div>
        </Link>

        {/* Testnet badge */}
        {IS_TESTNET && (
          <a href={TESTNET_FAUCET_URL} target="_blank" rel="noopener noreferrer" className="hidden lg:block">
            <Badge variant="outline" className="gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              Testnet (Preview) — Get test ADA
            </Badge>
          </a>
        )}

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/tenders">Tenders</NavLink>
          <NavLink to="/suppliers">Suppliers</NavLink>
          <NavLink to="/stats">Stats</NavLink>
          {session && <NavLink to="/dashboard">Dashboard</NavLink>}
          {session && registration && <NavLink to="/portfolio">Portfolio</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {session && !registration && (
            <Button asChild size="sm" className="hidden sm:flex">
              <Link to="/register">Complete Registration</Link>
            </Button>
          )}
          <WalletButton />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/tenders">Tenders</NavLink>
        <NavLink to="/suppliers">Suppliers</NavLink>
        <NavLink to="/stats">Stats</NavLink>
        {session && <NavLink to="/dashboard">Dashboard</NavLink>}
        {session && registration && <NavLink to="/portfolio">Portfolio</NavLink>}
      </nav>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
