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
    <AdminShell current="/dashboard-admin-dreamcart-ravi/contacts">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Support inbox</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Contact messages</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Read customer requests, mark handled messages, and keep support follow-up clean.
          </p>
        </div>
      </section>
      <ContactsAdminClient contacts={contacts ?? []} />
    </AdminShell>
  );
}
