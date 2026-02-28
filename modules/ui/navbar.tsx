"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { pathnames } from "../common/pathnames";
import { cn } from "./jsx";


const items = [
    {
        label: 'Words',
        href: pathnames.words(),
    },
    {
        label: 'Grammar',
        href: pathnames.grammar(),
    },
    {
        label: 'Listen',
        href: pathnames.listen(),
    },
    {
        label: 'Speak',
        href: pathnames.speak(),
    },
    {
        label: 'Read',
        href: pathnames.read(),
    },
    {
        label: 'Write',
        href: pathnames.write(),

    }
];

export default function Navbar() {
    const pathname = usePathname();

    return <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1">
            <Link
                className="btn btn-ghost text-xl"
                href='/'
            >
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
                {/* <li>
                <details>
                  <summary>Parent</summary>
                  <ul className="bg-base-100 rounded-t-none p-2">
                    <li><a>Link 1</a></li>
                    <li><a>Link 2</a></li>
                  </ul>
                </details>
              </li> */}
            </ul>
        </div>
    </div>
}
