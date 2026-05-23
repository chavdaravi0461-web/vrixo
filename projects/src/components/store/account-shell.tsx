import Link from "next/link";
import { LogoutButton } from "@/components/store/logout-button";
import { cn } from "@/lib/utils";

const accountLinks = [
  { href: "/account", label: "Overview" },
  { href: "/profile", label: "Profile" },
  { href: "/my-orders", label: "My Orders" },
  { href: "/account/coupons", label: "My Coupons" },
  { href: "/wishlist", label: "Wishlist" }
];

export function AccountShell({
  current,
  showLogout = false,
  children
}: {
  current: string;
  showLogout?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="container mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[2rem] bg-white p-5 card-shadow">
        <h2 className="font-serif text-2xl font-semibold text-slate-950">My Account</h2>
        <nav className="mt-5 grid gap-2">
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                current === link.href ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {showLogout ? <LogoutButton className="mt-5 w-full justify-center" /> : null}
      </aside>
      <div>{children}</div>
    </div>
  );
}
