import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  BadgeCheck,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TENDER_CATEGORIES, ALL_LOCATIONS } from "@/lib/kenyaData";
import { formatAda, shortAddr } from "@/lib/cardano";

export default function SupplierDirectory() {
  const { registrations } = useTenderHub();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [county, setCounty] = useState("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useSeoMeta({
    title: "Supplier Directory — TenderHub",
    description: "Browse verified suppliers. Filter by industry, county, and verification status.",
  });

  const suppliers = useMemo(() => {
    return registrations.registrations.filter((r) => {
      if (r.role !== "supplier") return false;
      if (verifiedOnly && r.kyc.status !== "verified") return false;
      if (category !== "All" && r.industry !== category) return false;
      if (county !== "All" && r.city !== county && r.country !== county) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.industry.toLowerCase().includes(q);
      }
      return true;
    });
  }, [registrations.registrations, search, category, county, verifiedOnly]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Supplier Directory</h1>
          <p className="mt-1 text-muted-foreground">
            Browse verified suppliers. All profiles are wallet-secured.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
          <StatBox icon={<Users className="size-4" />} label="Total Suppliers" value={registrations.registrations.filter((r) => r.role === "supplier").length} />
          <StatBox icon={<ShieldCheck className="size-4 text-emerald-600" />} label="KYC Verified" value={registrations.registrations.filter((r) => r.role === "supplier" && r.kyc.status === "verified").length} />
          <StatBox icon={<BadgeCheck className="size-4 text-blue-600" />} label="ISO Certified" value={registrations.registrations.filter((r) => r.role === "supplier" && r.iso.status === "verified").length} />
          <StatBox icon={<Building2 className="size-4 text-amber-600" />} label="Industries" value={new Set(registrations.registrations.filter((r) => r.role === "supplier").map((r) => r.industry)).size} />
        </div>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search suppliers by name, industry, or description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button onClick={() => setVerifiedOnly(!verifiedOnly)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors gap-1.5 flex items-center", verifiedOnly ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>
            <ShieldCheck className="size-3.5" /> KYC Verified Only
          </button>
          <select className="rounded-full border border-input bg-background px-3 py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All Industries</option>
            {TENDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-full border border-input bg-background px-3 py-1.5 text-sm" value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="All">All Locations</option>
            {ALL_LOCATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Results */}
        {suppliers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Building2 className="mx-auto size-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold text-lg">No suppliers found</h3>
              <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                {registrations.registrations.filter((r) => r.role === "supplier").length === 0
                  ? "No suppliers registered yet. Be the first!"
                  : "Try adjusting your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function SupplierCard({ supplier }: { supplier: ReturnType<typeof useTenderHub>["registrations"]["registrations"][number] }) {
  return (
    <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Building2 className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{supplier.name}</div>
            <div className="text-xs text-muted-foreground">{supplier.industry}</div>
          </div>
        </div>

        {supplier.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{supplier.description}</p>
        )}

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-3.5" />
            <span>{supplier.city}, {supplier.country}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs font-mono">{shortAddr(supplier.walletAddress)}</span>
          </div>
        </div>

        {/* Verification badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge status={supplier.kyc.status} />
          {supplier.iso.status === "verified" && (
            <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 gap-1">
              <BadgeCheck className="size-3" /> ISO
            </Badge>
          )}
          {supplier.portfolio.length > 0 && (
            <Badge variant="secondary" className="text-xs">{supplier.portfolio.length} projects</Badge>
          )}
        </div>

        {supplier.website && (
          <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-blue-600 hover:underline truncate">
            {supplier.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">{icon}</div>
        <div>
          <div className="text-lg font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
