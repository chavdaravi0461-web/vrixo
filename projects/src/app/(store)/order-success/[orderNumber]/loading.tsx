import { Loader2 } from "lucide-react";

export default function OrderSuccessLoading() {
  return (
    <section className="section" style={{ paddingTop: "60px" }}>
      <div className="container">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="body-sm" style={{ marginTop: "12px" }}>Loading order confirmation</p>
        </div>
      </div>
    </section>
  );
}
