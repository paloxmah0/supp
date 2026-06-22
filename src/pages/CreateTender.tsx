import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  ArrowLeft,
  Banknote,
  Check,
  Clock,
  FileText,
  Layers,
  Loader2,
  Lock,
  Phone,
  Plus,
  Shield,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Trash2,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { signMessage } from "@/lib/cardano";
import { cn } from "@/lib/utils";
import type { AgpoCategory, ContractType, PaymentMethod, TenderPublicationType, TenderRequirement } from "@/lib/types";
import {
  TENDER_CATEGORIES as CATEGORIES,
  ALL_LOCATIONS,
  PUBLICATION_TYPES,
  AGPO_CATEGORIES,
  PROCUREMENT_ENTITIES,
} from "@/lib/kenyaData";
import { adaToKes, formatKes, KES_TO_ADA_RATE, simulateStkPush, validateMpesaPhone, normalizeMpesaPhone } from "@/lib/mpesa";

const CONTRACT_TYPES: {
  value: ContractType;
  label: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "lump_sum",
    label: "Lump Sum",
    description: "Single payment on full delivery. Best for small, well-defined contracts.",
    example: "Supply of 100 office chairs",
    icon: <Zap className="size-5" />,
  },
  {
    value: "milestone",
    label: "Milestone-Based",
    description: "Payment released in stages as milestones are completed. Best for large, multi-phase projects.",
    example: "Construction of a 3-storey building (foundation → walls → roof → finishing)",
    icon: <Layers className="size-5" />,
  },
  {
    value: "time_based",
    label: "Time-Based",
    description: "Periodic payments based on time worked. Best for consulting and ongoing services.",
    example: "12-month IT support contract with monthly payments",
    icon: <Clock className="size-5" />,
  },
  {
    value: "performance_based",
    label: "Performance-Based",
    description: "Payment tied to measurable KPIs. Best for outcomes-driven contracts.",
    example: "Solar installation with payment per kW delivered",
    icon: <TrendingUp className="size-5" />,
  },
];

interface MilestoneDraft {
  title: string;
  description: string;
  amountAda: string;
  dueDate: string;
}

let reqIdCounter = 0;
function genReqId(): string {
  reqIdCounter++;
  return `req-${Date.now()}-${reqIdCounter}`;
}

