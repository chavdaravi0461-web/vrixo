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
      <div className="page-wrap">
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <Suspense fallback={<div className="h-[64px]" />}>
          <Header />
        </Suspense>
        <main id="main-content">{children}</main>
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
      <Link href="/home" className="mobile-nav-item" aria-label="Home">
        <Home className="h-[18px] w-[18px]" />
        <span>Home</span>
      </Link>
      <Link href="/shop" className="mobile-nav-item" aria-label="Shop">
        <ShoppingBag className="h-[18px] w-[18px]" />
        <span>Shop</span>
      </Link>
      <Link href="/wishlist" className="mobile-nav-item" aria-label="Wishlist">
        <Heart className="h-[18px] w-[18px]" />
        <span>Wishlist</span>
      </Link>
      <Link href="/account" className="mobile-nav-item" aria-label="Account">
        <User className="h-[18px] w-[18px]" />
        <span>Account</span>
      </Link>
    </nav>
  );
}
