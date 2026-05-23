import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgePercent, ShieldCheck, Sparkles, Truck, WalletCards } from "lucide-react";

const categoryTiles = [
  {
    title: "Men",
    href: "/category/shoes",
    image:
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=500&q=80"
  },
  {
    title: "Women",
    href: "/category/shoes",
    image:
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=500&q=80"
  },
  {
    title: "Kids",
    href: "/shop",
    image:
      "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=500&q=80"
  },
  {
    title: "Watches",
    href: "/category/watches",
    image:
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=500&q=80"
  },
  {
    title: "Accessories",
    href: "/shop",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=500&q=80"
  }
];

export function Hero() {
  return (
    <section className="container pt-4">
      <div className="grid gap-3 border border-[#e3d7c7] bg-white p-3 shadow-sm md:grid-cols-5">
        {categoryTiles.map((category) => (
          <Link
            key={category.title}
            href={category.href}
            className="group flex items-center gap-3 p-2 transition hover:bg-[#f7f4ef] md:flex-col md:justify-center"
          >
            <span className="relative h-16 w-16 overflow-hidden rounded-full border border-[#e3d7c7] bg-[#f7f4ef] md:h-24 md:w-24">
              <Image
                src={category.image}
                alt={category.title}
                fill
                sizes="96px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </span>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#181510] group-hover:text-[#8a5a24]">
              {category.title}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Link
          href="/shop"
          className="group relative min-h-[430px] overflow-hidden border border-[#d6c6b2] bg-[#181510] text-white shadow-sm"
        >
          <Image
            src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1600&q=85"
            alt="Vrixo premium footwear collection"
            fill
            priority
            sizes="(min-width: 1024px) 72vw, 100vw"
            className="object-cover opacity-65 transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181510]/95 via-[#181510]/72 to-[#181510]/10" />
          <div className="relative flex min-h-[430px] max-w-2xl flex-col justify-center p-6 sm:p-12">
            <p className="inline-flex w-fit items-center gap-2 border border-white/30 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#f3d7a0]">
              <Sparkles className="h-4 w-4" />
              Vrixo Signature Edit
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-black uppercase leading-tight tracking-[0.05em] sm:text-6xl">
              Step into polished everyday style.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/80 sm:text-base">
              Curated footwear and watch drops with clean pricing, COD, and verified online payment.
            </p>
            <span className="mt-7 inline-flex w-fit items-center bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#181510] transition group-hover:bg-[#f3d7a0]">
              Shop now <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          </div>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <DealPanel
            href="/category/shoes"
            title="Occasion-ready shoes"
            offer="Formals, sneakers, sandals"
            image="https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=85"
          />
          <DealPanel
            href="/category/watches"
            title="Watch wardrobe"
            offer="Classic and smart styles"
            image="https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=700&q=80"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrustChip icon={Truck} title="Fast dispatch" text="1-3 day processing" />
        <TrustChip icon={WalletCards} title="Easy payments" text="COD and online payment" />
        <TrustChip icon={ShieldCheck} title="Secure shopping" text="Protected customer details" />
        <TrustChip icon={BadgePercent} title="Better prices" text="Coupons and daily deals" />
      </div>
    </section>
  );
}

function DealPanel({
  href,
  title,
  offer,
  image
}: {
  href: string;
  title: string;
  offer: string;
  image: string;
}) {
  return (
    <Link href={href} className="group relative min-h-[207px] overflow-hidden border border-[#e3d7c7] bg-white p-6 shadow-sm">
      <Image
        src={image}
        alt={title}
        fill
        sizes="320px"
        className="object-cover opacity-35 transition duration-500 group-hover:scale-105 group-hover:opacity-45"
      />
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5a24]">Curated edit</p>
        <h2 className="mt-2 max-w-[12rem] text-2xl font-black uppercase leading-tight text-[#181510]">{title}</h2>
        <p className="mt-2 text-sm font-bold text-[#b42318]">{offer}</p>
        <span className="mt-6 inline-flex border-b border-[#181510] pb-1 text-xs font-black uppercase tracking-[0.18em] text-[#181510]">
          Explore
        </span>
      </div>
    </Link>
  );
}

function TrustChip({
  icon: Icon,
  title,
  text
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 border border-[#e3d7c7] bg-white p-4 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f7f4ef] text-[#8a5a24]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-black uppercase tracking-[0.08em] text-[#181510]">{title}</p>
        <p className="text-xs text-[#6b6256]">{text}</p>
      </div>
    </div>
  );
}
