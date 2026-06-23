/** Core domain types for the Cardano Tender Hub. */

/** User role on the platform. */
export type UserRole = "buyer" | "supplier";

/** KYC verification status. */
export type KycStatus = "not_submitted" | "pending" | "verified" | "rejected";

/** ISO certification status. */
export type IsoStatus = "not_submitted" | "pending" | "verified" | "rejected";

/**
 * Publication type — standard procurement classifications.
 * Open Tender, RFQ, EOI, Prequalification, Restricted, Direct Procurement.
 */
export type TenderPublicationType =
  | "open_tender"
  | "rfq"            // Request for Quotation
  | "eoi"            // Expression of Interest
  | "prequalification"
  | "restricted"
  | "direct";

/** AGPO reservation category (Access to Government Procurement Opportunities). */
export type AgpoCategory = "none" | "youth" | "women" | "pwd" | "general";

/** A portfolio item (past project / reference). */
export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  client?: string;
  valueAda?: number;
  completedDate?: string;
  tags: string[];
}

/** KYC document metadata (stored as a reference — files go to Blossom). */
export interface KycDocument {
  id: string;
  type: "business_registration" | "director_id" | "tax_certificate" | "utility_bill" | "other";
  label: string;
  uploadedAt: number;
  /** Blossom URL if uploaded, empty string if file reference only. */
  url?: string;
  /** Original file name from the device. */
  fileName?: string;
  /** File size in bytes. */
  fileSize?: number;
  /** File MIME type. */
  fileType?: string;
  /** Whether the document has been wallet-signed (verified). */
  signed?: boolean;
  /** Wallet signature proof (hex). */
  signature?: string;
  /** Timestamp of the wallet signature. */
  signedAt?: number;
}

/** ISO certification metadata. */
export interface IsoCertification {
  id: string;
  standard: string; // e.g. "ISO 9001"
  certifyingBody: string;
  certificateNumber: string;
  issueDate: string;
  expiryDate: string;
  url?: string;
  /** Original file name from the device. */
  fileName?: string;
  /** File size in bytes. */
  fileSize?: number;
  /** File MIME type. */
  fileType?: string;
  /** Whether the certification has been wallet-signed (verified). */
  signed?: boolean;
  /** Wallet signature proof (hex). */
  signature?: string;
  /** Timestamp of the wallet signature. */
  signedAt?: number;
}

/** A registered entity (buyer or supplier) on the platform. */
export interface Registration {
  /** Unique identifier = `${walletAddress}` */
  id: string;
  walletAddress: string;
  walletName: string;
  role: UserRole;
  /** Company / individual display name */
  name: string;
  email: string;
  phone?: string;
  description: string;
  industry: string;
  country: string;
  city: string;
  website?: string;
  logoUrl?: string;
  /** When registration was created. */
  createdAt: number;
  /** When last updated. */
  updatedAt: number;
  /** Portfolio items. */
  portfolio: PortfolioItem[];
  /** KYC verification state. */
  kyc: {
    status: KycStatus;
    documents: KycDocument[];
    submittedAt?: number;
    reviewedAt?: number;
    reviewerNote?: string;
  };
  /** ISO certification state. */
  iso: {
    status: IsoStatus;
    certifications: IsoCertification[];
    submittedAt?: number;
    reviewedAt?: number;
    reviewerNote?: string;
  };
  /** Smart-contract registration transaction hash (if on-chain). */
  txHash?: string;
}

/** Tender status lifecycle. */
export type TenderStatus =
  | "draft"
  | "open"
  | "evaluating"
  | "awarded"
  | "in_progress"
  | "completed"
  | "closed"
  | "cancelled"
  | "disputed";

// ─── Smart Contract Escrow Types ──────────────────────────────────────

/**
 * The type of escrow contract. Different occupations need different
 * payment-release structures.
 */
