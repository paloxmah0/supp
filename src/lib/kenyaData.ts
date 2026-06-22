import type { AgpoCategory, TenderPublicationType } from "@/lib/types";

/** Kenya's 47 counties for location-based filtering. */
export const KENYA_COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Kakamega",
  "Bungoma", "Meru", "Kilifi", "Kwale", "Taita-Taveta", "Lamu", "Tana River",
  "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Turkana", "West Pokot",
  "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi",
  "Baringo", "Laikipia", "Nyeri", "Kirinyaga", "Murang'a", "Nyandarua",
  "Embu", "Tharaka-Nithi", "Kitui", "Makueni", "Kericho", "Bomet", "Homa Bay",
  "Migori", "Kisii", "Nyamira", "Siaya", "Busia", "Vihiga", "Narok", "Kajiado",
] as const;

/** East African countries beyond Kenya for regional reach. */
export const EAST_AFRICAN_COUNTRIES = [
  "Uganda", "Tanzania", "Rwanda", "South Sudan", "Somalia", "Ethiopia", "Burundi",
] as const;

/** All locations = Kenya counties + East African countries. */
export const ALL_LOCATIONS = [...KENYA_COUNTIES, ...EAST_AFRICAN_COUNTRIES] as const;

/** Tender categories for classification. */
export const TENDER_CATEGORIES = [
  "Construction & Infrastructure",
  "Roads & Transport",
  "IT & Software",
  "Medical & Healthcare Supplies",
  "Education Supplies",
  "Agriculture & Livestock",
  "Water & Sanitation",
  "Energy & Power",
  "Security & Safety Equipment",
  "Office Supplies & Furniture",
  "Consultancy Services",
  "Cleaning & Waste Management",
  "Food & Catering",
  "Telecommunications",
  "Machinery & Equipment",
  "Other",
] as const;

/** Publication types matching Kenya PPRA classifications. */
export const PUBLICATION_TYPES: { value: TenderPublicationType; label: string; description: string }[] = [
  { value: "open_tender", label: "Open Tender", description: "Competitive tender open to all qualified suppliers." },
  { value: "rfq", label: "Request for Quotation (RFQ)", description: "Quick quotation for lower-value procurement." },
  { value: "eoi", label: "Expression of Interest (EOI)", description: "Pre-screening to create a supplier pool." },
  { value: "prequalification", label: "Prequalification", description: "Pre-qualify suppliers for future tenders." },
  { value: "restricted", label: "Restricted Tender", description: "Invitation to selected pre-qualified suppliers." },
  { value: "direct", label: "Direct Procurement", description: "Single-source procurement (requires justification)." },
];

/** AGPO categories (Access to Government Procurement Opportunities). */
export const AGPO_CATEGORIES: { value: AgpoCategory; label: string }[] = [
  { value: "none", label: "Open to All" },
  { value: "youth", label: "Reserved: Youth" },
  { value: "women", label: "Reserved: Women" },
  { value: "pwd", label: "Reserved: Persons with Disabilities" },
  { value: "general", label: "General (AGPO)" },
];

/** Common procuring entities. */
export const PROCUREMENT_ENTITIES = [
  "Kenya Roads Board (KRB)",
  "Kenya National Highways Authority (KeNHA)",
  "Kenya Urban Roads Authority (KURA)",
  "Kenya Rural Roads Authority (KeRRA)",
  "Ministry of Health",
  "Ministry of Education",
  "Ministry of Water, Sanitation & Irrigation",
  "Ministry of Energy & Petroleum",
  "Ministry of Agriculture & Livestock Development",
  "Ministry of Defence",
  "Ministry of Interior & Coordination",
  "Kenya Power & Lighting Company (KPLC)",
  "Water Resources Authority (WRA)",
  "Coast Water Works Development Agency",
  "National Hospital Insurance Fund (NHIF)",
  "Kenya Medical Supplies Authority (KEMSA)",
  "Teachers Service Commission (TSC)",
  "Kenya Ports Authority (KPA)",
  "Kenya Airports Authority (KAA)",
  "National Environment Management Authority (NEMA)",
  "Public Service Commission (PSC)",
  "Independent Electoral and Boundaries Commission (IEBC)",
  "County Government of Nairobi",
  "County Government of Mombasa",
  "County Government of Kisumu",
  "County Government of Nakuru",
  "County Government of Kiambu",
  "Other / Private Entity",
] as const;

/** Format a publication type for display. */
export function formatPublicationType(type: TenderPublicationType): string {
  return PUBLICATION_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Format AGPO category for display. */
export function formatAgpo(cat: AgpoCategory): string {
  return AGPO_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}
