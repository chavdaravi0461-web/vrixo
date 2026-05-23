import Image from "next/image";
import Link from "next/link";
import { Mail, ShieldCheck, Truck } from "lucide-react";
import { BRAND_LOGO_PATH, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-20 bg-[var(--dc-black)] text-[#f8efe3]">
      <div className="dc-container py-14">
        <div className="dc-footer-brand-panel">
          <Image
            src={BRAND_LOGO_PATH}
            alt="Vrixo"
            width={900}
            height={240}
            className="dc-footer-brand-logo"
            sizes="(min-width: 1024px) 980px, calc(100vw - 32px)"
            priority={false}
          />
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-[1.35fr_repeat(3,1fr)]">
        <div>
          <Link href="/home" className="inline-flex items-center gap-3" aria-label="Vrixo home">
            <span className="dc-footer-logo-mark">
              <Image
                src={BRAND_LOGO_PATH}
                alt=""
                width={900}
                height={240}
                className="dc-brand-logo-image"
              />
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#c8b8a2]">
            Premium shoes and timeless watches with simple checkout, COD confidence,
            secure online payment, and dependable customer support.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-[#d9c7ad]">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--dc-gold-soft)]" />
              <span>
                Support:{" "}
                <a href={SUPPORT_EMAIL_HREF} className="transition hover:text-white">
                  {SUPPORT_EMAIL}
                </a>
              </span>
            </p>
            <p className="max-w-sm text-xs leading-5 text-[#a99a86]">
              Available for order help, delivery questions, returns, refunds, and general support.
            </p>
          </div>
        </div>
        <FooterColumn
          title="Shop"
          links={[
            { href: "/shop", label: "All Products" },
            { href: "/category/shoes", label: "Shoes" },
            { href: "/category/watches", label: "Watches" },
            { href: "/shop?sort=newest", label: "New Arrivals" },
            { href: "/wishlist", label: "Wishlist" }
          ]}
        />
        <FooterColumn
          title="Customer Care"
          links={[
            { href: "/faq", label: "FAQ" },
            { href: "/contact-us", label: "Contact Support" },
            { href: "/my-orders", label: "Track Orders" },
            { href: "/shipping-policy", label: "Shipping" },
            { href: "/refund-return-policy", label: "Returns" }
          ]}
        />
        <FooterColumn
          title="Policies"
          links={[
            { href: "/privacy-policy", label: "Privacy Policy" },
            { href: "/terms-and-conditions", label: "Terms & Conditions" },
            { href: "/refund-return-policy", label: "Refund Policy" },
            { href: "/cancellation-policy", label: "Cancellation Policy" }
          ]}
        />
        </div>
      </div>
      <div className="border-t border-[#2b241e]">
        <div className="dc-container flex flex-col gap-3 py-5 text-sm text-[#a99a86] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Vrixo. Founded by Chavda Ravi.</p>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-[var(--dc-gold-soft)]" />
              COD Available
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--dc-gold-soft)]" />
              Secure Payment
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-white">{title}</h3>
      <div className="mt-5 grid gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-[#c8b8a2] transition hover:text-white">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