export type ContractType =
  /** Single lump-sum payment on full delivery confirmation. */
  | "lump_sum"
  /** Payment released in milestones as work progresses. */
  | "milestone"
  /** Payment released hourly/time-based with periodic approvals. */
  | "time_based"
  /** Payment released on achieving measurable KPIs/metrics. */
  | "performance_based";

/** A milestone in a milestone-based contract. */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  /** Amount in ADA locked for this milestone. */
  amountAda: number;
  /** Expected delivery date (ISO string). */
  dueDate: string;
  status: MilestoneStatus;
  /** Sequential order index. */
  order: number;
  /** When the milestone was marked as submitted by the supplier. */
  submittedAt?: number;
  /** When the buyer approved the milestone. */
  approvedAt?: number;
  /** Payment release transaction hash. */
  releaseTxHash?: string;
  /** Evidence/proof of work submitted by the supplier. */
  evidence: MilestoneEvidence[];
}

export type MilestoneStatus =
  | "pending"       // Not yet started
  | "in_progress"   // Supplier working on it
  | "submitted"     // Supplier submitted evidence, awaiting buyer review
  | "approved"      // Buyer approved, payment released
  | "rejected"      // Buyer rejected the submission
  | "disputed";     // Under dispute resolution

/** Evidence submitted by supplier for a milestone. */
export interface MilestoneEvidence {
  id: string;
  description: string;
  /** URLs to uploaded proof (documents, photos, links). */
  attachments: { name: string; url?: string }[];
  submittedAt: number;
  submittedBy: string;
  /** Tamper-proof: SHA-256 hash of the evidence content at submission time. */
  contentHash?: string;
  /** Tamper-proof: wallet signature over the content hash, proving the
   * supplier authored this evidence and it hasn't been altered since. */
  signature?: string;
  /** Whether this evidence is locked (tamper-proof). Once `true`, the
   * evidence cannot be modified. */
  locked?: boolean;
}

// ─── Dispute Resolution ────────────────────────────────────────────────

export type DisputeStatus =
  | "open"           // Dispute filed, awaiting arbitrator assignment
  | "under_review"   // Arbitrator assigned and reviewing
  | "resolved_buyer"    // Resolved in favor of buyer
  | "resolved_supplier" // Resolved in favor of supplier
  | "resolved_split"    // Split between parties
  | "withdrawn";     // Dispute withdrawn by filer

export type DisputeScope = "milestone" | "tender" | "quality" | "timeline" | "payment";

/** A dispute filed against a contract/milestone. */
export interface Dispute {
  id: string;
  contractId: string;
  tenderId: string;
  /** Who filed the dispute. */
  filedBy: string;
  filedByName: string;
  filedAgainst: string;
  filedAgainstName: string;
  scope: DisputeScope;
  /** If scope is "milestone", the milestone ID. */
  milestoneId?: string;
  title: string;
  description: string;
  status: DisputeStatus;
  createdAt: number;
  updatedAt: number;
  /** The assigned arbitrator's wallet address. */
  arbitrator?: string;
  arbitratorName?: string;
  /** When the arbitrator was assigned. */
  assignedAt?: number;
  /** When the dispute was resolved. */
  resolvedAt?: number;
  /** The arbitrator's ruling. */
  ruling?: string;
  /** Percentage split if resolved as "resolved_split" (buyer gets this %). */
  splitPercentage?: number;
  /** Evidence submitted by both parties. */
  evidence: DisputeEvidence[];
}

export interface DisputeEvidence {
  id: string;
  submittedBy: string;
  submittedByName: string;
  description: string;
  attachments: { name: string; url?: string }[];
  submittedAt: number;
}

// ─── Contract / Escrow ────────────────────────────────────────────────

/**
 * Payment method for funding the escrow. ADA is native; M-Pesa bridges
 * KES into the Cardano escrow via an on-chain oracle / bridge.
 */
export type PaymentMethod = "ada" | "mpesa";

