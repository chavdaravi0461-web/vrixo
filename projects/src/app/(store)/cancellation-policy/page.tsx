import { InfoPage } from "@/components/store/info-page";
import { buildMetadata } from "@/lib/metadata";
import { cancellationPolicy } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Cancellation Policy",
  "Read Vrixo's order cancellation conditions, prepaid refund process, and reasons an order may be cancelled."
);

export default function CancellationPolicyPage() {
  return <InfoPage title="Cancellation Policy" body={cancellationPolicy} />;
}
