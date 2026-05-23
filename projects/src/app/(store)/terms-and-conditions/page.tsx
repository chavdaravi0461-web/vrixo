import { InfoPage } from "@/components/store/info-page";
import { buildMetadata } from "@/lib/metadata";
import { termsAndConditions } from "@/lib/policy-content";

export const metadata = buildMetadata(
  "Terms & Conditions",
  "Read Vrixo's website terms, order acceptance conditions, customer responsibilities, payment verification, and lawful use requirements."
);

export default function TermsAndConditionsPage() {
  return <InfoPage title="Terms & Conditions" body={termsAndConditions} />;
}
