import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  FileText,
  Gavel,
  Layers,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateDID } from "@/lib/cardano";

export default function Dashboard() {
  const { wallet, registrations, tenders, bids, contracts } = useTenderHub();
  const session = wallet.session;

  useSeoMeta({
    title: "Dashboard — TenderHub",
    description: "Your TenderHub dashboard",
  });

  if (!session) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <Wallet className="mx-auto size-12 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold">Connect your wallet</h2>
          <p className="mt-2 text-muted-foreground">You need to connect a Cardano wallet to view your dashboard.</p>
          <Button className="mt-6" asChild><Link to="/">Go Home</Link></Button>
        </div>
      </Layout>
    );
  }

  const registration = registrations.getRegistration(session.address);

  if (!registration) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Registration required</h2>
          <p className="mt-2 text-muted-foreground">
            You haven't registered yet. Complete registration to access your dashboard.
          </p>
          <Button className="mt-6 gap-2" asChild>
            <Link to="/register">
              Register Now <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const isBuyer = registration.role === "buyer";
  const myTenders = tenders.tenders.filter((t) => t.buyerAddress === session.address);
  const myBids = bids.getBidsBySupplier(session.address);
  const openTenders = tenders.tenders.filter((t) => t.status === "open");
  const myContracts = contracts.contracts.filter(
    (c) => c.buyerAddress === session.address || c.supplierAddress === session.address,
  );
  const activeContracts = myContracts.filter((c) => c.status === "active" || c.status === "funded" || c.status === "milestone_pending" || c.status === "disputed");

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome, {registration.name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{registration.role}</Badge>
              <span>·</span>
              <span className="font-mono text-xs">{generateDID(session.address)}</span>
              <span>·</span>
              <span>{session.walletName}</span>
            </div>
          </div>
          {isBuyer ? (
            <Button className="gap-2" asChild>
              <Link to="/tenders/new">
                <Plus className="size-4" />
                Post a Tender
              </Link>
            </Button>
          ) : (
            <Button className="gap-2" asChild>
              <Link to="/tenders">
                <Gavel className="size-4" />
                Browse Tenders
              </Link>
            </Button>
          )}
        </div>

        {/* Verification status banner */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <VerificationCard
            icon={<ShieldCheck className="size-5" />}
            title="KYC Verification"
            status={registration.kyc.status}
            description={
              registration.kyc.status === "verified"
                ? "Your identity is verified."
                : registration.kyc.status === "pending"
                ? "Documents under review."
                : registration.kyc.status === "rejected"
                ? registration.kyc.reviewerNote || "Please resubmit documents."
                : "Submit documents to get verified."
            }
            docsCount={registration.kyc.documents.length}
          />
          <VerificationCard
            icon={<BadgeCheck className="size-5" />}
            title="ISO Certification"
            status={registration.iso.status}
            description={
              registration.iso.status === "verified"
                ? `${registration.iso.certifications.length} certification(s) verified.`
                : registration.iso.status === "pending"
                ? "Certifications under review."
                : registration.iso.status === "rejected"
                ? registration.iso.reviewerNote || "Please resubmit certifications."
                : "Add ISO certifications for more credibility."
            }
            docsCount={registration.iso.certifications.length}
          />
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={isBuyer ? "Tenders Posted" : "Open Tenders"}
            value={isBuyer ? myTenders.length : openTenders.length}
            icon={<FileText className="size-5" />}
          />
          <StatCard
            label={isBuyer ? "Total Budget" : "Bids Submitted"}
            value={isBuyer ? `${myTenders.reduce((s, t) => s + t.budgetAda, 0)} ₳` : myBids.length}
            icon={<Gavel className="size-5" />}
          />
          <StatCard
            label="Active Contracts"
            value={activeContracts.length}
            icon={<Layers className="size-5" />}
          />
          <StatCard
            label="Portfolio Items"
            value={registration.portfolio.length}
            icon={<BadgeCheck className="size-5" />}
          />
        </div>

        {/* Lists */}
        <div className="grid gap-6 lg:grid-cols-2">
          {isBuyer ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">My Tenders</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/tenders">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {myTenders.length === 0 ? (
                  <EmptyMini text="No tenders posted yet." cta={<Link to="/tenders/new" className="text-blue-600 hover:underline text-sm">Post your first tender</Link>} />
                ) : (
                  myTenders.slice(0, 5).map((t) => (
                    <Link key={t.id} to={`/tenders/${t.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t.budgetAda} ₳ · {bids.getBidsForTender(t.id).length} bids
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">My Bids</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myBids.length === 0 ? (
                  <EmptyMini text="No bids submitted yet." cta={<Link to="/tenders" className="text-blue-600 hover:underline text-sm">Browse open tenders</Link>} />
                ) : (
                  myBids.slice(0, 5).map((b) => (
                    <Link key={b.id} to={`/tenders/${b.tenderId}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{tenders.getTender(b.tenderId)?.title ?? "Tender"}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Bid: {b.priceAda} ₳ · {b.deliveryDays} days delivery
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Active Contracts */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">Active Contracts</CardTitle>
              <Badge variant="secondary">{activeContracts.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeContracts.length === 0 ? (
                <EmptyMini text="No active contracts." />
              ) : (
                activeContracts.slice(0, 5).map((c) => {
                  const completed = c.milestones.filter((m) => m.status === "approved").length;
                  return (
                    <Link key={c.id} to={`/contracts/${c.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {isBuyer ? c.supplierName : c.buyerName}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {completed}/{c.milestones.length} milestones · {c.releasedAmountAda.toLocaleString()} / {c.totalAmountAda.toLocaleString()} ₳
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.milestones.length > 0 ? (completed / c.milestones.length) * 100 : 0}%` }} />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Profile summary */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">Profile</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/portfolio">Edit</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industry</span>
                <span className="font-medium">{registration.industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{registration.city}, {registration.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[200px]">{registration.email}</span>
              </div>
              {registration.website && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  <a href={registration.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate max-w-[200px]">
                    {registration.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {registration.description && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-xs">About</span>
                  <p className="mt-1">{registration.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function VerificationCard({
  icon,
  title,
  status,
  description,
  docsCount,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  description: string;
  docsCount: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{docsCount} document(s)</div>
            </div>
          </div>
          <StatusBadge status={status as never} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyMini({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
