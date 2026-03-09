"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./jsx";
import { pathnames } from "./pathnames";
import { Settings } from "./settings";
import { ThemeControl } from "./theme-control";

const items = [
  { label: "词汇", href: pathnames.vocabulary() },
  { label: "语料库", href: pathnames.corpus() },
];

function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <>
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
      <li key="settings" className={cn(!vertical && "flex items-center px-2")}>
        <Settings />
      </li>
      <li key="theme-switch">
        <ThemeControl />
      </li>
    </>
  );
}

export default function Navbar() {
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-1">
        <Link className="btn btn-ghost text-xl" href="/">
          6p5Quest
        </Link>
      </div>
      <div className="flex-none">
        {/* 大屏：横向菜单 */}
        <ul className="menu menu-horizontal px-1 hidden lg:flex">
          <NavLinks />
        </ul>
        {/* 小屏：汉堡按钮 + 下拉菜单 */}
        <div className="dropdown dropdown-end lg:hidden">
          <label
            tabIndex={0}
            className="btn btn-ghost btn-square"
            aria-label="打开菜单"
          >
            <Menu className="size-6" />
          </label>
          <ul
            tabIndex={0}
            className="menu dropdown-content bg-base-200 rounded-box z-50 mt-2 w-52 p-2 shadow-lg"
          >
            <NavLinks vertical />
          </ul>
        </div>
      </div>
    </div>
  );
}
