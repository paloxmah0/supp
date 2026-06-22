import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Clock,
  FileText,
  Gavel,
  Layers,
  Loader2,
  Lock,
  MapPin,
  Shield,
  Smartphone,
  User,
  Wallet,
  Upload,
  ShieldCheck,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { signMessage } from "@/lib/cardano";
import { formatPublicationType, formatAgpo } from "@/lib/kenyaData";
import type { Milestone } from "@/lib/types";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  lump_sum: "Lump Sum",
  milestone: "Milestone-Based",
  time_based: "Time-Based",
  performance_based: "Performance-Based",
};

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { wallet, tenders, bids, registrations, contracts } = useTenderHub();
  const session = wallet.session;

  const tender = id ? tenders.getTender(id) : undefined;

  const [bidForm, setBidForm] = useState({ priceAda: "", deliveryDays: "", proposal: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSeoMeta({
    title: tender ? `${tender.title} — TenderHub` : "Tender — TenderHub",
    description: tender?.description,
  });

  if (!tender) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Tender not found</h2>
          <Button className="mt-6" asChild><Link to="/tenders">Back to Tenders</Link></Button>
        </div>
      </Layout>
    );
  }

  const tenderBids = bids.getBidsForTender(tender.id);
  const isOwner = session?.address === tender.buyerAddress;
  const myBid = session ? tenderBids.find((b) => b.supplierAddress === session.address) : undefined;
  const canBid = session && !isOwner && !myBid && tender.status === "open" && registrations.getRegistration(session.address)?.role === "supplier";

  // Check if a contract already exists
  const existingContract = contracts.getContractByTender(tender.id);

  const deadline = new Date(tender.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleBid = async () => {
    if (!session) return;
    const price = parseInt(bidForm.priceAda, 10);
    const days = parseInt(bidForm.deliveryDays, 10);
    if (isNaN(price) || price <= 0) { toast({ variant: "destructive", title: "Invalid price" }); return; }
    if (isNaN(days) || days <= 0) { toast({ variant: "destructive", title: "Invalid delivery time" }); return; }

    setIsSubmitting(true);
    try {
      const reg = registrations.getRegistration(session.address);
      const message = `TenderHub Bid:${tender.id}:${session.address}:${price}:${Date.now()}`;
      await signMessage(session.api, session.address, message);

      bids.createBid({
        tenderId: tender.id,
        supplierAddress: session.address,
        supplierName: reg?.name ?? "Unknown Supplier",
        priceAda: price,
        deliveryDays: days,
        proposal: bidForm.proposal,
        attachments: [],
      });

      toast({ title: "Bid submitted", description: "Your bid has been recorded." });
      setBidForm({ priceAda: "", deliveryDays: "", proposal: "" });
    } catch {
      // handled by toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAward = async (bidId: string) => {
    if (!session) return;
    const bid = tenderBids.find((b) => b.id === bidId);
    if (!bid) return;

    try {
      // Sign the award
      const message = `TenderHub Award:${tender.id}:${bid.supplierAddress}:${Date.now()}`;
      await signMessage(session.api, session.address, message);

      bids.updateBid(bidId, { status: "awarded" });
      tenderBids.filter((b) => b.id !== bidId && b.status !== "withdrawn").forEach((b) => {
        bids.updateBid(b.id, { status: "rejected" });
      });

      // Create the escrow contract
      const milestones: Milestone[] = tender.contractType === "milestone"
        ? tender.milestoneTemplate.map((m, i) => ({
            id: `${Date.now()}-${i}`,
            title: m.title,
            description: m.description,
            amountAda: m.amountAda,
            dueDate: m.dueDate,
            status: "pending",
            order: i,
            evidence: [],
          }))
        : [{
            id: `${Date.now()}-0`,
            title: "Full Delivery",
            description: "Complete project delivery",
            amountAda: tender.budgetAda,
            dueDate: tender.deliveryDate,
            status: "pending",
            order: 0,
            evidence: [],
          }];

      const contract = contracts.createContract({
        tenderId: tender.id,
        buyerAddress: session.address,
        buyerName: tender.buyerName,
        supplierAddress: bid.supplierAddress,
        supplierName: bid.supplierName,
        totalAmountAda: tender.budgetAda,
        contractType: tender.contractType,
        milestones,
        status: "funded",
        fundingTxHash: tender.escrowTxHash,
        completionDeadline: tender.deliveryDate,
        disputes: [],
        security: {
          multiSig: true,
          autoApproveHours: 72,
          replayProtection: true,
          requireSignatures: true,
        },
        paymentMethod: tender.paymentMethod,
      });

      tenders.updateTender(tender.id, { status: "awarded", contractId: contract.id });
      toast({ title: "Tender awarded", description: "Escrow contract created. Funds locked on-chain." });
    } catch {
      // handled by toast
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" asChild>
          <Link to="/tenders"><ArrowLeft className="size-4" /> Back to Tenders</Link>
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="secondary">{tender.category}</Badge>
                <StatusBadge status={tender.status} />
                {tender.escrowTxHash && (
                  <Badge variant="outline" className="gap-1"><Lock className="size-3" /> Escrow Funded</Badge>
                )}
                <Badge variant="outline" className="gap-1"><Layers className="size-3" /> {CONTRACT_TYPE_LABELS[tender.contractType ?? "lump_sum"] ?? tender.contractType}</Badge>
                {tender.paymentMethod === "mpesa" && (
                  <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800"><Smartphone className="size-3" /> M-Pesa</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tender.title}</h1>
            </div>
          </div>
        </div>

        {/* Link to contract if awarded */}
        {existingContract && (
          <Card className="mb-6 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-blue-600" />
                <div>
                  <div className="font-medium">Escrow Contract Active</div>
                  <div className="text-sm text-muted-foreground">
                    {existingContract.milestones.filter((m) => m.status === "approved").length}/{existingContract.milestones.length} milestones completed
                    · {existingContract.releasedAmountAda.toLocaleString()} / {existingContract.totalAmountAda.toLocaleString()} ₳ released
                  </div>
                </div>
              </div>
              <Button asChild className="gap-2">
                <Link to={`/contracts/${existingContract.id}`}>
                  View Contract <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed whitespace-pre-wrap">{tender.description}</p></CardContent>
            </Card>

            {/* Requirements */}
            {tender.requirements.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Requirements</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tender.requirements.map((req, i) => (
                      <li key={req.id ?? i} className="flex items-start gap-2 text-sm">
                        {req.isFile ? (
                          <FileText className="size-4 shrink-0 text-blue-600 mt-0.5" />
                        ) : (
                          <Check className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span>{req.description}</span>
                          {req.isFile && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 gap-1">
                                <Upload className="size-2.5" /> File Upload Required
                              </Badge>
                              {req.requiresWalletSignature && (
                                <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1">
                                  <ShieldCheck className="size-2.5" /> Wallet-Signed Certificate
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Milestone template preview */}
            {tender.contractType === "milestone" && tender.milestoneTemplate.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Layers className="size-5" /> Milestone Plan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {tender.milestoneTemplate.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-blue-600 text-sm">{m.amountAda.toLocaleString()} ₳</div>
                        <div className="text-xs text-muted-foreground">{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : ""}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Bids */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Bids ({tenderBids.length})</CardTitle>
                {isOwner && tender.status === "open" && tenderBids.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => tenders.updateTender(tender.id, { status: "evaluating" })}>Start Evaluating</Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {tenderBids.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Gavel className="mx-auto size-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No bids yet.</p>
                  </div>
                ) : (
                  tenderBids.sort((a, b) => a.priceAda - b.priceAda).map((bid) => (
                    <div key={bid.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{bid.supplierName}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{bid.supplierAddress.slice(0, 20)}…</div>
                        </div>
                        <StatusBadge status={bid.status} />
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="font-semibold text-blue-600">{bid.priceAda.toLocaleString()} ₳</span>
                        <span className="text-muted-foreground">{bid.deliveryDays} days delivery</span>
                      </div>
                      {bid.proposal && <p className="mt-2 text-sm text-muted-foreground">{bid.proposal}</p>}
                      {isOwner && (tender.status === "open" || tender.status === "evaluating") && bid.status === "submitted" && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => bids.updateBid(bid.id, { status: "shortlisted" })}>Shortlist</Button>
                          <Button size="sm" onClick={() => handleAward(bid.id)} className="gap-1"><Check className="size-3.5" /> Award & Create Contract</Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">Budget</div>
                <div className="text-3xl font-bold text-blue-600 mt-1">{tender.budgetAda.toLocaleString()} ₳</div>
                <div className="mt-2 flex items-center justify-center gap-1 text-sm"><Lock className="size-3.5 text-emerald-600" /><span className="text-muted-foreground">Escrow secured</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {tender.referenceNumber && (
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">Ref:</span><span className="font-mono font-medium ml-auto">{tender.referenceNumber}</span></div>
                )}
                <div className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Entity:</span><span className="font-medium ml-auto text-right truncate ml-2">{tender.procuringEntity ?? tender.buyerName}</span></div>
                <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Type:</span><span className="font-medium ml-auto">{formatPublicationType(tender.publicationType ?? "open_tender")}</span></div>
                {tender.agpoCategory && tender.agpoCategory !== "none" && (
                  <div className="flex items-center gap-2"><BadgeCheck className="size-4 text-purple-600" /><span className="text-muted-foreground">AGPO:</span><span className="font-medium ml-auto">{formatAgpo(tender.agpoCategory)}</span></div>
                )}
                <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Deadline:</span><span className="font-medium ml-auto">{deadline.toLocaleDateString()}</span></div>
                {tender.status === "open" && (
                  <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Time left:</span><Badge variant={daysLeft <= 3 ? "destructive" : "secondary"} className="ml-auto">{daysLeft <= 0 ? "Closed" : `${daysLeft} days`}</Badge></div>
                )}
                <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Delivery:</span><span className="font-medium ml-auto">{new Date(tender.deliveryDate).toLocaleDateString()}</span></div>
                <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span className="text-muted-foreground">County:</span><span className="font-medium ml-auto">{tender.county ?? "Unknown"}</span></div>
                <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span className="text-muted-foreground">Location:</span><span className="font-medium ml-auto">{tender.location}</span></div>
              </CardContent>
            </Card>

            {/* Contract type */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="size-4" /> Contract Type</CardTitle></CardHeader>
              <CardContent>
                <Badge variant="secondary">{CONTRACT_TYPE_LABELS[tender.contractType ?? "lump_sum"] ?? tender.contractType}</Badge>
                {(tender.contractType ?? "lump_sum") === "milestone" && (
                  <p className="mt-2 text-xs text-muted-foreground">{tender.milestoneTemplate.length} milestones defined</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Buyer</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="size-5" /></div>
                  <div><div className="font-medium">{tender.buyerName}</div><div className="text-xs text-muted-foreground font-mono">{tender.buyerAddress.slice(0, 20)}…</div></div>
                </div>
              </CardContent>
            </Card>

            {canBid && (
              <Card className="border-blue-200 dark:border-blue-900">
                <CardHeader><CardTitle className="text-base">Submit a Bid</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="text-xs">Your Price (ADA)</Label>
                    <div className="relative">
                      <Input id="price" type="number" min="1" value={bidForm.priceAda} onChange={(e) => setBidForm({ ...bidForm, priceAda: e.target.value })} placeholder={String(tender.budgetAda)} className="pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₳</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="days" className="text-xs">Delivery Time (days)</Label>
                    <Input id="days" type="number" min="1" value={bidForm.deliveryDays} onChange={(e) => setBidForm({ ...bidForm, deliveryDays: e.target.value })} placeholder="30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="proposal" className="text-xs">Proposal</Label>
                    <Textarea id="proposal" rows={3} value={bidForm.proposal} onChange={(e) => setBidForm({ ...bidForm, proposal: e.target.value })} placeholder="Briefly describe your approach..." />
                  </div>
                  <Button onClick={handleBid} disabled={!bidForm.priceAda || !bidForm.deliveryDays || isSubmitting} className="w-full gap-2">
                    {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Signing…</> : <><Gavel className="size-4" /> Submit Bid</>}
                  </Button>
                </CardContent>
              </Card>
            )}

            {myBid && (
              <Card className="border-blue-200 dark:border-blue-900">
                <CardContent className="pt-6 text-center">
                  <Check className="mx-auto size-8 text-emerald-600" />
                  <p className="mt-2 font-medium">Bid submitted</p>
                  <p className="text-sm text-muted-foreground">{myBid.priceAda.toLocaleString()} ₳ · {myBid.deliveryDays} days</p>
                  <div className="mt-3"><StatusBadge status={myBid.status} /></div>
                </CardContent>
              </Card>
            )}

            {!session && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <Wallet className="mx-auto size-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Connect your wallet and register as a supplier to bid.</p>
                  <Button className="mt-4" asChild><Link to="/register">Register</Link></Button>
                </CardContent>
              </Card>
            )}

            {isOwner && (
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-3">Tender Management</p>
                  {tender.status === "open" && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => tenders.updateTender(tender.id, { status: "closed" })}>Close Tender</Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
