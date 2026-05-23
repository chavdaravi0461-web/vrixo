export type GameMode = "quick" | "coupon" | "daily";

export type RewardTier = {
  id: "none" | "dream5" | "dream10" | "rush15" | "freedel" | "special";
  minScore: number;
  label: string;
  codePrefix: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
};

export const rewardTiers: RewardTier[] = [
  {
    id: "special",
    minScore: 5000,
    label: "Special limited coupon",
    codePrefix: "RUSHVIP",
    discountType: "percentage",
    discountValue: 20,
    minOrderValue: 2999,
    maxDiscount: 1000
  },
  {
    id: "freedel",
    minScore: 3000,
    label: "Free Delivery",
    codePrefix: "FREEDEL",
    discountType: "free_delivery",
    discountValue: 0,
    minOrderValue: 799,
    maxDiscount: 99
  },
  {
    id: "rush15",
    minScore: 2000,
    label: "15% OFF",
    codePrefix: "RUSH15",
    discountType: "percentage",
    discountValue: 15,
    minOrderValue: 1999,
    maxDiscount: 700
  },
  {
    id: "dream10",
    minScore: 1000,
    label: "10% OFF",
    codePrefix: "DREAM10",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 1499,
    maxDiscount: 400
  },
  {
    id: "dream5",
    minScore: 500,
    label: "5% OFF",
    codePrefix: "DREAM5",
    discountType: "percentage",
    discountValue: 5,
    minOrderValue: 999,
    maxDiscount: 200
  }
];

export function getRewardTier(score: number) {
  return rewardTiers.find((tier) => score >= tier.minScore) ?? null;
}
