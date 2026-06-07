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
    <footer className="dc-footer-luxe">
      <div className="dc-container">
        {/* Brand Strip */}
        <div className="dc-footer-luxe-brand">
          <span>Vrixo</span>
          <small>Since 2025</small>
        </div>

        {/* Main Grid */}
        <div className="dc-footer-luxe-grid">
          <div className="dc-footer-luxe-col">
            <p>
              Premium shoes and timeless watches. Every piece selected for those who recognise the extraordinary.
            </p>
            <div className="dc-footer-luxe-contact">
              <Mail />
              <a href={SUPPORT_EMAIL_HREF}>{SUPPORT_EMAIL}</a>
            </div>
            <div className="dc-footer-luxe-trust">
              <span><Truck /> Free COD</span>
              <span><Shield /> Secure Payment</span>
              <span><Repeat /> 7-Day Return</span>
              <span><Clock /> Same Day Dispatch</span>
            </div>
          </div>
          <FooterColumn title="Shop" links={footerLinks.shop} />
          <FooterColumn title="Support" links={footerLinks.support} />
          <FooterColumn title="Policies" links={footerLinks.policies} />
        </div>

        {/* Bottom Bar */}
        <div className="dc-footer-luxe-bottom">
          <p>Luxury in every detail — <strong>Vrixo</strong> &copy;2025 to 2026</p>
          <div className="dc-footer-luxe-bottom-links">
            <Link href="/terms-and-conditions">Terms</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/shipping-policy">Shipping</Link>
            <Link href="/refund-return-policy">Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div className="dc-footer-luxe-col">
      <h4>{title}</h4>
      {links.map((l) => (
        <Link key={l.href} href={l.href}>{l.label}</Link>
      ))}
    </div>
  );
}
