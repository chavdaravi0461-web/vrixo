"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShoppingBag, Heart, Search, PackageSearch, ArrowRight } from "lucide-react";

interface EmptyState {
  icon: "cart" | "wishlist" | "search" | "orders";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const emptyStates: Record<EmptyState["icon"], Omit<EmptyState, "icon">> = {
  cart: {
    title: "Your cart awaits inspiration",
    description: "Every great collection starts with a single piece. Browse our curated selection and find something extraordinary.",
    actionLabel: "Explore Collection",
    actionHref: "/shop",
  },
  wishlist: {
    title: "Nothing saved yet",
    description: "Save your favorites and build your dream collection. Tap the heart on any product to begin.",
    actionLabel: "Discover Products",
    actionHref: "/shop",
  },
  search: {
    title: "What are you looking for?",
    description: "Search across our entire collection. Try \"premium watches\" or \"handcrafted shoes\".",
    actionLabel: "Browse All",
    actionHref: "/shop",
  },
  orders: {
    title: "No orders yet",
    description: "Your journey starts here. Place your first order and experience premium craftsmanship delivered to your door.",
    actionLabel: "Start Shopping",
    actionHref: "/shop",
  },
};

const iconMap = {
  cart: ShoppingBag,
  wishlist: Heart,
  search: Search,
  orders: PackageSearch,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function IntelligentEmptyState({ type }: { type: EmptyState["icon"] }) {
  const state = emptyStates[type];
  const Icon = iconMap[type];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center"
    >
      <motion.div
        variants={itemVariants}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{
          background: "var(--lp-glass)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--lp-glass-border)",
        }}
      >
        <Icon className="h-8 w-8" style={{ color: "var(--lp-text-secondary)" }} strokeWidth={1.2} />
      </motion.div>

      <motion.h2 variants={itemVariants} className="lp-heading-2 mb-3">
        {state.title}
      </motion.h2>

      <motion.p variants={itemVariants} className="lp-body mb-8" style={{ color: "var(--lp-text-secondary)" }}>
        {state.description}
      </motion.p>

      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row">
        <Link href={state.actionHref} className="lp-btn lp-btn-primary">
          {state.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {state.secondaryLabel && state.secondaryHref && (
          <Link href={state.secondaryHref} className="lp-btn lp-btn-secondary">
            {state.secondaryLabel}
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}
