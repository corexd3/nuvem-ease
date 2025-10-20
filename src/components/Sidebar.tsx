"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Issue NFC-e", path: "/issue" },
  { icon: Search, label: "Query NFC-e", path: "/query" },
  { icon: XCircle, label: "Cancel NFC-e", path: "/cancel" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex flex-col h-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Menu</h2>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
