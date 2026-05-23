import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="container py-24">
      <EmptyState
        title="Page not found"
        description="The page you requested does not exist or may have been moved."
        ctaLabel="Go home"
        ctaHref="/"
      />
    </div>
  );
}
