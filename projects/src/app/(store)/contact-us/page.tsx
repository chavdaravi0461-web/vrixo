import { Mail, Monitor, Store, Timer } from "lucide-react";
import { ContactUsForm } from "@/components/store/contact-us-form";
import { buildMetadata } from "@/lib/metadata";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from "@/lib/constants";
import { BUSINESS_NAME, BUSINESS_WEBSITE, SUPPORT_TIMING } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Contact Us",
  "Contact Vrixo for order support, shipping questions, refunds, returns, cancellations, and product assistance."
);

export default function ContactUsPage() {
  const contactItems = [
    { icon: Store, label: "Business/Brand", value: BUSINESS_NAME },
    { icon: Mail, label: "Email", value: SUPPORT_EMAIL, href: SUPPORT_EMAIL_HREF },
    { icon: Timer, label: "Response time", value: "We usually respond within 24-48 hours." },
    { icon: Monitor, label: "Website", value: BUSINESS_WEBSITE, href: BUSINESS_WEBSITE },
    { icon: Timer, label: "Support hours", value: SUPPORT_TIMING }
  ];

  return (
    <section className="container mt-10">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Contact us</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-slate-950">Vrixo support</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Reach out for order support, shipping updates, returns, refunds, cancellations, product details, or payment assistance.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] bg-white p-6 card-shadow sm:p-8">
          <h2 className="font-serif text-2xl font-semibold text-slate-950">Business details</h2>
          <div className="mt-6 grid gap-4">
            {contactItems.map((item) => (
              <div key={item.label} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="mt-1 block break-words text-sm font-semibold text-slate-900 transition hover:text-teal-700"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ContactUsForm />
      </div>
    </section>
  );
}