/**
 * M-Pesa payment metadata when M-Pesa is used to fund the escrow.
 * The buyer pays in KES via STK push; a bridge locks equivalent ADA
 * in the smart contract.
 */
export interface MpesaPayment {
  /** M-Pesa phone number (format: 2547XXXXXXXX). */
  phoneNumber: string;
  /** Amount in KES. */
  amountKes: number;
  /** M-Pesa transaction code (e.g. QFG3KXYZ12). */
  mpesaCode?: string;
  /** Status of the M-Pesa STK push. */
  status: "pending" | "completed" | "failed";
  /** When the STK push was initiated. */
  initiatedAt: number;
  /** When the payment was confirmed. */
  confirmedAt?: number;
}

/**
 * The on-chain escrow contract created when a tender is awarded.
 * This tracks the full lifecycle: funding → milestones → completion/dispute/cancellation.
 */
export interface EscrowContract {
  id: string;
  tenderId: string;
  buyerAddress: string;
  buyerName: string;
  supplierAddress: string;
  supplierName: string;
  /** Total amount locked in escrow (ADA). */
  totalAmountAda: number;
  /** Amount released so far. */
  releasedAmountAda: number;
  contractType: ContractType;
  /** Milestones (empty for lump_sum). */
  milestones: Milestone[];
  status: ContractStatus;
  /** On-chain funding transaction hash. */
  fundingTxHash?: string;
  /** Contract creation timestamp. */
  createdAt: number;
  updatedAt: number;
  /** Deadline for full contract completion. */
  completionDeadline: string;
  /** Disputes filed against this contract. */
  disputes: Dispute[];
  /** Security configuration. */
  security: ContractSecurity;
  /** Immutable audit log of all contract actions. */
  auditLog: AuditEntry[];
  /** Payment method used to fund the escrow. */
  paymentMethod: PaymentMethod;
  /** M-Pesa payment details (if paymentMethod is "mpesa"). */
  mpesaPayment?: MpesaPayment;
  /** Cancellation details (if the contract was cancelled mid-process). */
  cancellation?: ContractCancellation;
}

export type ContractStatus =
  | "funded"          // Escrow funded, awaiting supplier start
  | "active"          // Work in progress
  | "milestone_pending" // A milestone is awaiting approval
  | "completed"       // All milestones done, fully released
  | "disputed"        // Active dispute
  | "cancelled"       // Cancelled, funds settled per cancellation terms
  | "expired";        // Deadline passed, auto-refund triggered

/**
 * Mid-process cancellation record.
 * Captures who cancelled, why, and how remaining funds were split.
 */
export interface ContractCancellation {
  /** Who initiated the cancellation. */
  initiatedBy: "buyer" | "supplier" | "mutual";
  /** The other party's address. */
  initiatorAddress: string;
  initiatorName: string;
  /** Reason for cancellation. */
  reason: string;
  /** When the cancellation was requested. */
  requestedAt: number;
  /** When the other party accepted (for mutual cancellation). */
  acceptedAt?: number;
  /** Cancellation status. */
  status: "requested" | "accepted" | "rejected" | "enforced";
  /**
   * How remaining funds were settled:
   * - "full_refund_buyer": Buyer gets all remaining funds (supplier hadn't started / buyer cancelled early)
   * - "supplier_paid_completed": Supplier keeps all released amounts; buyer gets remaining un-released funds
   * - "partial_split": Remaining funds split by percentage (e.g. supplier gets paid for work done)
   */
  settlement: "full_refund_buyer" | "supplier_paid_completed" | "partial_split";
  /** If partial_split, the percentage of remaining funds the supplier keeps. */
  supplierKeepPercent?: number;
  /** On-chain cancellation transaction hash. */
  txHash?: string;
  /**
   * Bad-faith penalty: if one party rejected a cancellation that was later
   * determined to be unjustified (the other party's work was legit), the
   * rejector is penalized. This records the penalty details.
   */
  penalty?: ContractCancellationPenalty;
}

