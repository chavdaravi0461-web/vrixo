import { Loader2 } from "lucide-react";

export default function OrderSuccessLoading() {
  return (
    <section className="container py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-[2rem] bg-white p-10 text-center card-shadow">
        <Loader2 className="h-10 w-10 animate-spin text-teal-700" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
          Loading order confirmation
        </p>
        <p className="mt-2 text-slate-600">Please wait while we secure your order details.</p>
      </div>
    </section>
  );
}
