import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/constants";

export function Logo() {
  return (
    <Link href="/home" className="inline-flex items-center gap-3" aria-label={`${BRAND_NAME} home`}>
      <div className="dc-footer-logo-mark h-10 w-10">
        <Image
          src={BRAND_LOGO_PATH}
          alt=""
          width={900}
          height={240}
          className="dc-brand-logo-image"
        />
      </div>
      <span className="sr-only">{BRAND_NAME}</span>
    </Link>
  );
}
