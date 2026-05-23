import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BrainCircuit,
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
  Star,
  TicketPercent,
  Truck,
  Users
} from "lucide-react";
import { BRAND_LOGO_PATH } from "@/lib/constants";

const links = [
  { href: "/dashboard-admin-dreamcart-ravi", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard-admin-dreamcart-ravi/products", label: "Products", icon: Package },
  { href: "/dashboard-admin-dreamcart-ravi/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard-admin-dreamcart-ravi/shipping", label: "Shipping", icon: Truck },
  { href: "/dashboard-admin-dreamcart-ravi/game", label: "Game Rewards", icon: Gamepad2 },
  { href: "/dashboard-admin-dreamcart-ravi/accounts", label: "Accounts", icon: Users },
  { href: "/dashboard-admin-dreamcart-ravi/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard-admin-dreamcart-ravi/contacts", label: "Contacts", icon: MessageSquare },
  { href: "/dashboard-admin-dreamcart-ravi/newsletter", label: "Newsletter", icon: Mail },
  { href: "/dashboard-admin-dreamcart-ravi/users", label: "Users", icon: Users },
  { href: "/dashboard-admin-dreamcart-ravi/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/dashboard-admin-dreamcart-ravi/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard-admin-dreamcart-ravi/enterprise", label: "Enterprise", icon: BrainCircuit }
];

export function AdminShell({
  current,
  children
}: {
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-page">
      <div className="admin-shell grid min-h-screen lg:grid-cols-[292px_1fr]">
        <aside className="admin-sidebar px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-7">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/10">
            <Link href="/dashboard-admin-dreamcart-ravi" className="flex items-center gap-3" aria-label="Vrixo admin dashboard">
              <span className="grid h-14 w-28 place-items-center overflow-hidden rounded-2xl border border-amber-200/20 bg-black/40 px-2">
                <Image
                  src={BRAND_LOGO_PATH}
                  alt=""
                  width={1254}
                  height={647}
                  className="h-auto w-full"
                />
              </span>
              <span>
                <strong className="block text-xl font-black leading-none text-white">Vrixo</strong>
                <small className="mt-1 block text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/80">
                  Owner Panel
                </small>
              </span>
            </Link>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Secure admin</span>
            </div>
          </div>
          <nav className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1" aria-label="Admin navigation">
            {links.map((link) => {
              const Icon = link.icon;
              const active = current === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition lg:px-4 ${
                    active
                      ? "bg-white text-slate-950 shadow-lg shadow-black/10"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Vrixo</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage catalog, orders, customers, shipping, reviews, and growth signals from one protected workspace.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              View store <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
        <main className="min-w-0 p-4 md:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
