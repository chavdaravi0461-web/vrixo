"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ContactUsValues = {
  name: string;
  contact: string;
  subject: string;
  message: string;
};

const initialValues: ContactUsValues = {
  name: "",
  contact: "",
  subject: "",
  message: ""
};

export function ContactUsForm() {
  const [values, setValues] = useState<ContactUsValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  function updateValue(field: keyof ContactUsValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        console.error("Contact form API error:", { status: response.status, payload });
        throw new Error(payload?.message ?? "Message could not be sent.");
      }

      toast.success("Message sent successfully.");
      setValues(initialValues);
    } catch (error) {
      console.error("Contact form submit error:", error);
      toast.error(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="rounded-[2rem] bg-[var(--dc-surface)] p-6 card-shadow sm:p-8" onSubmit={submitForm}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email / Mobile">
          <Input
            value={values.contact}
            onChange={(event) => updateValue("contact", event.target.value)}
            autoComplete="email tel"
            required
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Subject">
          <Input
            value={values.subject}
            onChange={(event) => updateValue("subject", event.target.value)}
            required
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Message">
          <Textarea
            value={values.message}
            onChange={(event) => updateValue("message", event.target.value)}
            required
          />
        </Field>
      </div>
      <Button type="submit" className="mt-6" disabled={submitting}>
        {submitting ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--dc-text)]">{label}</span>
      {children}
    </label>
  );
}
