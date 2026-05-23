import { InfoPage } from "@/components/store/info-page";
import { buildMetadata } from "@/lib/metadata";
import { refundReturnPolicy } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Refund / Return Policy",
  "Read Vrixo's refund and return eligibility, 7-day return window, product condition requirements, and refund timelines."
);

export default function RefundReturnPolicyPage() {
  return <InfoPage title="Refund / Return Policy" body={refundReturnPolicy} />;
}
