import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { AccountShell } from "@/components/store/account-shell";
import { buildMetadata } from "@/lib/metadata";
import { formatIndianMobileNumber } from "@/lib/phone";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata = buildMetadata("My Account");
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?next=%2Faccount");
  }

  const supabase = await createServerSupabaseClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total, order_status, created_at, items")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const totalOrders = orders?.length ?? 0;
  const totalSpent = (orders ?? []).reduce((sum, order) => sum + Number(order.total), 0);
  const latestOrder = orders?.[0] ?? null;

  return (
    <AccountShell current="/account" showLogout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#102f3f_48%,#0f766e_100%)] text-white shadow-[0_28px_80px_-32px_rgba(15,23,42,0.65)]">
          <div className="grid gap-6 p-8 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
                Vrixo account
              </p>
              <h1 className="mt-4 font-serif text-4xl font-semibold sm:text-5xl">
                {profile.name || "Vrixo customer"}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                Signed in with {profile.email ?? "your Vrixo account"} for faster checkout, saved profile access, and secure order tracking.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <StatCard label="Name" value={profile.name || "Not added"} />
                <StatCard
                  label="Mobile"
                  value={profile.phone ? formatIndianMobileNumber(profile.phone) : "Not added"}
                />
                <StatCard label="Orders" value={String(totalOrders)} />
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/12 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-100">
                Snapshot
              </p>
              <div className="mt-5 space-y-4">
                <SummaryRow label="Total spent" value={formatCurrency(totalSpent)} />
                <SummaryRow
                  label="Latest order"
                  value={latestOrder ? latestOrder.order_number : "No orders yet"}
                />
                <SummaryRow
                  label="Latest status"
                  value={latestOrder ? latestOrder.order_status : "Ready for your first order"}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/my-orders"
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  View all orders
                </Link>
                <Link
                  href="/shop"
                  className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            eyebrow="Profile"
            title={profile.name || "Customer profile"}
            description="Your Vrixo identity is linked to your email and password account."
          />
          <InfoCard
            eyebrow="Mobile"
            title={profile.phone ? formatIndianMobileNumber(profile.phone) : "Not added"}
            description="Use this number for order updates and support."
          />
          <InfoCard
            eyebrow="History"
            title={totalOrders > 0 ? `${totalOrders} order${totalOrders > 1 ? "s" : ""}` : "No orders yet"}
            description="Every placed order will appear here as soon as checkout is completed."
          />
        </section>

        <section className="rounded-[2rem] bg-white p-6 card-shadow sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                Recent orders
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950">
                Your latest purchases
              </h2>
            </div>
            <Link href="/my-orders" className="text-sm font-semibold text-teal-700">
              Open full order history
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {orders && orders.length > 0 ? (
              orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="rounded-[1.75rem] border border-slate-200 bg-slate-50/75 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {order.order_number}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        {order.order_status}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-slate-950">
                      {formatCurrency(Number(order.total))}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(
                      order.items as Array<{
                        title: string;
                        quantity: number;
                      }>
                    ).map((item, index) => (
                      <span
                        key={`${item.title}-${index}`}
                        className="rounded-full bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        {item.title} x {item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No orders yet"
                description="Your first Vrixo order will appear here right after checkout."
                ctaLabel="Start shopping"
                ctaHref="/shop"
              />
            )}
          </div>
        </section>
      </div>
    </AccountShell>
  );
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function InfoCard({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] bg-white p-6 card-shadow">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
