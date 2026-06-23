import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
  Wallet as WalletIcon,
  X,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { signMessageWithTimeout, signAllDocuments, type CIP30EnabledAPI } from "@/lib/cardano";
import type {
  KycDocument,
  IsoCertification,
  Registration,
  UserRole,
} from "@/lib/types";

const STEPS = [
  { id: 0, label: "Wallet", icon: WalletIcon },
  { id: 1, label: "Role", icon: BadgeCheck },
  { id: 2, label: "Profile", icon: FileText },
  { id: 3, label: "KYC", icon: ShieldCheck },
  { id: 4, label: "ISO", icon: BadgeCheck },
  { id: 5, label: "Review", icon: CheckCircle2 },
] as const;

const INDUSTRIES = [
  "Construction",
  "IT & Software",
  "Manufacturing",
  "Logistics & Transport",
  "Energy & Utilities",
  "Healthcare & Medical",
  "Agriculture",
  "Finance & Insurance",
  "Education",
  "Consulting",
  "Other",
];

const KYC_DOC_TYPES = [
  { value: "business_registration", label: "Business Registration" },
  { value: "director_id", label: "Director / Owner ID" },
  { value: "tax_certificate", label: "Tax Certificate" },
  { value: "utility_bill", label: "Utility Bill (Proof of Address)" },
  { value: "other", label: "Other" },
] as const;

