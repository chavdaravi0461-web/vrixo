"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Address } from "@/types/index";

export function ProfileForm({
  profile
}: {
  profile: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    addresses?: Address[];
  };
}) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(false);
  const [addressText, setAddressText] = useState(formatAddresses(profile.addresses ?? []));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setLoading(true);
      if (!configured) {
        throw new Error("Profile updates are temporarily unavailable. Please contact support.");
      }
      const supabase = createBrowserSupabaseClient();
      const addresses = buildAddressList(addressText, {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? "")
      });
      const { error } = await supabase
        .from("profiles")
        .update({
          name: String(formData.get("name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          addresses
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Profile updated successfully.");
      router.refresh();
    } catch (error) {
      toast.error(getProfileErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="rounded-[2rem] bg-white p-8 card-shadow" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <Input name="name" defaultValue={profile.name} />
        </Field>
        <Field label="Email">
          <Input value={profile.email ?? "No email saved"} disabled />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={profile.phone ?? ""} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Saved address">
          <Textarea
            value={addressText}
            placeholder="House number, street, area, city, state, postal code"
            onChange={(event) => setAddressText(event.target.value)}
          />
        </Field>
      </div>
      <Button className="mt-6" disabled={loading}>
        {loading ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

function formatAddresses(addresses: Address[]) {
  return addresses
    .map((address) =>
      [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country
      ]
        .filter(Boolean)
        .join(", ")
    )
    .join("\n");
}

function buildAddressList(value: string, customer: { name: string; phone: string }) {
  const line = value.trim();

  if (!line) {
    return [];
  }

  return [
    {
      id: "primary",
      fullName: customer.name,
      phone: customer.phone,
      line1: line,
      city: "",
      state: "",
      postalCode: "",
      country: "India"
    }
  ];
}

function getProfileErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Failed to update profile.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("supabase") || message.includes("json")) {
    return "Profile updates are temporarily unavailable. Please contact support.";
  }

  return error.message;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
