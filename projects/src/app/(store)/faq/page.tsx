import { buildMetadata } from "@/lib/metadata";
import { InfoPage } from "@/components/store/info-page";

export const metadata = buildMetadata("FAQ");

export default function FAQPage() {
  return <InfoPage title="Frequently Asked Questions" body="Vrixo supports secure account login, Cash on Delivery, online payment when available, order tracking, and account-based order history. Your order is confirmed after product availability and delivery details are checked." />;
}