export default function CreateTender() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, registrations, tenders } = useTenderHub();
  const session = wallet.session;

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES[0],
    procuringEntity: PROCUREMENT_ENTITIES[0] as string,
    publicationType: "open_tender" as TenderPublicationType,
    agpoCategory: "none" as AgpoCategory,
    referenceNumber: "",
    budgetAda: "",
    deadline: "",
    deliveryDate: "",
    location: "",
    county: ALL_LOCATIONS[0] as string,
  });
  const [contractType, setContractType] = useState<ContractType>("milestone");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ada");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaStkStatus, setMpesaStkStatus] = useState<"idle" | "pushing" | "confirmed" | "failed">("idle");
  const [mpesaCode, setMpesaCode] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: "", description: "", amountAda: "", dueDate: "" },
  ]);
  const [security, setSecurity] = useState({
    multiSig: true,
    autoApproveHours: 72,
    replayProtection: true,
    requireSignatures: true,
  });
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [newReqText, setNewReqText] = useState("");
  const [newReqIsFile, setNewReqIsFile] = useState(false);
  const [newReqSigned, setNewReqSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSeoMeta({
    title: "Post a Tender — TenderHub",
    description: "Create a new tender secured by Cardano smart contract escrow.",
  });

  if (!session) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <Wallet className="mx-auto size-12 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold">Connect your wallet</h2>
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
          <h2 className="text-2xl font-bold">Registration required</h2>
          <Button className="mt-6" asChild><Link to="/register">Register Now</Link></Button>
        </div>
      </Layout>
    );
  }

  if (registration.role !== "buyer") {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Buyers only</h2>
          <Button className="mt-6" asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
        </div>
      </Layout>
    );
  }

  const budgetNum = parseInt(form.budgetAda) || 0;
  const milestoneTotal = milestones.reduce((s, m) => s + (parseInt(m.amountAda) || 0), 0);
  const milestonesValid = contractType !== "milestone" || (milestones.length >= 2 && milestoneTotal === budgetNum);
  const mpesaValid = paymentMethod !== "mpesa" || (validateMpesaPhone(mpesaPhone) && mpesaStkStatus === "confirmed");

  const canSubmit =
    form.title && form.description && form.budgetAda && form.deadline &&
    form.deliveryDate && form.location && form.county && form.procuringEntity && milestonesValid && mpesaValid;

  // ─── M-Pesa STK Push ─────────────────────────────────────────────────

  const handleMpesaStkPush = async () => {
    if (!validateMpesaPhone(mpesaPhone)) {
      toast({ variant: "destructive", title: "Invalid phone number", description: "Use format 2547XXXXXXXX or 07XXXXXXXX." });
      return;
    }
    if (budgetNum <= 0) {
      toast({ variant: "destructive", title: "Set budget first", description: "Enter the budget in ADA before paying via M-Pesa." });
      return;
    }

    const kesAmount = adaToKes(budgetNum);
    setMpesaStkStatus("pushing");
    try {
      const result = await simulateStkPush(normalizeMpesaPhone(mpesaPhone), kesAmount);
      setMpesaCode(result.mpesaCode);
      setMpesaStkStatus("confirmed");
      toast({ title: "M-Pesa payment confirmed", description: `Code: ${result.mpesaCode} · ${formatKes(kesAmount)} → ${budgetNum.toLocaleString()} ₳` });
    } catch (err) {
      setMpesaStkStatus("failed");
      toast({ variant: "destructive", title: "M-Pesa payment failed", description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  // ─── Requirements ──────────────────────────────────────────────────

  const addRequirement = () => {
    if (!newReqText.trim()) return;
    setRequirements([...requirements, {
      id: genReqId(),
      description: newReqText.trim(),
      isFile: newReqIsFile,
      requiresWalletSignature: newReqIsFile && newReqSigned,
    }]);
    setNewReqText("");
    setNewReqIsFile(false);
    setNewReqSigned(false);
  };

  // ─── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!session || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const budgetAda = parseInt(form.budgetAda, 10);
      if (isNaN(budgetAda) || budgetAda <= 0) {
        toast({ variant: "destructive", title: "Invalid budget" });
        setIsSubmitting(false);
        return;
      }

      if (contractType === "milestone" && milestoneTotal !== budgetAda) {
        toast({ variant: "destructive", title: "Milestone mismatch", description: `Milestones must total ${budgetAda} ₳ (currently ${milestoneTotal} ₳).` });
        setIsSubmitting(false);
        return;
      }

      // Sign the escrow funding proof
      const message = `TenderHub Escrow:${session.address}:${budgetAda}:${contractType}:${paymentMethod}:${Date.now()}`;
      await signMessage(session.api, session.address, message);

      const tender = tenders.createTender({
        buyerAddress: session.address,
        buyerName: registration.name,
        procuringEntity: form.procuringEntity,
        title: form.title,
        description: form.description,
        category: form.category,
        publicationType: form.publicationType,
        agpoCategory: form.agpoCategory,
        referenceNumber: form.referenceNumber || undefined,
        budgetAda,
        deadline: form.deadline,
        deliveryDate: form.deliveryDate,
        location: form.location,
        county: form.county,
        requirements,
        attachments: [],
        status: "open",
        contractType,
        paymentMethod,
        milestoneTemplate: contractType === "milestone"
          ? milestones.filter((m) => m.title.trim()).map((m) => ({ title: m.title, description: m.description, amountAda: parseInt(m.amountAda) || 0, dueDate: m.dueDate }))
          : [],
        escrowTxHash: `sim_${Date.now().toString(36)}`,
      });

      toast({ title: "Tender published", description: "Escrow signature recorded. Smart contract ready for funding." });
      navigate(`/tenders/${tender.id}`);
    } catch {
      // handled by toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMilestone = (idx: number, field: keyof MilestoneDraft, value: string) => {
    const next = [...milestones];
    next[idx] = { ...next[idx], [field]: value };
    setMilestones(next);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" asChild>
          <Link to="/tenders"><ArrowLeft className="size-4" /> Back to Tenders</Link>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight mb-1">Post a New Tender</h1>
        <p className="text-muted-foreground mb-6">
          Your budget will be secured in a Cardano smart-contract escrow.
        </p>

        {/* ─── Tender Details ──────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Tender Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Supply and Installation of 500 Solar Panels for Rural Electrification" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Scope includes procurement, transportation, installation, and commissioning of 500 monocrystalline solar panels (450W each) with mounting structures, inverters, and battery storage systems at designated sites in Turkana County. Warranty period: 5 years. Compliance with Kenya Bureau of Standards (KEBS) required." />
            </div>

            {/* Procuring Entity & Reference */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entity">Procuring Entity *</Label>
                <select id="entity" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.procuringEntity} onChange={(e) => setForm({ ...form, procuringEntity: e.target.value })}>
                  {PROCUREMENT_ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refnum">Reference Number</Label>
                <Input id="refnum" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="e.g. KE/KeNHA/2025/0142" />
              </div>
            </div>

            {/* Publication Type & AGPO */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pubtype">Publication Type *</Label>
                <select id="pubtype" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.publicationType} onChange={(e) => setForm({ ...form, publicationType: e.target.value as TenderPublicationType })}>
                  {PUBLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">{PUBLICATION_TYPES.find((t) => t.value === form.publicationType)?.description}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agpo">AGPO Category</Label>
                <select id="agpo" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.agpoCategory} onChange={(e) => setForm({ ...form, agpoCategory: e.target.value as AgpoCategory })}>
                  {AGPO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Reserved for youth, women, or PWD per AGPO</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select id="category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (ADA) *</Label>
                <div className="relative">
                  <Input id="budget" type="number" min="1" value={form.budgetAda} onChange={(e) => setForm({ ...form, budgetAda: e.target.value })} placeholder="150000" className="pr-10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₳</span>
                </div>
                {budgetNum > 0 && (
                  <div className="text-xs text-muted-foreground">≈ {formatKes(adaToKes(budgetNum))} (1 ₳ ≈ KES {KES_TO_ADA_RATE})</div>
                )}
              </div>
            </div>

            {/* County & Location */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="county">County / Region *</Label>
                <select id="county" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>
                  <optgroup label="Kenya Counties">
                    {ALL_LOCATIONS.slice(0, 47).map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="East Africa">
                    {ALL_LOCATIONS.slice(47).map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Delivery Location *</Label>
                <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Lodwar Town, Turkana County" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Bid Deadline *</Label>
                <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <p className="text-xs text-muted-foreground">Bids close on this date</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery">Delivery Date *</Label>
                <Input id="delivery" type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
                <p className="text-xs text-muted-foreground">Expected completion date</p>
              </div>
            </div>

            {/* ─── Requirements (text or file-based) ─────────────────── */}
            <div className="space-y-2">
              <Label>Requirements</Label>
              <p className="text-xs text-muted-foreground">
                Add requirements as text descriptions or file/document uploads. File requirements can require wallet-signed certificate verification.
              </p>
              <div className="rounded-lg border-2 border-dashed p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newReqText}
                    onChange={(e) => setNewReqText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newReqText.trim()) { e.preventDefault(); addRequirement(); } }}
                    placeholder="e.g. Must have ISO 9001 certification and NCA Category A license"
                  />
                  <Button type="button" variant="outline" onClick={addRequirement} disabled={!newReqText.trim()}><Plus className="size-4" /></Button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newReqIsFile}
                      onChange={(e) => { setNewReqIsFile(e.target.checked); if (!e.target.checked) setNewReqSigned(false); }}
                      className="rounded"
                    />
                    <FileText className="size-3.5 text-muted-foreground" />
                    Requires file/document upload
                  </label>
                  {newReqIsFile && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newReqSigned}
                        onChange={(e) => setNewReqSigned(e.target.checked)}
                        className="rounded"
                      />
                      <ShieldCheck className="size-3.5 text-blue-600" />
                      Must be wallet-signed certificate (verified on-chain)
                    </label>
                  )}
                </div>
              </div>
              {requirements.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {requirements.map((req, i) => (
                    <div key={req.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                      {req.isFile ? (
                        <FileText className="size-4 text-blue-600 shrink-0" />
                      ) : (
                        <Check className="size-4 text-emerald-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{req.description}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {req.isFile && (
                            <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 gap-1">
                              <Upload className="size-2.5" /> File Required
                            </Badge>
                          )}
                          {req.requiresWalletSignature && (
                            <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1">
                              <ShieldCheck className="size-2.5" /> Wallet-Signed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setRequirements(requirements.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive shrink-0">
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Contract Type ───────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Layers className="size-5" /> Contract Type *</h3>
              <p className="text-sm text-muted-foreground mt-1">Different occupations need different escrow structures.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTRACT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setContractType(ct.value)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                    contractType === ct.value ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "border-border hover:border-primary/50",
                  )}
                >
                  <div className={cn("flex size-10 items-center justify-center rounded-lg", contractType === ct.value ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground")}>
                    {ct.icon}
                  </div>
                  <div className="font-medium">{ct.label}</div>
                  <div className="text-xs text-muted-foreground">{ct.description}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 italic mt-1">e.g. {ct.example}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Milestone Builder ───────────────────────────────────────── */}
        {contractType === "milestone" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2"><Layers className="size-5" /> Milestones *</h3>
                  <p className="text-sm text-muted-foreground mt-1">Amounts must total {budgetNum > 0 ? `${budgetNum.toLocaleString()} ₳` : "the budget"}.</p>
                </div>
                <Badge variant={milestoneTotal === budgetNum && budgetNum > 0 ? "default" : "destructive"}>
                  {milestoneTotal.toLocaleString()} / {budgetNum.toLocaleString()} ₳
                </Badge>
              </div>

              <div className="space-y-3">
                {milestones.map((m, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">{i + 1}</div>
                      {milestones.length > 1 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input value={m.title} onChange={(e) => updateMilestone(i, "title", e.target.value)} placeholder="Milestone title (e.g. Site Survey & Foundation Work)" />
                    <Input value={m.description} onChange={(e) => updateMilestone(i, "description", e.target.value)} placeholder="Description (e.g. Land survey, excavation, and laying of foundation slab — 30% of total work)" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="relative">
                        <Input type="number" min="1" value={m.amountAda} onChange={(e) => updateMilestone(i, "amountAda", e.target.value)} placeholder="Amount in ADA (e.g. 45000)" className="pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₳</span>
                      </div>
                      <Input type="date" value={m.dueDate} onChange={(e) => updateMilestone(i, "dueDate", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full mt-3 gap-2" onClick={() => setMilestones([...milestones, { title: "", description: "", amountAda: "", dueDate: "" }])}>
                <Plus className="size-4" /> Add Another Milestone
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── Payment Method ──────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Banknote className="size-5" /> Payment Method *</h3>
              <p className="text-sm text-muted-foreground mt-1">How will you fund the escrow? Both methods settle on Cardano.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <button
                onClick={() => setPaymentMethod("ada")}
                className={cn("flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all", paymentMethod === "ada" ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "border-border hover:border-primary/50")}
              >
                <div className={cn("flex size-10 items-center justify-center rounded-lg", paymentMethod === "ada" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground")}>
                  <Wallet className="size-5" />
                </div>
                <div className="font-medium">ADA (Native)</div>
                <div className="text-xs text-muted-foreground">Pay directly with ADA from your Eternl/Typhon wallet. Settles instantly on-chain.</div>
              </button>
              <button
                onClick={() => setPaymentMethod("mpesa")}
                className={cn("flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all", paymentMethod === "mpesa" ? "border-green-600 bg-green-50 dark:bg-green-950/30" : "border-border hover:border-primary/50")}
              >
                <div className={cn("flex size-10 items-center justify-center rounded-lg", paymentMethod === "mpesa" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                  <Smartphone className="size-5" />
                </div>
                <div className="font-medium">M-Pesa (via Cardano)</div>
                <div className="text-xs text-muted-foreground">Pay with M-Pesa STK push. A bridge converts KES → ADA and locks it in the escrow smart contract.</div>
              </button>
            </div>

            {/* M-Pesa STK Push UI */}
            {paymentMethod === "mpesa" && (
              <div className="rounded-lg border-2 border-green-200 dark:border-green-900 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                  <Smartphone className="size-4" /> M-Pesa STK Push
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mpesaPhone" className="text-xs">M-Pesa Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input id="mpesaPhone" value={mpesaPhone} onChange={(e) => { setMpesaPhone(e.target.value); setMpesaStkStatus("idle"); setMpesaCode(""); }} placeholder="254712345678" className="pl-10" disabled={mpesaStkStatus === "pushing"} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: 2547XXXXXXXX or 07XXXXXXXX</p>
                </div>

                {budgetNum > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">You pay (M-Pesa)</span><span className="font-medium">{formatKes(adaToKes(budgetNum))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Escrow locks</span><span className="font-medium">{budgetNum.toLocaleString()} ₳</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Rate</span><span>1 ₳ ≈ KES {KES_TO_ADA_RATE}</span></div>
                  </div>
                )}

                {mpesaStkStatus === "idle" && (
                  <Button variant="outline" className="w-full gap-2 border-green-300 dark:border-green-800" disabled={!validateMpesaPhone(mpesaPhone) || budgetNum <= 0} onClick={handleMpesaStkPush}>
                    <Smartphone className="size-4" /> Send STK Push to {mpesaPhone || "phone"}
                  </Button>
                )}
                {mpesaStkStatus === "pushing" && (
                  <Button disabled className="w-full gap-2">
                    <Loader2 className="size-4 animate-spin" /> Sending STK push… Check your phone.
                  </Button>
                )}
                {mpesaStkStatus === "confirmed" && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Check className="size-4" /> Payment confirmed · Code: <span className="font-mono font-bold">{mpesaCode}</span>
                  </div>
                )}
                {mpesaStkStatus === "failed" && (
                  <Button variant="outline" className="w-full gap-2 border-red-300" onClick={handleMpesaStkPush}>
                    Retry STK Push
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Security Configuration ─────────────────────────────────── */}
        <Card className="mb-6 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Shield className="size-5 text-blue-600" /> Smart Contract Security</h3>
              <p className="text-sm text-muted-foreground mt-1">Enforced on-chain by the Aiken validator.</p>
            </div>
            <div className="space-y-3">
              <SecurityToggle label="Multi-Signature Confirmation" description="Arbitrator must co-sign milestone releases." checked={security.multiSig} onChange={(v) => setSecurity({ ...security, multiSig: v })} />
              <SecurityToggle label="Replay Attack Protection" description="Nonce-based protection — each transaction executes once." checked={security.replayProtection} onChange={(v) => setSecurity({ ...security, replayProtection: v })} />
              <SecurityToggle label="Require Wallet Signatures" description="Every action (submit, approve, reject, cancel) requires a wallet signature proof." checked={security.requireSignatures} onChange={(v) => setSecurity({ ...security, requireSignatures: v })} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm">Auto-Approve Timelock</div>
                  <div className="text-xs text-muted-foreground">If buyer doesn't respond, milestone auto-approves after this period.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" max="168" value={security.autoApproveHours} onChange={(e) => setSecurity({ ...security, autoApproveHours: parseInt(e.target.value) || 72 })} className="w-20 text-center" />
                  <span className="text-sm text-muted-foreground">hrs</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escrow notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex items-start gap-2">
            <Lock className="size-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium">Smart-contract escrow</p>
              <p className="mt-1">
                When you publish, your wallet signs an escrow proof. {budgetNum > 0 && `This locks ${budgetNum.toLocaleString()} ₳`}
                {paymentMethod === "mpesa" && ` (funded via M-Pesa: ${formatKes(adaToKes(budgetNum))})`}
                {contractType === "milestone" ? " with milestone-based release." : " with lump-sum release."}
                {" "}If either party cancels mid-process, completed milestones are paid out and remaining funds are refunded. Disputes are resolved by an arbitrator with on-chain enforced rulings.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/tenders">Cancel</Link></Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="gap-2">
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Signing escrow…</> : <><Check className="size-4" /> Publish Tender</>}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function SecurityToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1">
        <div className="font-medium text-sm flex items-center gap-2"><Shield className="size-3.5 text-blue-600" />{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 rounded-full transition-colors shrink-0 ml-3", checked ? "bg-blue-600" : "bg-muted")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
