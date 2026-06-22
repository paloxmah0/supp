import { Badge } from "@/components/ui/badge";
import type {
  BidStatus,
  ContractStatus,
  DisputeStatus,
  IsoStatus,
  KycStatus,
  MilestoneStatus,
  TenderStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // KYC / ISO
  not_submitted: { label: "Not Submitted", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },

  // Tender
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  open: { label: "Open", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  evaluating: { label: "Evaluating", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  awarded: { label: "Awarded", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  disputed: { label: "Disputed", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },

  // Contract
  funded: { label: "Funded", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  active: { label: "Active", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  milestone_pending: { label: "Milestone Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },

  // Milestone
  in_progress_milestone: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  submitted: { label: "Submitted", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },

  // Bid
  shortlisted: { label: "Shortlisted", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  withdrawn: { label: "Withdrawn", className: "bg-muted text-muted-foreground" },

  // Dispute
  open_dispute: { label: "Open", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  resolved_buyer: { label: "Resolved: Buyer", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  resolved_supplier: { label: "Resolved: Supplier", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  resolved_split: { label: "Resolved: Split", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

export function StatusBadge({ status }: { status: KycStatus | IsoStatus | TenderStatus | BidStatus | ContractStatus | MilestoneStatus | DisputeStatus }) {
  // Map some overlapping statuses to unique keys
  let key = status;
  if (status === "in_progress" && typeof status === "string") key = "in_progress" as never;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[key] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
