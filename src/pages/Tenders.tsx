import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  Building2,
  Calendar,
  Clock,
  Gavel,
  MapPin,
  Plus,
  Search,
  Trophy,
  TrendingUp,
  Users,
  Bookmark,
  BookmarkCheck,
  Filter,
  X,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tender } from "@/lib/types";
import {
  TENDER_CATEGORIES,
  ALL_LOCATIONS,
  PUBLICATION_TYPES,
  formatPublicationType,
  formatAgpo,
} from "@/lib/kenyaData";

const STORAGE_KEY = "cardano-tender-hub:saved-tenders";

function loadSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveSaved(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function Tenders() {
  const { tenders, contracts, wallet, registrations } = useTenderHub();
  const session = wallet.session;
  const registration = session ? registrations.getRegistration(session.address) : undefined;
  const isVerified = registration?.kyc.status === "verified";
  const canPostTender = session && registration?.role === "buyer" && isVerified;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [county, setCounty] = useState("All");
  const [pubType, setPubType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("open");
  const [showClosingSoon, setShowClosingSoon] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedTenders, setSavedTenders] = useState<string[]>(loadSaved);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useSeoMeta({
    title: "Browse Tenders — TenderHub",
    description: "Browse open tenders on the Cardano-secured tender platform. Filter by county, category, procuring entity, and publication type.",
  });

  const toggleSave = (id: string) => {
    const next = savedTenders.includes(id) ? savedTenders.filter((s) => s !== id) : [...savedTenders, id];
    setSavedTenders(next);
    saveSaved(next);
  };

  const filtered = useMemo(() => {
    return tenders.tenders.filter((t) => {
      if (showSavedOnly && !savedTenders.includes(t.id)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (category !== "All" && t.category !== category) return false;
      if (county !== "All" && (t.county ?? "") !== county) return false;
      if (pubType !== "All" && (t.publicationType ?? "open_tender") !== pubType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.buyerName.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          (t.procuringEntity ?? "").toLowerCase().includes(q) ||
          (t.referenceNumber?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [tenders.tenders, search, category, county, pubType, statusFilter, showClosingSoon, showSavedOnly, savedTenders]);

  // Contract awards (awarded tenders)
  const awardedTenders = tenders.tenders.filter((t) => t.status === "awarded" || t.status === "in_progress" || t.status === "completed");
  const activeCount = tenders.tenders.filter((t) => t.status === "open").length;
  const totalValue = tenders.tenders.reduce((s, t) => s + t.budgetAda, 0);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tender Marketplace</h1>
            <p className="mt-1 text-muted-foreground">
              Browse tenders — secured by Cardano smart contracts.
            </p>
          </div>
          {canPostTender ? (
            <Button className="gap-2" asChild>
              <Link to="/tenders/new"><Plus className="size-4" /> Post a Tender</Link>
            </Button>
          ) : session && registration && !isVerified ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">KYC verification required to post</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/suppliers">Get Verified</Link>
              </Button>
            </div>
          ) : session && !registration ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Register to post tenders</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/register">Register</Link>
              </Button>
            </div>
          ) : !session ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Connect wallet to interact</p>
            </div>
          ) : null}
        </div>

        {/* Stats bar */}
        <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatPill icon={<Gavel className="size-4" />} label="Total Tenders" value={String(tenders.tenders.length)} />
          <StatPill icon={<Clock className="size-4 text-emerald-600" />} label="Open Now" value={String(activeCount)} />
          <StatPill icon={<TrendingUp className="size-4 text-blue-600" />} label="Total Value" value={`${(totalValue / 1000).toFixed(0)}K ₳`} />
          <StatPill icon={<Trophy className="size-4 text-amber-600" />} label="Awards Published" value={String(awardedTenders.length)} />
        </div>

        {/* Search bar */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, entity, reference number, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => setShowAdvanced(!showAdvanced)}>
            <Filter className="size-4" /> Filters
          </Button>
        </div>

        {/* Quick filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {["open", "evaluating", "awarded", "all"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors", statusFilter === s ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {s}
            </button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={() => setShowClosingSoon(!showClosingSoon)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors gap-1.5 flex items-center", showClosingSoon ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>
            <Clock className="size-3.5" /> Closing ≤ 7 days
          </button>
          <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors gap-1.5 flex items-center", showSavedOnly ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent")}>
            {showSavedOnly ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />} Saved ({savedTenders.length})
          </button>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3 rounded-xl border bg-muted/30 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {TENDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">County / Region</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="All">All Counties</option>
                <optgroup label="Kenya Counties">
                  {ALL_LOCATIONS.slice(0, 47).map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <optgroup label="East Africa">
                  {ALL_LOCATIONS.slice(47).map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Publication Type</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={pubType} onChange={(e) => setPubType(e.target.value)}>
                <option value="All">All Types</option>
                {PUBLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {(category !== "All" || county !== "All" || pubType !== "All") && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {category !== "All" && <FilterChip label={category} onRemove={() => setCategory("All")} />}
            {county !== "All" && <FilterChip label={county} onRemove={() => setCounty("All")} />}
            {pubType !== "All" && <FilterChip label={formatPublicationType(pubType as never)} onRemove={() => setPubType("All")} />}
          </div>
        )}

        {/* Results */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Gavel className="mx-auto size-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold text-lg">No tenders found</h3>
              <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                {tenders.tenders.length === 0 ? "Be the first to post a tender." : "Try adjusting your filters."}
              </p>
              {canPostTender && (
                <Button className="mt-6 gap-2" asChild><Link to="/tenders/new"><Plus className="size-4" /> Post a Tender</Link></Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TenderCard key={t.id} tender={t} isSaved={savedTenders.includes(t.id)} onToggleSave={() => toggleSave(t.id)} />
            ))}
          </div>
        )}

        {/* Contract Awards section */}
        {awardedTenders.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="size-5 text-amber-600" />
              <h2 className="text-xl font-bold">Contract Awards</h2>
              <Badge variant="secondary">{awardedTenders.length}</Badge>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {awardedTenders.slice(0, 10).map((t) => {
                    const contract = contracts.getContractByTender(t.id);
                    const winningBid = contract?.supplierName;
                    return (
                      <Link key={t.id} to={`/tenders/${t.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-accent">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{t.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              <Building2 className="inline size-3 mr-1" />
                              {t.procuringEntity ?? t.buyerName} · {t.county ?? "Unknown"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-blue-600 text-sm">{t.budgetAda.toLocaleString()} ₳</div>
                            <StatusBadge status={t.status} />
                          </div>
                        </div>
                        {winningBid && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="size-3" /> Awarded to: <span className="font-medium text-foreground">{winningBid}</span>
                            {contract?.status === "completed" && <Badge variant="outline" className="ml-2 text-emerald-700 dark:text-emerald-400">Completed</Badge>}
                            {contract?.status === "disputed" && <Badge variant="outline" className="ml-2 text-orange-700 dark:text-orange-400">Disputed</Badge>}
                            {contract?.paymentMethod === "mpesa" && <Badge variant="outline" className="ml-2 text-green-700 dark:text-green-400">M-Pesa</Badge>}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}

function TenderCard({ tender, isSaved, onToggleSave }: { tender: Tender; isSaved: boolean; onToggleSave: () => void }) {
  const deadline = new Date(tender.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="relative">
      <Link to={`/tenders/${tender.id}`}>
        <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="shrink-0 text-xs">{tender.category}</Badge>
                {tender.publicationType && tender.publicationType !== "open_tender" && (
                  <Badge variant="outline" className="text-xs">{formatPublicationType(tender.publicationType)}</Badge>
                )}
              </div>
              <StatusBadge status={tender.status} />
            </div>
            <h3 className="mt-3 font-semibold text-base line-clamp-2">{tender.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{tender.description}</p>

            {/* Procuring entity */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3 shrink-0" />
              <span className="truncate">{tender.procuringEntity ?? tender.buyerName}</span>
            </div>

            {tender.referenceNumber && (
              <div className="mt-1 text-xs text-muted-foreground font-mono">Ref: {tender.referenceNumber}</div>
            )}

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-semibold text-blue-600">{tender.budgetAda.toLocaleString()} ₳</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>{deadline.toLocaleDateString()}</span>
                {tender.status === "open" && daysLeft >= 0 && (
                  <Badge variant={daysLeft <= 3 ? "destructive" : "outline"} className="ml-auto text-xs">
                    {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-3.5" />
                <span className="truncate">{tender.county ?? "Unknown"} · {tender.location}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate">{tender.buyerName}</span>
              {tender.agpoCategory && tender.agpoCategory !== "none" && (
                <Badge variant="outline" className="text-xs text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800">
                  {formatAgpo(tender.agpoCategory)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
      {/* Save button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
        className="absolute top-3 right-3 z-10 rounded-md p-1.5 bg-background/80 backdrop-blur transition-colors hover:bg-accent"
        title={isSaved ? "Remove from saved" : "Save tender"}
      >
        {isSaved ? <BookmarkCheck className="size-4 text-amber-600" /> : <Bookmark className="size-4 text-muted-foreground" />}
      </button>
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} className="flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3 py-1 text-xs font-medium border border-blue-200 dark:border-blue-800">
      {label}
      <X className="size-3" />
    </button>
  );
}
