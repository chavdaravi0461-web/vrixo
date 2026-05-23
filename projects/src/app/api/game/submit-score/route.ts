import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { getRewardTier } from "@/game/utils/rewardTiers";
import { validateGameScore } from "@/game/utils/antiCheat";
import type { GameMode } from "@/game/utils/rewardTiers";

type SubmitScoreBody = {
  score?: number;
  durationSeconds?: number;
  collectedItems?: number;
  obstaclesHit?: number;
  sessionId?: string;
  mode?: GameMode;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SubmitScoreBody | null;

  if (!body) {
    return NextResponse.json({ message: "Invalid game payload." }, { status: 400 });
  }

  if (!isSupabaseConfigured() || !hasServerSupabaseAdminEnv()) {
    return NextResponse.json(
      { message: "Game rewards are temporarily unavailable." },
      { status: 503 }
    );
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  const sessionId = String(body.sessionId ?? "");
  const mode = body.mode ?? "coupon";
  const validation = validateGameScore({
    score: Number(body.score ?? 0),
    durationSeconds: Number(body.durationSeconds ?? 0),
    collectedItems: Number(body.collectedItems ?? 0),
    obstaclesHit: Number(body.obstaclesHit ?? 0),
    sessionId,
    mode
  });
  const admin = createAdminClient();
  const tier = validation.valid ? getRewardTier(validation.normalized.score) : null;
  const rewardDate = new Date().toISOString().slice(0, 10);

  if (mode === "daily" && user) {
    const { data: existingDaily } = await admin
      .from("daily_game_rewards")
      .select("id")
      .eq("user_id", user.id)
      .eq("reward_date", rewardDate)
      .maybeSingle();

    if (existingDaily) {
      return NextResponse.json(
        { message: "Daily reward already claimed. Try again tomorrow." },
        { status: 429 }
      );
    }
  }

  const cooldownSince = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentCoupon } = await admin
    .from("coupons")
    .select("id")
    .eq("source", "game")
    .gte("created_at", cooldownSince)
    .or(user ? `user_id.eq.${user.id}` : `session_id.eq.${sessionId}`)
    .limit(1)
    .maybeSingle();

  const canReward = validation.valid && tier && !recentCoupon;
  let coupon = null as
    | {
        id: string;
        code: string;
        discount_type: string;
        discount_value: number;
        min_order_value: number;
        max_discount: number | null;
        expires_at: string;
      }
    | null;

  if (canReward && tier) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const code = `${tier.codePrefix}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const { data, error } = await admin
      .from("coupons")
      .insert({
        user_id: user?.id ?? null,
        session_id: user ? null : sessionId,
        code,
        description: `Vrixo Delivery Rush reward - ${tier.label}`,
        discount_type: tier.discountType,
        discount_value: tier.discountValue,
        min_order_amount: tier.minOrderValue,
        min_order_value: tier.minOrderValue,
        max_discount: tier.maxDiscount,
        active: true,
        used: false,
        source: "game",
        expires_at: expiresAt,
        ends_at: expiresAt
      })
      .select("id, code, discount_type, discount_value, min_order_value, max_discount, expires_at")
      .single();

    if (!error && data) {
      coupon = data as typeof coupon;

      if (mode === "daily" && user) {
        await admin.from("daily_game_rewards").insert({
          user_id: user.id,
          reward_date: rewardDate,
          coupon_id: data.id
        });
      }
    }
  }

  await admin.from("game_sessions").insert({
    user_id: user?.id ?? null,
    session_id: sessionId,
    mode,
    score: validation.normalized.score,
    duration_seconds: validation.normalized.durationSeconds,
    collected_items: validation.normalized.collectedItems,
    obstacles_hit: validation.normalized.obstaclesHit,
    reward_tier: tier?.id ?? "none",
    coupon_id: coupon?.id ?? null,
    is_valid: validation.valid,
    invalid_reason: validation.errors.join(" ")
  });

  if (!validation.valid) {
    return NextResponse.json({ message: validation.errors[0] ?? "Score rejected." }, { status: 400 });
  }

  if (!tier) {
    return NextResponse.json({
      message: "Score saved. Reach 500 points to unlock a coupon.",
      reward: null
    });
  }

  if (recentCoupon) {
    return NextResponse.json(
      { message: "Reward cooldown active. Play again later.", reward: null },
      { status: 429 }
    );
  }

  if (!coupon) {
    return NextResponse.json(
      { message: "Score saved, but coupon could not be generated." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Coupon unlocked.",
    reward: {
      tier: tier.id,
      label: tier.label,
      ...coupon
    }
  });
}
