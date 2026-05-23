import { Suspense } from "react";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { CustomerAuthPrompt } from "@/components/store/customer-auth-prompt";
import { AiSupportWidget } from "@/components/store/ai-support-widget";

export function StoreLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerAuthPrompt />
      <Suspense fallback={<div className="h-[89px] border-b border-white/60 bg-white/80" />}>
        <Header />
      </Suspense>
      <main>{children}</main>
      <Footer />
      <AiSupportWidget />
    </>
  );
}
