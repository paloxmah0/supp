import { useState } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  Edit3,
  Mail,
  MapPin,
  Plus,
  Save,
  Trash2,
  Wallet,
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
import type { PortfolioItem, Registration } from "@/lib/types";

export default function Portfolio() {
  const { toast } = useToast();
  const { wallet, registrations } = useTenderHub();
  const session = wallet.session;

  const [editingProfile, setEditingProfile] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);

  useSeoMeta({
    title: "Portfolio — TenderHub",
    description: "Manage your portfolio and profile.",
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

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">My Portfolio</h1>

        {/* Profile card */}
        <Card className="mb-6">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Profile</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingProfile(!editingProfile)}
              className="gap-2"
            >
              <Edit3 className="size-4" />
              {editingProfile ? "Cancel" : "Edit"}
            </Button>
          </CardHeader>
          <CardContent>
            {editingProfile ? (
              <ProfileEditor
                registration={registration}
                onSave={(updates) => {
                  registrations.updateRegistration(session.address, updates);
                  setEditingProfile(false);
                  toast({ title: "Profile updated" });
                }}
              />
            ) : (
              <ProfileView registration={registration} />
            )}
          </CardContent>
        </Card>

        {/* Verification status */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-blue-600" />
                  <span className="font-medium">KYC</span>
                </div>
                <StatusBadge status={registration.kyc.status} />
              </div>
              <div className="space-y-1.5 text-sm">
                {registration.kyc.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-muted-foreground">
                    <span className="truncate">{doc.label}</span>
                  </div>
                ))}
                {registration.kyc.documents.length === 0 && (
                  <p className="text-muted-foreground">No documents submitted.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-blue-600" />
                  <span className="font-medium">ISO Certifications</span>
                </div>
                <StatusBadge status={registration.iso.status} />
              </div>
              <div className="space-y-1.5 text-sm">
                {registration.iso.certifications.map((cert) => (
                  <div key={cert.id} className="text-muted-foreground">
                    <span>{cert.standard}</span>
                    <span className="text-xs block ml-3">· {cert.certifyingBody} ({cert.certificateNumber})</span>
                  </div>
                ))}
                {registration.iso.certifications.length === 0 && (
                  <p className="text-muted-foreground">No certifications added.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio items */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Portfolio Items ({registration.portfolio.length})</CardTitle>
            <Button size="sm" className="gap-2" onClick={() => { setEditItem(null); setShowAddItem(true); }}>
              <Plus className="size-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {registration.portfolio.length === 0 && !showAddItem ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Building2 className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No portfolio items yet. Add your past projects to stand out.
                </p>
              </div>
            ) : (
              registration.portfolio.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{item.title}</h4>
                      {item.client && (
                        <p className="text-sm text-muted-foreground">Client: {item.client}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.valueAda && <span className="font-medium text-blue-600">{item.valueAda.toLocaleString()} ₳</span>}
                        {item.completedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(item.completedDate).toLocaleDateString()}
                          </span>
                        )}
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setEditItem(item); setShowAddItem(true); }}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          registrations.removePortfolioItem(session.address, item.id);
                          toast({ title: "Item removed" });
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {showAddItem && (
              <PortfolioItemForm
                existing={editItem}
                onAdd={(item) => {
                  if (editItem) {
                    registrations.updatePortfolioItem(session.address, editItem.id, item);
                  } else {
                    registrations.addPortfolioItem(session.address, item);
                  }
                  setShowAddItem(false);
                  setEditItem(null);
                  toast({ title: editItem ? "Item updated" : "Item added" });
                }}
                onCancel={() => { setShowAddItem(false); setEditItem(null); }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function ProfileView({ registration }: { registration: Registration }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Building2 className="size-6" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-base">{registration.name}</div>
          <div className="text-muted-foreground">{registration.industry}</div>
        </div>
        <Badge variant="secondary" className="capitalize">{registration.role}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <span>{registration.email}</span>
        </div>
        {registration.phone && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Phone:</span>
            <span>{registration.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <span>{registration.city}, {registration.country}</span>
        </div>
        {registration.website && (
          <a href={registration.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
            {registration.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
      {registration.description && (
        <p className="pt-2 border-t text-muted-foreground">{registration.description}</p>
      )}
    </div>
  );
}

function ProfileEditor({
  registration,
  onSave,
}: {
  registration: Registration;
  onSave: (updates: Partial<Registration>) => void;
}) {
  const [form, setForm] = useState({
    name: registration.name,
    email: registration.email,
    phone: registration.phone ?? "",
    description: registration.description,
    industry: registration.industry,
    country: registration.country,
    city: registration.city,
    website: registration.website ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Industry</Label>
          <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Website</Label>
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
      <Button
        className="gap-2"
        onClick={() => onSave({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          description: form.description,
          industry: form.industry,
          country: form.country,
          city: form.city,
          website: form.website || undefined,
        })}
      >
        <Save className="size-4" />
        Save Changes
      </Button>
    </div>
  );
}

function PortfolioItemForm({
  existing,
  onAdd,
  onCancel,
}: {
  existing: PortfolioItem | null;
  onAdd: (item: Omit<PortfolioItem, "id">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    client: existing?.client ?? "",
    valueAda: existing?.valueAda?.toString() ?? "",
    completedDate: existing?.completedDate ?? "",
    tags: existing?.tags.join(", ") ?? "",
  });

  return (
    <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{existing ? "Edit Item" : "New Portfolio Item"}</span>
        <Button variant="ghost" size="icon-sm" onClick={onCancel}><X className="size-4" /></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Construction of Thika Superhighway Bridge" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Client</Label>
          <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="e.g. Kenya National Highways Authority (KeNHA)" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Value (ADA)</Label>
          <Input type="number" value={form.valueAda} onChange={(e) => setForm({ ...form, valueAda: e.target.value })} placeholder="e.g. 250000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Completed Date</Label>
          <Input type="date" value={form.completedDate} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tags (comma-separated)</Label>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. road-construction, bridges, infrastructure" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Description *</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Designed and constructed a 4-lane flyover bridge (1.2km) including drainage systems, street lighting, and safety barriers. Completed on time and within budget." />
        </div>
      </div>
      <Button
        className="w-full gap-2"
        disabled={!form.title || !form.description}
        onClick={() => {
          onAdd({
            title: form.title,
            description: form.description,
            client: form.client || undefined,
            valueAda: form.valueAda ? parseInt(form.valueAda, 10) : undefined,
            completedDate: form.completedDate || undefined,
            tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          });
        }}
      >
        <Save className="size-4" />
        {existing ? "Update Item" : "Add Item"}
      </Button>
    </div>
  );
}
