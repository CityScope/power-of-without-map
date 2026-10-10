"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PartnerLogosBanner } from "@/components/PartnerLogosBanner";

const NAV_LINKS = [
  { href: "/", label: "Map" },
  { href: "/add-settlement", label: "Add Settlement" },
  { href: "/data-import", label: "Data Import" },
  { href: "/methodology", label: "Methodology" },
  { href: "/analytics", label: "Analytics" },
  { href: "/export", label: "Export" },
  { href: "/admin", label: "Admin" },
];

function itemClass(isActive: boolean) {
  return isActive
    ? "rounded-lg bg-zinc-800 px-4 py-2.5 text-lg text-white"
    : "rounded-lg px-4 py-2.5 text-lg text-zinc-200 hover:bg-zinc-800 hover:text-white";
}

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-[1200] border-b border-zinc-700/60 bg-zinc-950/95 shadow-[0_6px_24px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="mx-auto grid min-h-[6.2rem] w-full max-w-[100%] grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 md:grid-cols-[auto_1fr_auto] md:gap-8 md:px-8 lg:px-10">
        <PartnerLogosBanner className="hidden shrink-0 justify-self-start md:flex" />

        <Link href="/" className="min-w-0 justify-self-center text-center md:col-start-2">
          <p className="text-[1.7rem] font-semibold uppercase tracking-[0.14em] text-zinc-100 md:text-[2.2rem]">
            POWER OF WITHOUT MAP
          </p>
          <p className="text-xl tracking-wide text-amber-300">Atlas of Informal Settlements</p>
        </Link>

        <nav className="hidden shrink-0 items-center justify-self-end gap-1 md:col-start-3 md:flex">
          {NAV_LINKS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" || pathname === "/map" : pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={itemClass(Boolean(isActive))}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="justify-self-end rounded-md border border-zinc-700 px-4 py-2.5 text-base text-zinc-200 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          Menu
        </button>
      </div>
      {open ? (
        <nav className="border-t border-zinc-800 bg-zinc-950 p-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" || pathname === "/map" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={itemClass(Boolean(isActive))}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
