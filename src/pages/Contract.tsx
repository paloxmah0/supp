import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  History,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  ScrollText,
  Shield,
  ShieldCheck,
  ShieldX,
  Scale,
  Smartphone,
  X,
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
import { signMessageWithTimeout, signEvidence } from "@/lib/cardano";
import { cn } from "@/lib/utils";
import type { ContractType, DisputeScope, Milestone, MilestoneStatus } from "@/lib/types";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  lump_sum: "Lump Sum",
  milestone: "Milestone-Based",
  time_based: "Time-Based",
  performance_based: "Performance-Based",
};

const DISPUTE_SCOPES: { value: DisputeScope; label: string }[] = [
  { value: "milestone", label: "Milestone Issue" },
  { value: "quality", label: "Quality of Work" },
  { value: "timeline", label: "Timeline / Delay" },
  { value: "payment", label: "Payment Dispute" },
  { value: "tender", label: "General Contract Issue" },
];

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { wallet, contracts, registrations } = useTenderHub();
  const session = wallet.session;

  const contract = id ? contracts.getContract(id) : undefined;

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ title: "", description: "", scope: "milestone" as DisputeScope, milestoneId: "" });
  const [resolutionForm, setResolutionForm] = useState({ ruling: "", buyerPercent: 50 });
  const [cancelForm, setCancelForm] = useState({ reason: "" });
  const [isSigning, setIsSigning] = useState(false);

  useSeoMeta({
    title: contract ? `Contract — ${contract.tenderId.slice(0, 8)} — TenderHub` : "Contract — TenderHub",
  });

  if (!contract) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Contract not found</h2>
          <Button className="mt-6" asChild><Link to="/tenders">Back to Tenders</Link></Button>
        </div>
      </Layout>
    );
  }

  const isBuyer = session?.address === contract.buyerAddress;
  const isSupplier = session?.address === contract.supplierAddress;
  const isParticipant = isBuyer || isSupplier;
  const totalMilestones = contract.milestones.length;
  const completedMilestones = contract.milestones.filter((m) => m.status === "approved").length;
  const progressPercent = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
  const activeDispute = contract.disputes.find((d) => d.status === "open" || d.status === "under_review");
  const isFrozen = contract.status === "disputed" || !!activeDispute;

  // ─── Milestone Actions ──────────────────────────────────────────────

  const handleStartMilestone = async (milestone: Milestone) => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `StartMilestone:${contract.id}:${milestone.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      contracts.updateMilestone(contract.id, milestone.id, { status: "in_progress" });
      contracts.addAuditEntry(contract.id, { actor: session.address, actorName: registrations.getRegistration(session.address)?.name ?? "Unknown", action: "milestone_started", details: `Started: ${milestone.title}` });
      toast({ title: "Milestone started" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to start milestone", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleSubmitMilestone = async (milestone: Milestone) => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `SubmitMilestone:${contract.id}:${milestone.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      contracts.updateMilestone(contract.id, milestone.id, { status: "submitted", submittedAt: Date.now() });
      contracts.addAuditEntry(contract.id, { actor: session.address, actorName: registrations.getRegistration(session.address)?.name ?? "Unknown", action: "milestone_submitted", details: `Submitted evidence for: ${milestone.title}` });
      toast({ title: "Milestone submitted", description: "Awaiting buyer approval." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to submit milestone", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleApproveMilestone = async (milestone: Milestone) => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `ApproveMilestone:${contract.id}:${milestone.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const txHash = `release_${Date.now().toString(36)}`;
      contracts.updateMilestone(contract.id, milestone.id, { status: "approved", approvedAt: Date.now(), releaseTxHash: txHash });
      const newReleased = contract.releasedAmountAda + milestone.amountAda;
      const allDone = contract.milestones.every((m) => m.id === milestone.id ? true : m.status === "approved");
      contracts.updateContract(contract.id, {
        releasedAmountAda: newReleased,
        status: allDone ? "completed" : "active",
      });
      contracts.addAuditEntry(contract.id, { actor: session.address, actorName: registrations.getRegistration(session.address)?.name ?? "Unknown", action: "milestone_approved", details: `Approved: ${milestone.title} — Released ${milestone.amountAda.toLocaleString()} ₳`, txHash });
      toast({ title: "Milestone approved", description: `${milestone.amountAda.toLocaleString()} ₳ released to supplier.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to approve milestone", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleRejectMilestone = async (milestone: Milestone) => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `RejectMilestone:${contract.id}:${milestone.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      contracts.updateMilestone(contract.id, milestone.id, { status: "rejected" });
      contracts.addAuditEntry(contract.id, { actor: session.address, actorName: registrations.getRegistration(session.address)?.name ?? "Unknown", action: "milestone_rejected", details: `Rejected: ${milestone.title}` });
      toast({ variant: "destructive", title: "Milestone rejected", description: "Supplier must redo and resubmit." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to reject milestone", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  // ─── Dispute Actions ─────────────────────────────────────────────────

  const handleFileDispute = async () => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `FileDispute:${contract.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const reg = registrations.getRegistration(session.address);
      contracts.fileDispute(contract.id, {
        contractId: contract.id,
        tenderId: contract.tenderId,
        filedBy: session.address,
        filedByName: reg?.name ?? "Unknown",
        filedAgainst: isBuyer ? contract.supplierAddress : contract.buyerAddress,
        filedAgainstName: isBuyer ? contract.supplierName : contract.buyerName,
        scope: disputeForm.scope,
        milestoneId: disputeForm.milestoneId || undefined,
        title: disputeForm.title,
        description: disputeForm.description,
      });
      contracts.updateContract(contract.id, { status: "disputed" });
      toast({ title: "Dispute filed", description: "Contract is now frozen. An arbitrator will be assigned." });
      setShowDisputeForm(false);
      setDisputeForm({ title: "", description: "", scope: "milestone", milestoneId: "" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to file dispute", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleResolveDispute = async (disputeId: string) => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `ResolveDispute:${contract.id}:${disputeId}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const status = resolutionForm.buyerPercent === 100 ? "resolved_buyer" : resolutionForm.buyerPercent === 0 ? "resolved_supplier" : "resolved_split";
      contracts.resolveDispute(contract.id, disputeId, {
        status,
        ruling: resolutionForm.ruling,
        splitPercentage: resolutionForm.buyerPercent,
        arbitrator: session.address,
        arbitratorName: registrations.getRegistration(session.address)?.name ?? "Arbitrator",
      });
      toast({ title: "Dispute resolved", description: `Funds split: ${resolutionForm.buyerPercent}% buyer / ${100 - resolutionForm.buyerPercent}% supplier.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to resolve dispute", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  // ─── Cancellation Actions ────────────────────────────────────────────

  const handleRequestCancellation = async () => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `RequestCancellation:${contract.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const reg = registrations.getRegistration(session.address);
      contracts.requestCancellation(contract.id, {
        initiatedBy: isBuyer ? "buyer" : "supplier",
        initiatorAddress: session.address,
        initiatorName: reg?.name ?? "Unknown",
        reason: cancelForm.reason,
      });
      toast({ title: "Cancellation requested", description: "Waiting for the other party to accept or reject." });
      setShowCancelForm(false);
      setCancelForm({ reason: "" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to request cancellation", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleAcceptCancellation = async () => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `AcceptCancellation:${contract.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const reg = registrations.getRegistration(session.address);
      contracts.acceptCancellation(contract.id, session.address, reg?.name ?? "Unknown");
      toast({ title: "Cancellation accepted", description: "Contract cancelled. Funds settled per the agreement." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to accept cancellation", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  const handleRejectCancellation = async () => {
    if (!session) return;
    setIsSigning(true);
    try {
      const msg = `RejectCancellation:${contract.id}:${session.address}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, msg, 30000);
      const reg = registrations.getRegistration(session.address);
      contracts.rejectCancellation(contract.id, session.address, reg?.name ?? "Unknown");
      toast({ title: "Cancellation rejected", description: "Contract continues. If the rejection was in bad faith, the other party can file a dispute and the arbitrator may penalize you." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to reject cancellation", description: err instanceof Error ? err.message : "Wallet signing failed." });
    } finally { setIsSigning(false); }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" asChild>
          <Link to="/tenders"><ArrowLeft className="size-4" /> Back to Tenders</Link>
        </Button>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary">{CONTRACT_TYPE_LABELS[contract.contractType]}</Badge>
              <StatusBadge status={contract.status} />
              {isFrozen && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> FROZEN — Dispute Active</Badge>}
              {contract.fundingTxHash && <Badge variant="outline" className="gap-1"><Lock className="size-3" /> On-Chain</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Escrow Contract</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">{contract.id}</p>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Layers className="size-5" /> Contract Progress</h3>
              <span className="text-sm font-medium">{completedMilestones}/{totalMilestones} milestones</span>
            </div>
            {/* Progress bar */}
            <div className="relative h-4 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                {Math.round(progressPercent)}%
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{contract.releasedAmountAda.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">₳ Released</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{(contract.totalAmountAda - contract.releasedAmountAda).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">₳ In Escrow</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{contract.totalAmountAda.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">₳ Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main: Milestones + Disputes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Milestones */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Layers className="size-5" /> Milestones</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {contract.milestones.map((m, idx) => (
                  <MilestoneCard
                    key={m.id}
                    milestone={m}
                    index={idx}
                    isBuyer={isBuyer}
                    isSupplier={isSupplier}
                    isFrozen={isFrozen}
                    isSigning={isSigning}
                    showEvidenceForm={showEvidenceForm === m.id}
                    onToggleEvidence={() => setShowEvidenceForm(showEvidenceForm === m.id ? null : m.id)}
                    onStart={() => handleStartMilestone(m)}
                    onSubmit={() => handleSubmitMilestone(m)}
                    onApprove={() => handleApproveMilestone(m)}
                    onReject={() => handleRejectMilestone(m)}
                    onAddEvidence={async (desc) => {
                      if (!session) return;
                      try {
                        // Sign the evidence to make it tamper-proof
                        const { contentHash, signature } = await signEvidence(
                          session.api,
                          session.address,
                          { description: desc, submittedBy: session.address, attachments: [] },
                        );
                        contracts.addMilestoneEvidence(contract.id, m.id, {
                          description: desc,
                          attachments: [],
                          submittedBy: session.address,
                          contentHash,
                          signature,
                          locked: true,
                        });
                        toast({ title: "Evidence submitted", description: "Tamper-proof: hashed & wallet-signed. Cannot be modified." });
                      } catch (err) {
                        toast({ variant: "destructive", title: "Failed to submit evidence", description: err instanceof Error ? err.message : "Wallet signing failed." });
                      }
                    }}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Disputes */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Scale className="size-5" /> Dispute Resolution</CardTitle>
                {isParticipant && !isFrozen && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDisputeForm(!showDisputeForm)}>
                    <AlertTriangle className="size-4" /> File Dispute
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {showDisputeForm && (
                  <DisputeForm
                    milestones={contract.milestones}
                    form={disputeForm}
                    onChange={setDisputeForm}
                    onSubmit={handleFileDispute}
                    onCancel={() => setShowDisputeForm(false)}
                    isSigning={isSigning}
                  />
                )}

                {contract.disputes.length === 0 && !showDisputeForm ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <ShieldCheck className="mx-auto size-8 text-emerald-600" />
                    <p className="mt-2 text-sm text-muted-foreground">No disputes filed. Contract is running smoothly.</p>
                  </div>
                ) : (
                  contract.disputes.map((d) => (
                    <div key={d.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{d.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Filed by {d.filedByName} against {d.filedAgainstName} · {new Date(d.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{d.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{d.scope}</Badge>
                        {d.milestoneId && (
                          <Badge variant="outline">
                            Milestone: {contract.milestones.find((m) => m.id === d.milestoneId)?.title ?? "Unknown"}
                          </Badge>
                        )}
                      </div>

                      {/* Evidence */}
                      {d.evidence.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Evidence ({d.evidence.length})</div>
                          {d.evidence.map((e) => (
                            <div key={e.id} className="text-sm flex items-start gap-2">
                              <FileText className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-muted-foreground">{e.submittedByName}:</span> {e.description}
                                <span className="text-xs text-muted-foreground ml-1">· {new Date(e.submittedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resolution UI */}
                      {(d.status === "open" || d.status === "under_review") && (
                        <div className="pt-3 border-t space-y-3">
                          <div className="text-xs font-medium text-muted-foreground">Arbitrator Resolution</div>
                          <div className="space-y-2">
                            <Label className="text-xs">Ruling</Label>
                            <Textarea rows={2} value={resolutionForm.ruling} onChange={(e) => setResolutionForm({ ...resolutionForm, ruling: e.target.value })} placeholder="Describe the ruling..." />
                            <div>
                              <Label className="text-xs">Buyer Share: {resolutionForm.buyerPercent}%</Label>
                              <input
                                type="range" min="0" max="100" step="5"
                                value={resolutionForm.buyerPercent}
                                onChange={(e) => setResolutionForm({ ...resolutionForm, buyerPercent: parseInt(e.target.value) })}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Supplier: {100 - resolutionForm.buyerPercent}%</span>
                                <span>Buyer: {resolutionForm.buyerPercent}%</span>
                              </div>
                            </div>
                            <Button size="sm" className="gap-2" disabled={!resolutionForm.ruling || isSigning} onClick={() => handleResolveDispute(d.id)}>
                              {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <Gavel className="size-3.5" />}
                              Resolve Dispute
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Resolved display */}
                      {d.resolvedAt && (
                        <div className="pt-3 border-t rounded-b-lg bg-muted/30 -mx-4 -mb-4 px-4 pb-3 mt-3">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            <span className="font-medium">Resolved by {d.arbitratorName}</span>
                          </div>
                          {d.ruling && <p className="text-sm text-muted-foreground mt-1">{d.ruling}</p>}
                          {d.splitPercentage !== undefined && (
                            <p className="text-sm mt-1">Split: {d.splitPercentage}% buyer / {100 - d.splitPercentage}% supplier</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Cancellation */}
            <Card className={contract.cancellation?.status === "enforced" ? "border-destructive" : ""}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Ban className="size-5" /> Cancellation</CardTitle>
                {isParticipant && !isFrozen && !contract.cancellation && contract.status !== "completed" && contract.status !== "cancelled" && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCancelForm(!showCancelForm)}>
                    <Ban className="size-4" /> Request Cancellation
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cancellation form */}
                {showCancelForm && (
                  <div className="rounded-lg border-2 border-orange-200 dark:border-orange-900 p-4 space-y-3">
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <AlertTriangle className="size-4" /> Request Contract Cancellation
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cancelling will propose a settlement based on work completed:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                      <li><strong>Completed milestones:</strong> Supplier keeps all released payments</li>
                      <li><strong>In-progress work:</strong> Remaining funds split 50/50 by default</li>
                      <li><strong>No work started:</strong> Full refund to buyer</li>
                      <li><strong>Bad-faith rejection:</strong> If one party unjustifiably rejects a cancellation, the arbitrator can penalize them up to 25% of their settlement share</li>
                    </ul>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reason for cancellation *</Label>
                      <Textarea rows={2} value={cancelForm.reason} onChange={(e) => setCancelForm({ reason: e.target.value })} placeholder="e.g. Project scope has changed and we need to terminate the contract." />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleRequestCancellation} disabled={!cancelForm.reason || isSigning} className="gap-1.5">
                        {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                        Request Cancellation
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCancelForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Active cancellation request */}
                {contract.cancellation && contract.cancellation.status === "requested" && (
                  <div className="rounded-lg border-2 border-orange-300 dark:border-orange-800 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="size-4" />
                      Cancellation Requested by {contract.cancellation.initiatorName}
                    </div>
                    <p className="text-sm text-muted-foreground">{contract.cancellation.reason}</p>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                      <div className="font-medium text-xs">Proposed Settlement:</div>
                      {contract.cancellation.settlement === "full_refund_buyer" && <p className="text-muted-foreground">Full refund to buyer (no completed milestones)</p>}
                      {contract.cancellation.settlement === "supplier_paid_completed" && <p className="text-muted-foreground">Supplier keeps {contract.releasedAmountAda.toLocaleString()} ₳ (completed milestones). Buyer refunded {(contract.totalAmountAda - contract.releasedAmountAda).toLocaleString()} ₳.</p>}
                      {contract.cancellation.settlement === "partial_split" && (
                        <p className="text-muted-foreground">
                          Supplier keeps {contract.releasedAmountAda.toLocaleString()} ₳ + {contract.cancellation.supplierKeepPercent}% of remaining ({Math.floor((contract.totalAmountAda - contract.releasedAmountAda) * (contract.cancellation.supplierKeepPercent ?? 0) / 100).toLocaleString()} ₳).
                          Buyer gets {Math.floor((contract.totalAmountAda - contract.releasedAmountAda) * (100 - (contract.cancellation.supplierKeepPercent ?? 0)) / 100).toLocaleString()} ₳.
                        </p>
                      )}
                    </div>
                    {/* The other party can accept or reject */}
                    {isParticipant && session?.address !== contract.cancellation.initiatorAddress && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAcceptCancellation} disabled={isSigning} className="gap-1.5">
                          {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          Accept & Cancel Contract
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleRejectCancellation} disabled={isSigning} className="gap-1.5">
                          <X className="size-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                    {isParticipant && session?.address === contract.cancellation.initiatorAddress && (
                      <p className="text-xs text-muted-foreground">Waiting for the other party to respond…</p>
                    )}
                  </div>
                )}

                {/* Enforced cancellation */}
                {contract.cancellation?.status === "enforced" && (
                  <div className="rounded-lg border-2 border-destructive p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <Ban className="size-4" /> Contract Cancelled
                    </div>
                    <p className="text-sm text-muted-foreground">Initiated by {contract.cancellation.initiatorName}</p>
                    <p className="text-sm text-muted-foreground">{contract.cancellation.reason}</p>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                      <div className="font-medium text-xs">Final Settlement:</div>
                      {contract.cancellation.settlement === "full_refund_buyer" && <p>Buyer refunded {contract.totalAmountAda.toLocaleString()} ₳ (full refund).</p>}
                      {contract.cancellation.settlement === "supplier_paid_completed" && <p>Supplier kept {contract.releasedAmountAda.toLocaleString()} ₳. Buyer refunded {(contract.totalAmountAda - contract.releasedAmountAda).toLocaleString()} ₳.</p>}
                      {contract.cancellation.settlement === "partial_split" && (
                        <p>
                          Supplier: {contract.releasedAmountAda.toLocaleString()} ₳ + {contract.cancellation.supplierKeepPercent}% of remaining.
                          Buyer: {100 - (contract.cancellation.supplierKeepPercent ?? 0)}% of remaining.
                        </p>
                      )}
                      {contract.cancellation.txHash && <p className="text-xs font-mono">TX: {contract.cancellation.txHash}</p>}
                      {contract.cancellation.penalty && (
                        <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-800 dark:text-red-300 space-y-1">
                          <p className="font-medium">⚠️ Bad-Faith Penalty Applied</p>
                          <p>Penalized party: <span className="font-medium capitalize">{contract.cancellation.penalty.penalizedParty}</span></p>
                          <p>Reason: {contract.cancellation.penalty.reason}</p>
                          <p>Penalty: {contract.cancellation.penalty.penaltyAmountAda.toLocaleString()} ₳ ({contract.cancellation.penalty.penaltyPercent}% of total contract)</p>
                          <p>Applied by: {contract.cancellation.penalty.appliedBy}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejected cancellation */}
                {contract.cancellation?.status === "rejected" && (
                  <div className="rounded-lg border-2 border-orange-200 dark:border-orange-900 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
                      <Ban className="inline size-4" /> Cancellation was rejected. Contract continues.
                    </div>
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 p-3 text-xs text-orange-800 dark:text-orange-300 space-y-1">
                      <p className="font-medium">⚠️ Bad-faith rejection penalty</p>
                      <p>If the rejection was unjustified (the other party's work was legitimate), they can file a dispute. The arbitrator can then penalize the rejector by deducting up to 25% of their settlement share and awarding it to the wronged party.</p>
                      <p className="text-orange-600 dark:text-orange-400 mt-1">Filed by: {contract.cancellation.initiatorName} · Rejected by: {session?.address === contract.cancellation.initiatorAddress ? "The other party" : "You"}</p>
                    </div>
                  </div>
                )}

                {/* No cancellation */}
                {!contract.cancellation && !showCancelForm && (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <ShieldCheck className="mx-auto size-8 text-emerald-600" />
                    <p className="mt-2 text-sm text-muted-foreground">No cancellation requested. Contract is active.</p>
                    <p className="text-xs text-muted-foreground mt-1">If either party needs to cancel mid-process, the settlement is based on completed work.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Log */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ScrollText className="size-5" /> Audit Trail</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {contract.auditLog.slice().reverse().map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm border-b pb-2">
                      <History className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.action.replace(/_/g, " ")}</span>
                          {entry.txHash && <Badge variant="outline" className="text-xs font-mono">{entry.txHash.slice(0, 16)}…</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{entry.details}</div>
                        <div className="text-xs text-muted-foreground">{entry.actorName} · {new Date(entry.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Security + Parties */}
          <div className="space-y-6">
            {/* Security Panel */}
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4 text-blue-600" /> Security Features</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <SecurityItem icon={<ShieldCheck className="size-4 text-emerald-600" />} label="Multi-Signature" enabled={contract.security.multiSig} description="Arbitrator co-signs releases" />
                <SecurityItem icon={<ShieldCheck className="size-4 text-emerald-600" />} label="Replay Protection" enabled={contract.security.replayProtection} description="Nonce-based anti-replay" />
                <SecurityItem icon={<ShieldCheck className="size-4 text-emerald-600" />} label="Signature Required" enabled={contract.security.requireSignatures} description="All actions signed" />
                <SecurityItem icon={<Clock className="size-4 text-blue-600" />} label="Auto-Approve Timelock" enabled={true} description={`${contract.security.autoApproveHours}h per milestone`} />
                <SecurityItem icon={<Lock className="size-4 text-emerald-600" />} label="On-Chain Escrow" enabled={!!contract.fundingTxHash} description="Funds locked in Aiken validator" />
                <SecurityItem icon={<Scale className="size-4 text-purple-600" />} label="Dispute Freeze" enabled={true} description="Funds frozen during disputes" />
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader><CardTitle className="text-base">Parties</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <PartyRow label="Buyer" name={contract.buyerName} address={contract.buyerAddress} />
                <PartyRow label="Supplier" name={contract.supplierName} address={contract.supplierAddress} />
              </CardContent>
            </Card>

            {/* Contract details */}
            <Card>
              <CardHeader><CardTitle className="text-base">Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{CONTRACT_TYPE_LABELS[contract.contractType]}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Payment</span>
                  {contract.paymentMethod === "mpesa" ? (
                    <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800"><Smartphone className="size-3" /> M-Pesa</Badge>
                  ) : (
                    <span className="font-medium">ADA</span>
                  )}
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{contract.totalAmountAda.toLocaleString()} ₳</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Released</span><span className="font-medium text-emerald-600">{contract.releasedAmountAda.toLocaleString()} ₳</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">In Escrow</span><span className="font-medium">{(contract.totalAmountAda - contract.releasedAmountAda).toLocaleString()} ₳</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className="font-medium">{new Date(contract.completionDeadline).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{new Date(contract.createdAt).toLocaleDateString()}</span></div>
                {contract.fundingTxHash && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Funding TX</span><span className="font-mono text-xs">{contract.fundingTxHash.slice(0, 16)}…</span></div>
                )}
              </CardContent>
            </Card>

            {/* Tender link */}
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link to={`/tenders/${contract.tenderId}`}>
                <FileText className="size-4" /> View Original Tender
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function MilestoneCard({
  milestone, index, isBuyer, isSupplier, isFrozen, isSigning,
  showEvidenceForm, onToggleEvidence, onStart, onSubmit, onApprove, onReject, onAddEvidence,
}: {
  milestone: Milestone; index: number; isBuyer: boolean; isSupplier: boolean; isFrozen: boolean; isSigning: boolean;
  showEvidenceForm: boolean; onToggleEvidence: () => void; onStart: () => void; onSubmit: () => void; onApprove: () => void; onReject: () => void;
  onAddEvidence: (desc: string) => Promise<void>;
}) {
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [isSigningEvidence, setIsSigningEvidence] = useState(false);
  const statusColors: Record<MilestoneStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    disputed: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  };

  return (
    <div className={cn("rounded-lg border-2 p-4 transition-all", milestone.status === "approved" ? "border-emerald-200 dark:border-emerald-900" : "border-border")}>
      <div className="flex items-start gap-3">
        {/* Step number / status icon */}
        <div className={cn("flex size-8 items-center justify-center rounded-full text-xs font-bold shrink-0", statusColors[milestone.status])}>
          {milestone.status === "approved" ? <Check className="size-4" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{milestone.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{milestone.description}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold text-blue-600">{milestone.amountAda.toLocaleString()} ₳</div>
              <div className="text-xs text-muted-foreground">{milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : ""}</div>
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-2">
            <Badge variant="outline" className={cn("border-transparent capitalize", statusColors[milestone.status])}>
              {milestone.status.replace(/_/g, " ")}
            </Badge>
            {milestone.releaseTxHash && (
              <Badge variant="outline" className="ml-2 text-xs font-mono">{milestone.releaseTxHash.slice(0, 14)}…</Badge>
            )}
          </div>

          {/* Evidence list */}
          {milestone.evidence.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Evidence ({milestone.evidence.length})</div>
              {milestone.evidence.map((e) => (
                <div key={e.id} className="text-sm flex items-start gap-2">
                  <FileText className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span>{e.description}</span>
                    {e.locked && (
                      <Badge variant="outline" className="ml-2 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1">
                        <Lock className="size-2.5" /> Tamper-Proof
                      </Badge>
                    )}
                    {e.contentHash && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">Hash: {e.contentHash.slice(0, 16)}…</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Evidence form */}
          {showEvidenceForm && (
            <div className="mt-3 rounded-lg border-2 border-dashed p-3 space-y-2">
              <Input value={evidenceDesc} onChange={(e) => setEvidenceDesc(e.target.value)} placeholder="Describe the evidence (e.g. 'Photos of completed foundation')" />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!evidenceDesc || isSigningEvidence}
                  onClick={async () => {
                    setIsSigningEvidence(true);
                    try {
                      await onAddEvidence(evidenceDesc);
                      setEvidenceDesc("");
                    } finally {
                      setIsSigningEvidence(false);
                    }
                  }}
                  className="gap-1.5"
                >
                  {isSigningEvidence ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                  {isSigningEvidence ? "Signing…" : "Submit & Sign Evidence"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onToggleEvidence}>Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Evidence is hashed and wallet-signed on submit. Once submitted, it cannot be modified.
              </p>
            </div>
          )}

          {/* Actions */}
          {!isFrozen && (
            <div className="mt-3 flex flex-wrap gap-2">
              {isSupplier && milestone.status === "pending" && (
                <Button size="sm" variant="outline" onClick={onStart} disabled={isSigning} className="gap-1.5">
                  <ArrowRight className="size-3.5" /> Start Work
                </Button>
              )}
              {isSupplier && milestone.status === "in_progress" && (
                <>
                  <Button size="sm" onClick={onSubmit} disabled={isSigning} className="gap-1.5">
                    {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Submit for Approval
                  </Button>
                  <Button size="sm" variant="outline" onClick={onToggleEvidence} className="gap-1.5">
                    <Plus className="size-3.5" /> Add Evidence
                  </Button>
                </>
              )}
              {isSupplier && milestone.status === "rejected" && (
                <>
                  <Button size="sm" onClick={onSubmit} disabled={isSigning} className="gap-1.5">
                    <RotateCcw className="size-3.5" /> Resubmit
                  </Button>
                  <Button size="sm" variant="outline" onClick={onToggleEvidence} className="gap-1.5">
                    <Plus className="size-3.5" /> Add Evidence
                  </Button>
                </>
              )}
              {isBuyer && milestone.status === "submitted" && (
                <>
                  <Button size="sm" onClick={onApprove} disabled={isSigning} className="gap-1.5">
                    {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Approve & Release {milestone.amountAda.toLocaleString()} ₳
                  </Button>
                  <Button size="sm" variant="destructive" onClick={onReject} disabled={isSigning} className="gap-1.5">
                    <X className="size-3.5" /> Reject
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DisputeForm({
  milestones, form, onChange, onSubmit, onCancel, isSigning,
}: {
  milestones: Milestone[]; form: { title: string; description: string; scope: DisputeScope; milestoneId: string };
  onChange: (f: { title: string; description: string; scope: DisputeScope; milestoneId: string }) => void;
  onSubmit: () => void; onCancel: () => void; isSigning: boolean;
}) {
  return (
    <div className="rounded-lg border-2 border-orange-200 dark:border-orange-900 p-4 space-y-3 mb-4">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
        <AlertTriangle className="size-4" /> File a Dispute
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Scope</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.scope} onChange={(e) => onChange({ ...form, scope: e.target.value as DisputeScope })}>
            {DISPUTE_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {form.scope === "milestone" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Milestone</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.milestoneId} onChange={(e) => onChange({ ...form, milestoneId: e.target.value })}>
              <option value="">Select milestone...</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="e.g. Supplier missed milestone deadline" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description *</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} placeholder="Describe the issue in detail..." />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onSubmit} disabled={!form.title || !form.description || isSigning} className="gap-1.5">
          {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
          File Dispute
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-xs text-orange-700 dark:text-orange-400">
        ⚠️ Filing a dispute will freeze the contract. No funds can be released until an arbitrator resolves it.
      </p>
    </div>
  );
}

function SecurityItem({ icon, label, enabled, description }: { icon: React.ReactNode; label: string; enabled: boolean; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">{enabled ? icon : <ShieldX className="size-4 text-muted-foreground" />}</div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium", enabled ? "text-foreground" : "text-muted-foreground line-through")}>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {enabled ? <Check className="size-4 text-emerald-600 shrink-0" /> : <X className="size-4 text-muted-foreground shrink-0" />}
    </div>
  );
}

function PartyRow({ label, name, address }: { label: string; name: string; address: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <Shield className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium text-sm truncate">{name}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{address.slice(0, 20)}…</div>
      </div>
    </div>
  );
}