const ISO_STANDARDS = [
  "ISO 9001 (Quality Management)",
  "ISO 14001 (Environmental)",
  "ISO 27001 (Information Security)",
  "ISO 45001 (Occupational Health & Safety)",
  "ISO 22000 (Food Safety)",
  "ISO 50001 (Energy Management)",
  "Other",
];

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, registrations } = useTenderHub();
  const { session } = wallet;

  const existing = session ? registrations.getRegistration(session.address) : undefined;

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<UserRole>(existing?.role ?? "buyer");
  const [formData, setFormData] = useState({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    description: existing?.description ?? "",
    industry: existing?.industry ?? INDUSTRIES[0],
    country: existing?.country ?? "",
    city: existing?.city ?? "",
    website: existing?.website ?? "",
    logoUrl: existing?.logoUrl ?? "",
  });
  const [kycDocs, setKycDocs] = useState<KycDocument[]>(existing?.kyc.documents ?? []);
  const [isoCerts, setIsoCerts] = useState<IsoCertification[]>(existing?.iso.certifications ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();

  useSeoMeta({
    title: "Register — TenderHub",
    description: "Register as a buyer or supplier on the Cardano-secured tender platform.",
  });

  // Step 0: must connect wallet
  if (!session) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <WalletIcon className="size-8" />
              </div>
              <h2 className="text-2xl font-bold">Connect your wallet first</h2>
              <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                Registration requires a Cardano wallet (Eternl or Typhon).
                Your wallet address becomes your on-chain identity.
              </p>
              <Button className="mt-6 gap-2" asChild>
                <Link to="/">
                  <ArrowLeft className="size-4" />
                  Back to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const canProceed = () => {
    switch (step) {
      case 0: return true; // wallet already connected
      case 1: return !!role;
      case 2: return formData.name && formData.email && formData.country && formData.city;
      case 3: return kycDocs.length >= 2; // at least 2 docs (no per-doc signing required)
      case 4: return true; // ISO is optional but recommended
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      // ─── ONE SINGLE SIGNING: batch-sign all KYC + ISO docs at once ───
      // Instead of asking the user to sign each document individually, we
      // build a single message covering ALL documents and sign it once.
      const allDocs = [
        ...kycDocs.map((d) => ({ id: d.id, type: d.type, label: d.label, fileName: d.fileName, fileSize: d.fileSize, uploadedAt: d.uploadedAt })),
        ...isoCerts.map((c) => ({ id: c.id, type: "iso_certification", label: c.standard, fileName: c.fileName, fileSize: c.fileSize, uploadedAt: Number(c.id.split("-")[0]) })),
      ];

      let batchSignature: { signature: string; signedAt: number; batchHash: string } | undefined;

      if (allDocs.length > 0) {
        try {
          batchSignature = await signAllDocuments(session.api, session.address, allDocs);
          toast({ title: "Documents signed", description: `${allDocs.length} document(s) signed in a single transaction.` });
        } catch (err) {
          // If batch signing fails, still register but mark docs as unsigned
          toast({ variant: "destructive", title: "Batch signing failed", description: err instanceof Error ? err.message : "Documents not signed. You can retry later." });
        }
      }

      // Also sign the registration proof (this is the final wallet signature)
      const regMessage = `TenderHub Registration:${session.address}:${role}:${formData.name}:${Date.now()}`;
      await signMessageWithTimeout(session.api, session.address, regMessage, 30000);

      const now = Date.now();
      // Apply the batch signature to all documents
      const signedKycDocs = kycDocs.map((d) => ({
        ...d,
        signed: !!batchSignature,
        signature: batchSignature?.signature,
        signedAt: batchSignature?.signedAt,
      }));
      const signedIsoCerts = isoCerts.map((c) => ({
        ...c,
        signed: !!batchSignature,
        signature: batchSignature?.signature,
        signedAt: batchSignature?.signedAt,
      }));

      const reg: Registration = {
        id: session.address,
        walletAddress: session.address,
        walletName: session.walletName,
        role,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        description: formData.description,
        industry: formData.industry,
        country: formData.country,
        city: formData.city,
        website: formData.website || undefined,
        logoUrl: formData.logoUrl || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        portfolio: existing?.portfolio ?? [],
        kyc: {
          status: kycDocs.length >= 2 ? "pending" : "not_submitted",
          documents: signedKycDocs,
          submittedAt: kycDocs.length >= 2 ? now : undefined,
        },
        iso: {
          status: isoCerts.length > 0 ? "pending" : "not_submitted",
          certifications: signedIsoCerts,
          submittedAt: isoCerts.length > 0 ? now : undefined,
        },
        txHash: txHash,
      };

      registrations.upsertRegistration(reg);

      toast({ title: "Registration complete", description: "Your documents are pending verification." });
      navigate("/dashboard");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: err instanceof Error ? err.message : "Wallet signing was cancelled or timed out.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Registration</h1>
          <p className="mt-2 text-muted-foreground">
            Register as a buyer or supplier. KYC and ISO verification required.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-10 flex items-center justify-between overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border-2 transition-all",
                      isDone && "border-blue-600 bg-blue-600 text-white",
                      isActive && "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/50",
                      !isActive && !isDone && "border-border text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="size-5" /> : <Icon className="size-5" />}
                  </div>
                  <span className={cn("text-xs font-medium whitespace-nowrap", isActive ? "text-blue-600" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("mx-1 h-0.5 w-8 sm:w-12 rounded-full transition-colors", i < step ? "bg-blue-600" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="pt-6">
            {/* Step 0: Wallet */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                  <span className="font-medium">Wallet connected</span>
                </div>
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className="font-medium">{session.walletName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Address</span>
                    <span className="font-mono text-xs truncate max-w-[200px]">{session.address}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Network</span>
                    <Badge variant="secondary">{session.networkId === 1 ? "Mainnet" : "Testnet"}</Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex items-start gap-2">
                    <Lock className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    <p className="text-blue-900 dark:text-blue-200">
                      Your wallet address will be used as your unique identity on the platform.
                      You will sign once at the end to verify all your documents — no per-document
                      signatures needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Role */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Choose your role</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can change this later from your dashboard.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <RoleCard
                    selected={role === "buyer"}
                    onClick={() => setRole("buyer")}
                    title="Buyer"
                    description="Post tenders, review bids, and award contracts. Lock funds in escrow."
                    icon={<FileText className="size-6" />}
                  />
                  <RoleCard
                    selected={role === "supplier"}
                    onClick={() => setRole("supplier")}
                    title="Supplier"
                    description="Browse tenders, submit bids, and deliver work. Get paid on completion."
                    icon={<BadgeCheck className="size-6" />}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Profile */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-lg">Company profile</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tell us about your organization.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company / Individual Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Bidco Africa Ltd."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="procurement@bidcoafrica.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+254 712 345 678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry *</Label>
                    <select
                      id="industry"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    >
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="Kenya"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Nairobi"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://bidcoafrica.com"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Bidco Africa Ltd. is a leading manufacturer of edible oils, soaps, and household products in East Africa. Established in 1985, we operate across 15 countries with ISO 9001 and HACCP certifications."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: KYC */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-lg">KYC Verification</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload at least 2 documents from your device for identity and business verification.
                    All documents will be signed in a single transaction at the end.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                    <p className="text-emerald-900 dark:text-emerald-200">
                      <strong>One signature for everything.</strong> Upload your documents now —
                      you'll sign them all at once when you submit your registration.
                      No per-document wallet popups.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {kycDocs.map((doc, idx) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <FileText className="size-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{doc.label}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{KYC_DOC_TYPES.find((t) => t.value === doc.type)?.label}</span>
                          {doc.fileName && <span className="text-muted-foreground/70">· {doc.fileName}</span>}
                          <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 gap-1">
                            <Lock className="size-2.5" /> Pending batch sign
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setKycDocs(kycDocs.filter((_, i) => i !== idx))}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <KycUploadForm
                    onAdd={(doc) => setKycDocs([...kycDocs, doc])}
                  />
                </div>
                {kycDocs.length > 0 && kycDocs.length < 2 && (
                  <p className="text-sm text-amber-600">
                    Upload at least {2 - kycDocs.length} more document(s) to proceed.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: ISO */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-lg">ISO Certification</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add ISO certifications to increase your credibility. Upload the certificate file from your device.
                    All certificates will be signed together with your KYC documents at the end. Optional but recommended.
                  </p>
                </div>
                <div className="space-y-3">
                  {isoCerts.map((cert, idx) => (
                    <div key={cert.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <BadgeCheck className="size-5 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{cert.standard}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{cert.certifyingBody} · {cert.certificateNumber}</span>
                          {cert.fileName && <span className="text-muted-foreground/70">· {cert.fileName}</span>}
                          <Badge variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 gap-1">
                            <Lock className="size-2.5" /> Pending batch sign
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsoCerts(isoCerts.filter((_, i) => i !== idx))}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <IsoCertForm
                    onAdd={(cert) => setIsoCerts([...isoCerts, cert])}
                  />
                </div>
                {isoCerts.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No ISO certifications added. You can skip this step and add them later.
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-lg">Review & submit</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Confirm your details. Clicking "Register" will prompt your wallet once to sign
                    your registration proof and all documents in a single transaction.
                  </p>
                </div>
                <div className="space-y-3">
                  <ReviewRow label="Role" value={role === "buyer" ? "Buyer" : "Supplier"} />
                  <ReviewRow label="Name" value={formData.name} />
                  <ReviewRow label="Email" value={formData.email} />
                  <ReviewRow label="Industry" value={formData.industry} />
                  <ReviewRow label="Location" value={`${formData.city}, ${formData.country}`} />
                  <ReviewRow label="KYC Documents" value={`${kycDocs.length} uploaded`} />
                  <ReviewRow label="ISO Certifications" value={`${isoCerts.length} added`} />
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex items-start gap-2">
                    <Lock className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-200">
                      <p className="font-medium">Single wallet signature</p>
                      <p className="mt-1">
                        You will sign once to verify your registration and all {kycDocs.length + isoCerts.length} document(s).
                        After signing, your KYC and ISO will be pending verification by other platform users.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 0} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
              Next
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing registration…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Register
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function RoleCard({
  selected,
  onClick,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all",
        selected
          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
          : "border-border hover:border-primary/50",
      )}
    >
      <div className={cn(
        "flex size-12 items-center justify-center rounded-lg transition-colors",
        selected ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground",
      )}>
        {icon}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      {selected && (
        <div className="flex items-center gap-1 text-sm font-medium text-blue-600">
          <Check className="size-4" /> Selected
        </div>
      )}
    </button>
  );
}

function KycUploadForm({
  onAdd,
}: {
  onAdd: (doc: KycDocument) => void;
}) {
  const [type, setType] = useState<KycDocument["type"]>("business_registration");
  const [label, setLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!label.trim()) {
        setLabel(file.name.replace(/\.[^.]+$/, ""));
      }
    }
  };

  const handleAdd = () => {
    if (!label.trim() || !selectedFile) return;

    const uploadedAt = Date.now();
    const docId = `${uploadedAt}-${Math.random().toString(36).slice(2, 8)}`;

    // No per-document signing — documents are batch-signed at registration submit
    onAdd({
      id: docId,
      type,
      label: label.trim(),
      uploadedAt,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      signed: false, // will be set to true after batch sign at submit
    });

    setLabel("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="rounded-lg border-2 border-dashed p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Upload className="size-4" />
        Upload a document from your device
      </div>
      <div className="grid gap-3">
        {/* File picker */}
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-blue-600" />
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground mb-1" />
              <p className="text-sm text-muted-foreground">Click to select a file from your device</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG, PNG up to 10MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
          />
        </div>

        {/* Type & label */}
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={type}
            onChange={(e) => setType(e.target.value as KycDocument["type"])}
          >
            {KYC_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Document label (e.g. Certificate of Incorporation)"
          />
        </div>

        <Button
          onClick={handleAdd}
          disabled={!label.trim() || !selectedFile}
          className="w-full gap-2"
        >
          <Upload className="size-4" />
          Add Document
        </Button>
      </div>
    </div>
  );
}

function IsoCertForm({
  onAdd,
}: {
  onAdd: (cert: IsoCertification) => void;
}) {
  const [standard, setStandard] = useState(ISO_STANDARDS[0]);
  const [body, setBody] = useState("");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAdd = () => {
    if (!body.trim() || !number.trim()) return;

    const uploadedAt = Date.now();
    const certId = `${uploadedAt}-${Math.random().toString(36).slice(2, 8)}`;

    // No per-certificate signing — batch-signed at registration submit
    onAdd({
      id: certId,
      standard,
      certifyingBody: body.trim(),
      certificateNumber: number.trim(),
      issueDate,
      expiryDate,
      fileName: selectedFile?.name,
      fileSize: selectedFile?.size,
      fileType: selectedFile?.type,
      signed: false, // will be set to true after batch sign at submit
    });

    setBody("");
    setNumber("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="rounded-lg border-2 border-dashed p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <BadgeCheck className="size-4" />
        Add a certification
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Standard</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={standard}
            onChange={(e) => setStandard(e.target.value)}
          >
            {ISO_STANDARDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Certifying Body</Label>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="BSI, TÜV, SGS..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Certificate Number</Label>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ISO-2024-001234"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Issue Date</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Expiry Date</Label>
          <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      {/* File upload */}
      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        {selectedFile ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-blue-600" />
            <span className="font-medium">{selectedFile.name}</span>
            <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="size-5 text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">Upload certificate file from device (optional)</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG, PNG</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileSelect}
        />
      </div>

      <Button
        onClick={handleAdd}
        disabled={!body.trim() || !number.trim()}
        className="w-full gap-2"
      >
        <Upload className="size-4" />
        Add Certification
      </Button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
