import { Suspense } from "react";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { LoadingScreen } from "@/components/store/loading-screen";
import { BackgroundEffects } from "@/components/store/background-effects";
import { AIFab } from "@/components/store/ai-fab";
import { Home, ShoppingBag, Heart, User } from "lucide-react";
import Link from "next/link";

export function StoreLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <LoadingScreen>
      <BackgroundEffects />
      <div className="page-wrap">
        <Suspense fallback={<div className="h-[64px]" />}>
          <Header />
        </Suspense>
        <main>{children}</main>
      </div>
      <MobileNav />
      <AIFab />
      <Footer />
    </LoadingScreen>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link href="/home" className="mobile-nav-item">
        <Home className="h-[18px] w-[18px]" />
        Home
      </Link>
      <Link href="/shop" className="mobile-nav-item">
        <ShoppingBag className="h-[18px] w-[18px]" />
        Shop
      </Link>
      <Link href="/wishlist" className="mobile-nav-item">
        <Heart className="h-[18px] w-[18px]" />
        Wishlist
      </Link>
      <Link href="/account" className="mobile-nav-item">
        <User className="h-[18px] w-[18px]" />
        Account
      </Link>
    </nav>
  );
}
