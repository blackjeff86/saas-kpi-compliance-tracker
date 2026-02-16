// app/(app)/AppHeader.tsx
"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

type UserHeader = {
  name: string
  role: string
  email?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "U"
  const b = parts[1]?.[0] ?? ""
  return (a + b).toUpperCase()
}

function titleCase(s: string) {
  return s
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ")
}

function buildBreadcrumb(pathname: string) {
  const segs = pathname.split("?")[0].split("/").filter(Boolean)

  if (segs.length === 0) return [{ label: "Dashboard", href: "/dashboard" }]

  const first = segs[0]
  const map: Record<string, { label: string; href: string }> = {
    dashboard: { label: "Dashboard", href: "/dashboard" },
    execucoes: { label: "Execuções", href: "/execucoes" },
    revisoes: { label: "Revisões GRC", href: "/revisoes" },
    "action-plans": { label: "Planos de Ação", href: "/action-plans" },
    kpis: { label: "KPIs", href: "/kpis" },
    controles: { label: "Controles", href: "/controles" },
    usuarios: { label: "Usuários", href: "/usuarios" },
    risks: { label: "Riscos", href: "/risks" },
  }

  const out: Array<{ label: string; href: string }> = []
  const firstNode = map[first]
  if (firstNode) out.push(firstNode)

  if (first === "controles" && segs.length >= 2) {
    out.push({ label: "Detalhamento", href: pathname })
  }

  return out.length ? out : [{ label: "Dashboard", href: "/dashboard" }]
}

export default function AppHeader({ user }: { user: UserHeader }) {
  const pathname = usePathname() || "/dashboard"

  const crumb = useMemo(() => buildBreadcrumb(pathname), [pathname])
  const userInitials = useMemo(() => initials(user.name), [user.name])

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-10">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center">
        <ol className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          {crumb.map((c, idx) => {
            const last = idx === crumb.length - 1
            return (
              <React.Fragment key={`${c.label}-${idx}`}>
                {idx > 0 ? <ChevronRight className="w-3.5 h-3.5 text-slate-300" /> : null}
                {last ? (
                  <li className="text-slate-600">{c.label}</li>
                ) : (
                  <li>
                    <Link href={c.href} className="hover:text-slate-600 transition-colors">
                      {c.label}
                    </Link>
                  </li>
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>

      {/* right side */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold leading-none text-slate-900">{user.name}</p>
            <p className="text-[11px] text-slate-500 mt-1">{titleCase(user.role)}</p>
          </div>

          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 grid place-items-center">
            <span className="text-xs font-bold text-slate-700">{userInitials}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
