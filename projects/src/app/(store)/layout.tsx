import { StoreLayoutShell } from "@/components/store/store-layout-shell";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <StoreLayoutShell>{children}</StoreLayoutShell>;
}
