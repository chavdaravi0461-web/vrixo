"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-2", className)}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);

          const response = await fetch("/api/auth/logout", {
            method: "POST"
          });

          if (!response.ok) {
            throw new Error("Logout failed. Please try again.");
          }

          router.push("/login");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Logout failed.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}
