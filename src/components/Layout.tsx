import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Navbar } from "./Navbar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4-9 4-9-4z" />
                <path d="M3 12l9 4 9-4" />
                <path d="M3 17l9 4 9-4" />
              </svg>
            </div>
            <span className="font-semibold">TenderHub</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Secured by Cardano smart contracts · Aiken-powered escrow
          </p>
          <p className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Vibed with Shakespeare
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
