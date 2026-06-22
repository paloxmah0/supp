import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  BarChart3,
  Clock,
  Gavel,
  Lock,
  Smartphone,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Stats() {
  const { tenders, registrations, bids, contracts } = useTenderHub();

  useSeoMeta({
    title: "Tender Statistics — TenderHub",
    description: "Platform analytics: tender volumes, category breakdowns, supplier growth, and on-chain contract activity.",
  });

  const totalTenders = tenders.tenders.length;
  const openTenders = tenders.tenders.filter((t) => t.status === "open").length;
  const awardedTenders = tenders.tenders.filter((t) => t.status === "awarded" || t.status === "in_progress" || t.status === "completed").length;
  const totalValue = tenders.tenders.reduce((s, t) => s + t.budgetAda, 0);
  const totalBids = bids.bids.length;
  const totalSuppliers = registrations.registrations.filter((r) => r.role === "supplier").length;
  const totalBuyers = registrations.registrations.filter((r) => r.role === "buyer").length;
  const verifiedSuppliers = registrations.registrations.filter((r) => r.role === "supplier" && r.kyc.status === "verified").length;
  const activeContracts = contracts.contracts.filter((c) => c.status === "active" || c.status === "funded" || c.status === "milestone_pending").length;
  const completedContracts = contracts.contracts.filter((c) => c.status === "completed").length;
  const disputedContracts = contracts.contracts.filter((c) => c.status === "disputed").length;
  const totalReleased = contracts.contracts.reduce((s, c) => s + c.releasedAmountAda, 0);
  const mpesaTenders = tenders.tenders.filter((t) => t.paymentMethod === "mpesa").length;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tenders.tenders) {
      const cat = t.category ?? "Other";
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [tenders.tenders]);

  // County breakdown
  const countyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tenders.tenders) {
      const cnty = t.county ?? "Unknown";
      map.set(cnty, (map.get(cnty) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [tenders.tenders]);

  // Publication type breakdown
  const pubTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tenders.tenders) {
      const pt = t.publicationType ?? "open_tender";
      map.set(pt, (map.get(pt) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [tenders.tenders]);

  const maxCategoryCount = Math.max(...categoryBreakdown.map(([, c]) => c), 1);
  const maxCountyCount = Math.max(...countyBreakdown.map(([, c]) => c), 1);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6" /> Tender Statistics
          </h1>
          <p className="mt-1 text-muted-foreground">
            Platform analytics — all data is on-chain and verifiable.
          </p>
        </div>

        {/* Overview stats */}
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <BigStat icon={<Gavel className="size-5" />} label="Total Tenders" value={totalTenders} sub={`${openTenders} open`} />
          <BigStat icon={<TrendingUp className="size-5 text-blue-600" />} label="Total Value" value={`${(totalValue / 1000).toFixed(1)}K`} sub="₳ in escrow" />
          <BigStat icon={<Users className="size-5 text-emerald-600" />} label="Suppliers" value={totalSuppliers} sub={`${verifiedSuppliers} verified`} />
          <BigStat icon={<Trophy className="size-5 text-amber-600" />} label="Awards" value={awardedTenders} sub={`${completedContracts} completed`} />
        </div>

        {/* On-chain stats */}
        <Card className="mb-6 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Lock className="size-5 text-blue-600" /> On-Chain Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat icon={<Lock className="size-4 text-emerald-600" />} label="Active Contracts" value={activeContracts} />
              <MiniStat icon={<Trophy className="size-4 text-blue-600" />} label="Completed" value={completedContracts} />
              <MiniStat icon={<Gavel className="size-4 text-orange-600" />} label="Disputed" value={disputedContracts} />
              <MiniStat icon={<Wallet className="size-4 text-emerald-600" />} label="Released" value={`${(totalReleased / 1000).toFixed(1)}K ₳`} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="size-4 text-green-600" />
              <span>{mpesaTenders} tender(s) funded via M-Pesa</span>
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Tenders by Category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
            ) : (
              categoryBreakdown.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-40 text-sm truncate shrink-0">{cat}</div>
                  <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${(count / maxCategoryCount) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-sm font-medium shrink-0">{count}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* County breakdown */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Top Counties / Regions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {countyBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
            ) : (
              countyBreakdown.map(([cnty, count]) => (
                <div key={cnty} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate shrink-0">{cnty}</div>
                  <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: `${(count / maxCountyCount) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-sm font-medium shrink-0">{count}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Publication type breakdown */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Publication Types</CardTitle></CardHeader>
          <CardContent>
            {pubTypeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pubTypeBreakdown.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm capitalize">{(type ?? "unknown").replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyers vs Suppliers */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Platform Participants</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{totalBuyers}</div>
                <div className="text-sm text-muted-foreground mt-1">Registered Buyers</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold text-emerald-600">{totalSuppliers}</div>
                <div className="text-sm text-muted-foreground mt-1">Registered Suppliers</div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <Clock className="inline size-4 mr-1" />
              {totalBids} total bids submitted across all tenders
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/tenders" className="text-blue-600 hover:underline">← Back to Tenders</Link>
        </div>
      </div>
    </Layout>
  );
}

function BigStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
