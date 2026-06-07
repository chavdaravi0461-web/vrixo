import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata(
  "Frequently Asked Questions",
  "Find answers to common questions about Vrixo — orders, shipping, payments, returns, account, and support."
);

const faqs = [
  {
    q: "How do I place an order on Vrixo?",
    a: "Browse our categories, add items to your cart, and proceed to checkout. You can place an order as a guest or log into your account for faster checkout."
  },
  {
    q: "What payment methods does Vrixo accept?",
    a: "We accept Cash on Delivery (COD), credit/debit cards, UPI, net banking, and other options through our secure Razorpay payment gateway."
  },
  {
    q: "Is Cash on Delivery (COD) available?",
    a: "Yes, COD is available for eligible locations. You can select it at checkout and pay cash when your order is delivered."
  },
  {
    q: "How long does delivery take?",
    a: "Delivery time depends on your location and product availability. We aim to process orders within 24 hours and provide tracking information once shipped."
  },
  {
    q: "What is the return and refund policy?",
    a: "We accept returns and process refunds as per our Refund/Return Policy. Please review the policy on our website for full details on eligibility, timelines, and process."
  },
  {
    q: "How long does a refund take?",
    a: "Once a return is approved, refunds are processed within 5–7 business days. The amount will be credited to your original payment method or bank account."
  },
  {
    q: "Can I cancel my order?",
    a: "Orders can be cancelled before they are shipped. Once shipped, cancellation may not be possible. Contact our support team for assistance."
  },
  {
    q: "How do I track my order?",
    a: "After your order is shipped, we send tracking details via email or SMS. You can also check your order status by logging into your Vrixo account."
  },
  {
    q: "Do I need to create an account to shop?",
    a: "No, you can checkout as a guest. However, creating an account gives you access to order history, faster checkout, and easier order tracking."
  },
  {
    q: "How can I contact Vrixo support?",
    a: "You can reach us through the Contact Us page on our website, or email us at support@vrixo.in. We usually respond within 24–48 hours."
  },
  {
    q: "Does Vrixo have a physical store?",
    a: "Vrixo is currently an online-only brand. We do not have a physical retail store at this time."
  },
  {
    q: "Are the products on Vrixo authentic and original?",
    a: "Yes, we source products from trusted suppliers and ensure quality checks. If you receive a damaged or incorrect item, please contact support immediately."
  },
  {
    q: "What should I do if I receive a damaged or wrong product?",
    a: "Contact our support team within 48 hours of delivery with your order number and photos. We will assist you with a replacement or refund."
  },
  {
    q: "Is my payment information secure?",
    a: "Yes, all payments on Vrixo are processed through Razorpay, a secure and PCI-compliant payment gateway. We do not store your card or bank details on our servers."
  },
  {
    q: "Does Vrixo ship internationally?",
    a: "Currently, Vrixo ships within India. International shipping is not available at this time."
  }
];

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] transition hover:border-[var(--dc-border-dark)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[var(--dc-heading)] font-semibold transition group-open:text-[var(--dc-primary)]">
        {q}
        <svg
          className="h-5 w-5 shrink-0 text-[var(--dc-muted)] transition group-open:rotate-180 group-open:text-[var(--dc-primary)]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="border-t border-[var(--dc-border)] px-6 py-5 text-[var(--dc-muted)] leading-7">
        {a}
      </div>
    </details>
  );
}

export default function FAQPage() {
  return (
    <section className="container mt-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--dc-primary)]">Vrixo</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[var(--dc-heading)]">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--dc-muted)]">
          Find quick answers to the most common questions about shopping on Vrixo.
        </p>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, index) => (
            <FAQItem key={index} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
