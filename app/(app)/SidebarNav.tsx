"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  ClipboardList,
  Users,
  FileText,
  ListTodo,
  AlertTriangle,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

type NavSection = {
  title: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    title: "Visão",
    items: [{ href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard }],
  },
  {
    title: "Operação",
    items: [
      { href: "/execucoes", label: "Execuções", Icon: ClipboardList },
      { href: "/revisoes", label: "Revisões GRC", Icon: ShieldCheck },
      { href: "/action-plans", label: "Planos de Ação", Icon: ListTodo },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/kpis", label: "KPIs", Icon: BarChart3 },
      { href: "/controles", label: "Controles", Icon: FileText },
      { href: "/risks", label: "Riscos", Icon: AlertTriangle },
    ],
  },
  {
    title: "Admin",
    items: [{ href: "/usuarios", label: "Usuários", Icon: Users }],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(href + "/")
}

export default function SidebarNav() {
  const pathname = usePathname() || "/"

  return (
    <nav className="flex-1 px-3 py-4 space-y-5 text-sm">
      {SECTIONS.map((sec) => (
        <div key={sec.title}>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {sec.title}
          </div>

          <div className="space-y-1">
            {sec.items.map(({ href, label, Icon }) => {
              const active = isActivePath(pathname, href)

              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r-full" />
                  ) : null}

                  <Icon
                    size={18}
                    className={active ? "text-primary" : "text-slate-500"}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
