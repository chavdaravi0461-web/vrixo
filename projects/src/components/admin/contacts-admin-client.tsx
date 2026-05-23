"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AdminContact = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status?: string | null;
  created_at: string;
};

export function ContactsAdminClient({ contacts }: { contacts: AdminContact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">No contact messages yet</p>
      </div>
    );
  }

  async function updateStatus(id: string, status: "read" | "resolved") {
    const response = await fetch(`/api/admin/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Contact update failed:", payload);
      toast.error(payload?.message ?? "Contact update failed.");
      return;
    }

    toast.success("Contact updated.");
    location.reload();
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact) => (
        <div key={contact.id} className="admin-card p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {contact.status ?? "new"} / {new Date(contact.created_at).toLocaleString("en-IN")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">{contact.subject}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {contact.name} / {contact.email} {contact.phone ? `/ ${contact.phone}` : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{contact.message}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="rounded-2xl" onClick={() => updateStatus(contact.id, "read")}>
                Mark read
              </Button>
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => updateStatus(contact.id, "resolved")}>
                Resolve
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