/** Penalty applied when a cancellation rejection was in bad faith. */
export interface ContractCancellationPenalty {
  /** Who was penalized. */
  penalizedParty: "buyer" | "supplier";
  /** Why they were penalized. */
  reason: string;
  /** The penalty percentage of the total contract value deducted from
   * the penalized party's settlement share. */
  penaltyPercent: number;
  /** The ADA amount deducted as penalty. */
  penaltyAmountAda: number;
  /** Whether the penalty was applied by an arbitrator or auto-determined. */
  appliedBy: "arbitrator" | "auto";
  /** When the penalty was applied. */
  appliedAt: number;
}

/** Security configuration for a contract. */
export interface ContractSecurity {
  /** Whether multi-signature confirmation is required (buyer + arbitrator). */
  multiSig: boolean;
  /** Timelock period in hours before a milestone auto-approves if no rejection. */
  autoApproveHours: number;
  /** Whether replay-attack protection is enabled (nonce-based). */
  replayProtection: boolean;
  /** Whether all actions require on-chain signature verification. */
  requireSignatures: boolean;
  /** The assigned arbitrator's wallet address (if pre-assigned). */
  defaultArbitrator?: string;
}

/** Immutable audit log entry — every contract action is recorded. */
export interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;
  actorName: string;
  action: string;
  details: string;
  /** Transaction hash if the action was on-chain. */
  txHash?: string;
}

/**
 * A tender requirement that can be either a text description or a
 * file/document that must be uploaded and wallet-signed by the supplier.
 */
export interface TenderRequirement {
  id: string;
  /** The requirement text (e.g. "Must have ISO 9001 certification"). */
  description: string;
  /** Whether this requirement requires a file/document upload. */
  isFile: boolean;
  /** Whether the file must be wallet-signed (verified certificate). */
  requiresWalletSignature: boolean;
}

/** A tender posted by a buyer. */
export interface Tender {
  id: string;
  buyerAddress: string;
  buyerName: string;
  /** Procuring entity name (e.g. "Kenya Roads Board", "Ministry of Health"). */
  procuringEntity: string;
  title: string;
  description: string;
  category: string;
  /** Publication type: open tender, RFQ, EOI, etc. */
  publicationType: TenderPublicationType;
  /** AGPO reservation category. */
  agpoCategory: AgpoCategory;
  budgetAda: number;
  deadline: string; // ISO date string
  deliveryDate: string; // ISO date string
  location: string;
  /** County / region (one of 47 counties or an East African country). */
  county: string;
  /** Structured requirements (text or file-based). */
  requirements: TenderRequirement[];
  attachments: { name: string; url?: string }[];
  status: TenderStatus;
  createdAt: number;
  updatedAt: number;
  /** The type of escrow contract this tender uses. */
  contractType: ContractType;
  /** Milestone template (for milestone-based contracts). */
  milestoneTemplate: { title: string; description: string; amountAda: number; dueDate: string }[];
  /** Payment method for funding the escrow. */
  paymentMethod: PaymentMethod;
  /** Smart-contract escrow tx hash (if funded on-chain). */
  escrowTxHash?: string;
  /** The escrow contract ID once awarded. */
  contractId?: string;
  /** Tender reference number (e.g. "KE/PPRA/2025/001"). */
  referenceNumber?: string;
}

/** Bid status lifecycle. */
export type BidStatus = "submitted" | "shortlisted" | "awarded" | "rejected" | "withdrawn";

/** A bid submitted by a supplier on a tender. */
export interface Bid {
  id: string;
  tenderId: string;
  supplierAddress: string;
  supplierName: string;
  priceAda: number;
  deliveryDays: number;
  proposal: string;
  attachments: { name: string; url?: string }[];
  status: BidStatus;
  createdAt: number;
  updatedAt: number;
}
