"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/lab", label: "Simulator" },
  { href: "/lab/algorithms", label: "Algorithm Labs" },
  { href: "/practice", label: "Practice" },
  { href: "/cheatsheet", label: "Cheatsheet" },
  { href: "/progress", label: "Progress" },
];

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3 29 10.5v11L16 29 3 21.5v-11Z" fill="#d4603a" />
      <path d="M16 3 29 10.5 16 18 3 10.5Z" fill="#e88b62" />
      <path d="M16 18v11L3 21.5v-11Z" fill="#a9452a" />
      <circle cx="16" cy="11" r="2.3" fill="#fbf7f1" />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname() || "/";
  const active = (href: string) =>
    href === "/lab" ? path === "/lab" : path === href || path.startsWith(href + "/");
  return (
    <nav className="nav no-print">
      <div className="container wide nav-inner">
        <Link href="/" className="brand"><BrandMark /><span>ScaleForge</span></Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "active" : ""}>{l.label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
