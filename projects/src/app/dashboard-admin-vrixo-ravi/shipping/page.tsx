import { AdminShell } from "@/components/admin/admin-shell";
import { ShippingSettingsClient } from "@/components/admin/shipping-settings-client";
import { requireAdmin } from "@/lib/auth";
import { buildMetadata } from "@/lib/metadata";
import { getShippingSettings } from "@/lib/shipping-settings";

export const metadata = buildMetadata("Admin Shipping");
export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  await requireAdmin();
  const settings = await getShippingSettings();

  return (
    <AdminShell>
      <ShippingSettingsClient settings={settings} />
    </AdminShell>
  );
}
