import { getAppUrl } from "@/lib/app-url";

export const metadata = {
  title: "About Vrixo | Vrixo",
  description:
    "Vrixo is a premium online shopping brand founded by Chavda Ravi, offering shoes, watches, and fashion products with a clean, trusted, and customer-friendly shopping experience in India.",
};

export default function AboutPage() {
  const appUrl = getAppUrl();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vrixo",
    alternateName: "Vrixo",
    url: appUrl,
    founder: {
      "@type": "Person",
      name: "Chavda Ravi",
    },
    description:
      "Vrixo is a premium online shopping brand for shoes, watches, and fashion products in India.",
  };

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#111827]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="rounded-3xl bg-white p-6 shadow-sm md:p-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#9b7a2f]">
            Vrixo
          </p>

          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
            About Vrixo
          </h1>

          <p className="mb-6 text-lg leading-8 text-gray-700">
            Vrixo is a premium online shopping brand built for customers who
            want quality, trust, and a smooth shopping experience without
            confusion. Our website, {appUrl}, focuses on stylish shoes,
            watches, and fashion products that are practical for everyday use
            and attractive for modern buyers.
          </p>

          <div className="mb-8 rounded-2xl border border-[#d6b766] bg-[#fff8df] p-5">
            <h2 className="mb-3 text-2xl font-bold text-[#111827]">
              Founder
            </h2>
            <p className="text-lg leading-8 text-gray-800">
              <strong>Vrixo was founded by Chavda Ravi</strong> with the
              vision of building a trusted online shopping brand for shoes,
              watches, and fashion products in India.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl bg-[#fafafa] p-5">
              <h2 className="mb-3 text-2xl font-bold">Our Story</h2>
              <p className="leading-7 text-gray-700">
                Vrixo started with a clear dream - to create an online
                shopping platform that feels premium, simple, and trustworthy.
                We are working to build a brand where customers can explore
                products, place orders easily, and feel confident about what
                they are buying.
              </p>
            </section>

            <section className="rounded-2xl bg-[#fafafa] p-5">
              <h2 className="mb-3 text-2xl font-bold">What We Offer</h2>
              <p className="leading-7 text-gray-700">
                At Vrixo, we focus on selected fashion and lifestyle products
                such as shoes, watches, men&apos;s fashion products, women&apos;s
                fashion products, new arrivals, and daily-use stylish products.
              </p>
            </section>

            <section className="rounded-2xl bg-[#fafafa] p-5">
              <h2 className="mb-3 text-2xl font-bold">Our Mission</h2>
              <p className="leading-7 text-gray-700">
                Our mission is to make Vrixo a trusted online shopping
                destination where customers can shop with confidence. We want to
                provide a clean website experience, simple navigation, easy
                checkout, and dependable order service.
              </p>
            </section>

            <section className="rounded-2xl bg-[#fafafa] p-5">
              <h2 className="mb-3 text-2xl font-bold">Our Vision</h2>
              <p className="leading-7 text-gray-700">
                Our vision is to grow Vrixo into a strong Indian e-commerce
                brand known for trust, quality, and customer satisfaction. We
                aim to build a shopping platform that feels premium, modern, and
                reliable for every customer.
              </p>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-black p-6 text-white">
            <h2 className="mb-4 text-2xl font-bold">Why Choose Vrixo?</h2>
            <ul className="grid list-disc gap-3 pl-5 text-gray-200 md:grid-cols-2">
              <li>Premium and clean shopping experience</li>
              <li>Easy product browsing</li>
              <li>Simple cart and checkout process</li>
              <li>Cash on Delivery and online payment options</li>
              <li>Clear product categories</li>
              <li>Customer-friendly order experience</li>
              <li>Focus on shoes, watches, and fashion products</li>
              <li>Built with a trust-first mindset</li>
            </ul>
          </section>

          <section className="mt-8 rounded-2xl border border-gray-200 p-6">
            <h2 className="mb-3 text-2xl font-bold">Our Promise</h2>
            <p className="leading-8 text-gray-700">
              At Vrixo, we are committed to improving every day. We want to
              provide better products, better service, and a better shopping
              experience for our customers. Vrixo is not just a shopping
              website. It is a growing brand built with ambition, hard work, and
              a clear vision for the future.
            </p>
          </section>

          <p className="mt-8 text-center text-lg font-semibold">
            Vrixo - Shop smart. Shop with trust.
          </p>

          <p className="mt-4 text-center text-sm text-gray-500">
            Copyright 2026 Vrixo. Founded by Chavda Ravi.
          </p>
        </div>
      </section>
    </main>
  );
}
