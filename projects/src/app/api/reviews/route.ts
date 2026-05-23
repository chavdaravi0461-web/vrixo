import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { serverError } from "@/lib/api-response";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return serverError("Reviews are temporarily unavailable.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Please login to submit a review." }, { status: 401 });
  }

  const body = (await request.json()) as {
    productId?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };

  if (!body.productId || !body.rating || Number(body.rating) < 1 || Number(body.rating) > 5 || !body.comment?.trim()) {
    return NextResponse.json({ message: "Review data is incomplete." }, { status: 400 });
  }

  const { error } = await supabase.from("product_reviews").upsert({
    product_id: body.productId,
    user_id: user.id,
    rating: body.rating,
    title: body.title ?? "",
    comment: body.comment.trim()
  });

  if (error) {
    return serverError("Review could not be submitted.");
  }

  return NextResponse.json({ message: "Review submitted for approval." });
}
