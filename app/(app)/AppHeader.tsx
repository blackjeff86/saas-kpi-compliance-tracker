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

  // Só adiciona "Detalhamento" em páginas de detalhe (ex: /controles/123, /risks/456)
  const detailRoutes = ["controles", "risks", "kpis", "action-plans", "execucoes"]
  if (first && detailRoutes.includes(first) && segs.length >= 2) {
    out.push({ label: "Detalhamento", href: pathname })
  }

  return out.length ? out : [{ label: "Dashboard", href: "/dashboard" }]
}

export default function AppHeader({ user }: { user: UserHeader }) {
  const pathname = usePathname() || "/dashboard"

  const crumb = useMemo(() => buildBreadcrumb(pathname), [pathname])
  const userInitials = useMemo(() => initials(user.name), [user.name])

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#E6ECF5] bg-white px-6">
      {/* breadcrumb - só exibe quando há mais de um nível (ex: Controles > Detalhamento) */}
      {crumb.length > 1 ? (
        <nav aria-label="Breadcrumb" className="flex items-center">
          <ol className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
            {crumb.map((c, idx) => {
              const last = idx === crumb.length - 1
              return (
                <React.Fragment key={`${c.label}-${idx}`}>
                  {idx > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[#475569]" /> : null}
                  {last ? (
                    <li className="text-[#0F172A]">{c.label}</li>
                  ) : (
                    <li>
                      <Link href={c.href} className="text-[#475569] transition-colors hover:text-[#06B6D4]">
                        {c.label}
                      </Link>
                    </li>
                  )}
                </React.Fragment>
              )
            })}
          </ol>
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      {/* right side */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold leading-none text-[#0F172A]">{user.name}</p>
            <p className="mt-1 text-[11px] text-[#475569]">{titleCase(user.role)}</p>
          </div>

          <div className="grid h-9 w-9 place-items-center rounded-full border border-[#E6ECF5] bg-[rgba(6,182,212,0.12)]">
            <span className="text-xs font-bold text-[#06B6D4]">{userInitials}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
