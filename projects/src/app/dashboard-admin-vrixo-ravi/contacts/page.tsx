import { AdminShell } from "@/components/admin/admin-shell";
import { ContactsAdminClient } from "@/components/admin/contacts-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Contacts");
export const dynamic = "force-dynamic";

export default async function AdminContactsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const contactsResult = await supabase
    .from("contact_messages")
    .select("id, name, email, phone, subject, message, status, created_at")
    .order("created_at", { ascending: false });
  const fallbackContactsResult = contactsResult.error
    ? await supabase
        .from("contact_messages")
        .select("id, name, email, phone, subject, message, created_at")
        .order("created_at", { ascending: false })
    : null;
  const contacts = contactsResult.data ?? fallbackContactsResult?.data ?? [];
  if (contactsResult.error) {
    console.error("CONTACT_MESSAGES_FETCH_ERROR:", contactsResult.error);
  }

  return (
    <AdminShell>
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Support Inbox</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Contact Messages</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Read customer requests and keep support clean.</p>
        </div>
      </section>
      <ContactsAdminClient contacts={contacts ?? []} />
    </AdminShell>
  );
}
