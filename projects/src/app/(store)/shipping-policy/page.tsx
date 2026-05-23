import { InfoPage } from "@/components/store/info-page";
import { buildMetadata } from "@/lib/metadata";
import { shippingPolicy } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Shipping Policy",
  "Read Vrixo's shipping timelines, delivery conditions, COD instructions, and tracking information for orders across serviceable locations in India."
);

export default function ShippingPolicyPage() {
  return (
    <InfoPage
      title="Shipping Policy"
      body={shippingPolicy}
    />
  );
}
