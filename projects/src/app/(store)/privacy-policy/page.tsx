import { buildMetadata } from "@/lib/metadata";
import { InfoPage } from "@/components/store/info-page";
import { privacyPolicy } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Privacy Policy",
  "Read how Vrixo collects, uses, protects, and shares customer information for order fulfilment, payments, delivery, and support."
);

export default function PrivacyPolicyPage() {
  return <InfoPage title="Privacy Policy" body={privacyPolicy} />;
}
