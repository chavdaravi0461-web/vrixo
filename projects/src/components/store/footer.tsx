"use client";

import Link from "next/link";
import { Mail, Truck, Shield, Repeat, Clock } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from "@/lib/constants";

const footerLinks = {
  shop: [
    { href: "/shop", label: "All Products" },
    { href: "/category/shoes", label: "Shoes" },
    { href: "/category/watches", label: "Watches" },
    { href: "/shop?sort=newest", label: "New Arrivals" },
    { href: "/wishlist", label: "Wishlist" },
  ],
  support: [
    { href: "/faq", label: "FAQ" },
    { href: "/contact-us", label: "Contact" },
    { href: "/my-orders", label: "Track Order" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/refund-return-policy", label: "Returns & Refunds" },
  ],
  policies: [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms-and-conditions", label: "Terms" },
    { href: "/cancellation-policy", label: "Cancellation" },
  ],
};

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <span className="display-md" style={{ color: "var(--text)" }}>Vrixo</span>
            <p className="footer-brand-desc">
              Premium shoes and timeless watches. Every piece selected for those who recognise the extraordinary.
            </p>
            <div className="flex items-center gap-2 mt-4 body-sm">
              <Mail className="h-3.5 w-3.5" />
              <a href={SUPPORT_EMAIL_HREF} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>{SUPPORT_EMAIL}</a>
            </div>
            <div className="flex flex-wrap gap-4 mt-4 body-sm" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Free COD</span>
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Secure Payment</span>
              <span className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> 7-Day Return</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Same Day Dispatch</span>
            </div>
          </div>
          <FooterColumn title="Shop" links={footerLinks.shop} />
          <FooterColumn title="Support" links={footerLinks.support} />
          <FooterColumn title="Policies" links={footerLinks.policies} />
        </div>

        <div className="footer-bottom">
          <p>Luxury in every detail — <strong>Vrixo</strong> &copy;2025 to {new Date().getFullYear()}</p>
          <div className="flex gap-4">
            <Link href="/terms-and-conditions" className="footer-link">Terms</Link>
            <Link href="/privacy-policy" className="footer-link">Privacy</Link>
            <Link href="/shipping-policy" className="footer-link">Shipping</Link>
            <Link href="/refund-return-policy" className="footer-link">Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h4 className="footer-col-title">{title}</h4>
      <div className="footer-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="footer-link">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
