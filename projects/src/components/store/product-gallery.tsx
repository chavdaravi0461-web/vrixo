"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export function ProductGallery({
  images,
  title,
  colors = []
}: {
  images: string[];
  title: string;
  colors?: string[];
}) {
  const galleryImages = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const [selectedImage, setSelectedImage] = useState(galleryImages[0]);
  const activeImage = galleryImages.includes(selectedImage) ? selectedImage : galleryImages[0];

  if (!activeImage) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[104px_1fr]">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
        {galleryImages.map((image, index) => {
          const label = colors[index] ? `${colors[index]} image` : `Product image ${index + 1}`;
          const isActive = image === activeImage;

          return (
            <button
              key={image}
              type="button"
              aria-label={`Show ${label}`}
              aria-pressed={isActive}
              onClick={() => setSelectedImage(image)}
              className={`group rounded-[var(--dc-radius-md)] border bg-[var(--dc-cream)] p-1.5 text-left transition ${
                isActive ? "border-[var(--dc-gold)] shadow-sm" : "border-[var(--dc-border)] hover:border-[var(--dc-gold)]"
              }`}
            >
              <span className="relative block aspect-square overflow-hidden rounded-[calc(var(--dc-radius-md)-4px)]">
                <Image
                  src={image}
                  alt={label}
                  fill
                  sizes="112px"
                  loading="lazy"
                  quality={70}
                  className="object-contain p-1.5 transition duration-200 group-hover:scale-[1.02]"
                />
              </span>
              {colors[index] ? (
                <span className="mt-1 block truncate px-1 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dc-muted)]">
                  {colors[index]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        <div className="group relative aspect-square overflow-hidden rounded-[var(--dc-radius-lg)] border border-[var(--dc-border)] bg-[var(--dc-cream)]">
          <Image
            src={activeImage}
            alt={title}
            fill
            sizes="(min-width: 1024px) 48vw, 100vw"
            priority
            quality={82}
            className="object-contain p-4 transition duration-300 group-hover:scale-[1.035] sm:p-6"
          />
        </div>
        <a
          href={activeImage}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-bold text-[var(--dc-gold)] hover:text-[var(--dc-black)]"
        >
          View full image
        </a>
      </div>
    </div>
  );
}
