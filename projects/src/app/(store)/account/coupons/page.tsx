import Link from "next/link";
import { AccountShell } from "@/components/store/account-shell";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/metadata";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = buildMetadata("My Coupons");
export const dynamic = "force-dynamic";

export default async function AccountCouponsPage() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <AccountShell current="/account/coupons" showLogout>
      <section className="border border-[var(--dc-border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--dc-gold)]">Rewards</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.04em] text-[var(--dc-black)]">My Coupons</h1>
          </div>
          <Link href="/shop">
            <Button>Shop eligible products</Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-4">
          {coupons?.length ? (
            coupons.map((coupon) => (
              <div key={coupon.id} className="border border-[var(--dc-border)] bg-[var(--dc-cream)] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black tracking-wide text-[var(--dc-black)]">{coupon.code}</p>
                    <p className="mt-1 text-sm text-[var(--dc-muted)]">{coupon.description}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--dc-muted)]">
                      {coupon.used ? "Used" : "Unused"} · Valid till{" "}
                      {new Date(coupon.expires_at ?? coupon.ends_at ?? coupon.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Link href="/cart">
                    <Button variant="secondary">Use in cart</Button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-dashed border-[var(--dc-border-dark)] p-8 text-center">
              <h2 className="text-xl font-black uppercase tracking-[0.04em] text-[var(--dc-black)]">No coupons yet</h2>
              <p className="mt-2 text-sm text-[var(--dc-muted)]">New Vrixo offers will appear here when available.</p>
            </div>
          )}
        </div>
      </section>
    </AccountShell>
  );
}
