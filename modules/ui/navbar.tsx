"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./jsx";
import { pathnames } from "./pathnames";
import { Settings } from "./settings";
import { ThemeControl } from "./theme-control";

const items = [
  // {
  //   label: "Words",
  //   href: pathnames.words(),
  // },
  // {
  //   label: "Grammar",
  //   href: pathnames.grammar(),
  // },
  {
    label: "Corpus",
    href: pathnames.corpus(),
  },
  // {
  //   label: "Speak",
  //   href: pathnames.speak(),
  // },
  // {
  //   label: "Read",
  //   href: pathnames.read(),
  // },
  // {
  //   label: "Write",
  //   href: pathnames.write(),
  // },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-1">
        <Link className="btn btn-ghost text-xl" href="/">
          6p5Quest
        </Link>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                className={cn(
                  pathname === item.href && "menu-active",
                  "text-base lg:text-lg",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          ))}

          <li key="settings" className="flex items-center px-2">
            <Settings />
          </li>

          <li key="theme-switch">
            <ThemeControl />
          </li>
        </ul>
      </div>
    </div>
  );
}
