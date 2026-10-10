"use client";

import Image from "next/image";
import { useState } from "react";

const PARTNER_LOGOS = [
  { key: "city-science", src: "/logos/city-science-v2.png", alt: "City Science logo", label: "CITY SCIENCE" },
  { key: "mit-media-lab", src: "/logos/mit-media-lab-v2.png", alt: "MIT Media Lab logo", label: "MIT MEDIA LAB" },
] as const;

type Props = {
  className?: string;
};

export function PartnerLogosBanner({ className = "" }: Props) {
  const [missingLogos, setMissingLogos] = useState<Record<string, boolean>>({});

  return (
    <section
      className={`flex items-center gap-6 rounded-xl border border-white/15 bg-black px-5 py-3 shadow-xl ${className}`}
      aria-label="Partner logos"
    >
      {PARTNER_LOGOS.map((logo) =>
        missingLogos[logo.key] ? (
          <div
            key={logo.key}
            className="flex h-12 w-40 items-center justify-center text-[12px] tracking-wide text-zinc-400"
            title={`${logo.src} placeholder`}
          >
            {logo.label}
          </div>
        ) : (
          <div key={logo.key} className="relative flex h-12 w-40 items-center justify-center">
            <Image
              src={logo.src}
              alt={logo.alt}
              width={160}
              height={48}
              className="max-h-full max-w-full object-contain"
              onError={() => setMissingLogos((prev) => ({ ...prev, [logo.key]: true }))}
            />
            {logo.key === "city-science" ? <span className="absolute -right-3 h-10 w-px bg-white/20" /> : null}
          </div>
        ),
      )}
    </section>
  );
}
