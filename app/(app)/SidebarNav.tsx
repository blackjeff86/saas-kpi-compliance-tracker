"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  ClipboardList,
  LogOut,
  Users,
  FileText,
  ListTodo,
  AlertTriangle,
  ClipboardCheck,
  Settings,
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
      { href: "/auditorias", label: "Auditorias", Icon: ClipboardCheck },
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
    items: [
      { href: "/usuarios", label: "Usuários", Icon: Users },
      { href: "/configuracoes", label: "Configurações", Icon: Settings },
    ],
  },
]

const UNFINISHED_ROUTES = new Set(["/dashboard", "/execucoes", "/revisoes", "/auditorias", "/usuarios"])

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(href + "/")
}

export default function SidebarNav() {
  const pathname = usePathname() || "/"

  return (
    <nav className="flex h-full flex-col px-3 py-4 text-sm">
      <div className="space-y-5">
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/60">
              {sec.title}
            </div>

            <div className="space-y-1">
              {sec.items.map(({ href, label, Icon }) => {
                const active = isActivePath(pathname, href)
                const isUnfinished = UNFINISHED_ROUTES.has(href)

                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      active
                        ? "bg-[#06B6D4] text-white font-semibold"
                        : "text-white/80 hover:bg-white/5",
                    ].join(" ")}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#06B6D4]" />
                    ) : null}

                    <Icon
                      size={18}
                      className={active ? "text-white" : "text-white/70"}
                    />
                    <span className="truncate">
                      {label}
                      {isUnfinished ? <span className="ml-1 text-red-500">*</span> : null}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Link
          href="/api/dev/logout"
          className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          title="Sair"
        >
          <LogOut size={18} className="text-white/70" />
          <span className="truncate">Sair</span>
        </Link>
      </div>
    </nav>
  )
}
