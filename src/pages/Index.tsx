import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  BarChart3,
  Building2,
  FileText,
  Gavel,
  Lock,
  MapPin,
  Scale,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import { useTenderHub } from "@/contexts/TenderHubContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const { wallet, tenders } = useTenderHub();
  const isConnected = !!wallet.session;
  const openTenders = tenders.tenders.filter((t) => t.status === "open").length;

  useSeoMeta({
    title: "TenderHub — Cardano-Secured Tender Platform",
    description:
      "A transparent tender marketplace where buyers and suppliers connect, bid, and trade — with KYC, ISO certification, milestone escrow, dispute resolution, and M-Pesa support. Every transaction is secured by Cardano smart contracts.",
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-indigo-50/50 to-background dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-background" />
        <div className="absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,rgba(59,130,246,0.12),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5 py-1.5">
              <ShieldCheck className="size-3.5 text-blue-600" />
              <span className="text-xs font-medium">Cardano Testnet · Aiken Smart Contracts · M-Pesa Bridge</span>
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              The tender platform,{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                secured by blockchain
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              A transparent tender marketplace where buyers and suppliers
              connect, bid, and trade. Every tender, bid, and payment is locked
              in Cardano smart contracts — with milestone escrow, dispute
              resolution, and M-Pesa support.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!isConnected ? (
                <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
                  <Link to="/register"><Wallet className="size-5" /> Get Started</Link>
                </Button>
              ) : (
                <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
                  <Link to="/dashboard">Go to Dashboard <ArrowRight className="size-5" /></Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link to="/tenders">Browse Tenders</Link>
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-8 sm:grid-cols-4">
              <HeroStat value={String(tenders.tenders.length)} label="Total Tenders" />
              <HeroStat value={String(openTenders)} label="Open Now" />
              <HeroStat value="47+" label="Counties & Regions" />
              <HeroStat value="100%" label="On-Chain Escrow" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground text-lg">From wallet connection to on-chain contract</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StepCard step="01" icon={<Wallet className="size-6" />} title="Connect Wallet" description="Sign in with Eternl or Typhon on Cardano testnet. Your wallet address is your identity — no passwords. M-Pesa supported for funding." />
          <StepCard step="02" icon={<FileText className="size-6" />} title="Register & Verify" description="Choose buyer or supplier. Complete your profile, upload KYC documents and ISO certifications from your device — each wallet-signed for authenticity." />
          <StepCard step="03" icon={<Gavel className="size-6" />} title="Post or Bid" description="Buyers publish tenders (RFP, RFQ, EOI). Suppliers browse by county, category, and entity — then submit wallet-signed bids." />
          <StepCard step="04" icon={<Lock className="size-6" />} title="Escrow & Milestones" description="Funds locked in Aiken smart contract. Payment releases per milestone. Disputes resolved by arbitrator. Cancel anytime with fair settlement." />
        </div>
      </section>

      {/* Blockchain features */}
      <section className="bg-muted/30 border-y border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for trust — on the blockchain</h2>
            <p className="mt-3 text-muted-foreground text-lg">Every transaction secured by Cardano smart contracts</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={<Lock className="size-5" />} title="Smart-Contract Escrow" description="Aiken validators lock buyer funds at tender creation. Payment releases per milestone — no manual escrow, no trust needed." />
            <FeatureCard icon={<Scale className="size-5" />} title="Dispute Resolution" description="File a dispute and the contract freezes. A designated arbitrator reviews evidence and issues an on-chain ruling with a fund split." />
            <FeatureCard icon={<Ban className="size-5" />} title="Fair Cancellation" description="Cancel mid-process? Completed milestones are paid out. In-progress work gets 50/50 split. No work done = full refund. Enforced on-chain." />
            <FeatureCard icon={<Smartphone className="size-5" />} title="M-Pesa via Cardano" description="Pay with M-Pesa STK push. A bridge converts KES to ADA and locks it in the same smart contract. Familiar for local businesses." />
            <FeatureCard icon={<ShieldCheck className="size-5" />} title="KYC + ISO Verification" description="Upload business registration, director ID, tax certificates, and ISO certifications from your device. Each is wallet-signed for on-chain verification." />
            <FeatureCard icon={<Building2 className="size-5" />} title="Counties & Regions" description="Filter tenders by 47 counties and East African countries. AGPO reservations for youth, women, and PWD." />
            <FeatureCard icon={<FileText className="size-5" />} title="All Publication Types" description="Open tenders, RFQs, EOIs, prequalifications, restricted tenders, and direct procurement." />
            <FeatureCard icon={<Users className="size-5" />} title="Supplier Directory" description="Browse verified suppliers by industry, county, and verification status. See portfolios, ISO certs, and past project values." />
            <FeatureCard icon={<BarChart3 className="size-5" />} title="Live Statistics" description="Real-time dashboard showing tender volumes, category breakdowns, county distribution, and on-chain contract activity." />
          </div>
        </div>
      </section>

      {/* Tender types */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Every type of tender</h2>
          <p className="mt-3 text-muted-foreground text-lg">Supporting all standard publication types</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TenderTypeCard icon={<Gavel className="size-5" />} title="Open Tender" description="Competitive tender open to all qualified suppliers. The most common type." />
          <TenderTypeCard icon={<FileText className="size-5" />} title="Request for Quotation (RFQ)" description="Quick quotation for lower-value procurement. Fast turnaround." />
          <TenderTypeCard icon={<Users className="size-5" />} title="Expression of Interest (EOI)" description="Pre-screening to create a supplier pool for future opportunities." />
          <TenderTypeCard icon={<BadgeCheck className="size-5" />} title="Prequalification" description="Pre-qualify suppliers for upcoming tenders in a specific category." />
          <TenderTypeCard icon={<Lock className="size-5" />} title="Restricted Tender" description="Invitation to selected pre-qualified suppliers only." />
          <TenderTypeCard icon={<Zap className="size-5" />} title="Direct Procurement" description="Single-source procurement. Requires justification and transparency." />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 px-8 py-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to trade with confidence?
            </h2>
            <p className="max-w-2xl text-blue-100 text-lg">
              Connect your Cardano wallet and join the tender marketplace where
              every transaction is secured by smart contracts. M-Pesa supported.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" variant="secondary" className="gap-2" asChild>
                <Link to="/register">Start Registration <ArrowRight className="size-5" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10" asChild>
                <Link to="/stats">View Statistics</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
};

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}

function StepCard({ step, icon, title, description }: { step: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <div className="absolute top-4 right-5 text-5xl font-bold text-primary/5 select-none">{step}</div>
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">{icon}</div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function TenderTypeCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default Index;
