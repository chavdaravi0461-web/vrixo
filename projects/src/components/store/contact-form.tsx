"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema } from "@/lib/validations";
import type { z } from "zod";

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema)
  });

  return (
    <form
      className="rounded-[2rem] bg-white p-8 card-shadow"
      onSubmit={handleSubmit(async (values) => {
        try {
          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values)
          });
          const payload = await response.json().catch(() => ({ message: "Invalid server response." }));
          if (!response.ok) {
            toast.error(payload.message ?? "Failed to send message.");
            return;
          }
          toast.success("Message sent successfully.");
          reset();
        } catch {
          toast.error("Network error. Please check your connection.");
        }
      })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" error={errors.name?.message}>
          <Input {...register("name")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>
        <Field label="Subject" error={errors.subject?.message}>
          <Input {...register("subject")} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Message" error={errors.message?.message}>
          <Textarea {...register("message")} />
        </Field>
      </div>
      <Button type="submit" className="mt-6" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}
