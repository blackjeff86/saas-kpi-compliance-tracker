// app/(app)/AppHeader.tsx
"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { usePageTitle } from "./contexts/PageTitleContext"

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

function buildBreadcrumb(pathname: string, pageTitle: string | null) {
  const segs = pathname.split("?")[0].split("/").filter(Boolean)

  if (segs.length === 0) {
    return [{ label: pageTitle ?? "Dashboard", href: "/dashboard" }]
  }

  const first = segs[0]
  const map: Record<string, { label: string; href: string }> = {
    dashboard: { label: "Dashboard", href: "/dashboard" },
    execucoes: { label: "Execuções", href: "/execucoes" },
    revisoes: { label: "Revisões GRC", href: "/revisoes" },
    "action-plans": { label: "Planos de Ação", href: "/action-plans" },
    kpis: { label: "Gestão de KPIs", href: "/kpis" },
    controles: { label: "Controles", href: "/controles" },
    usuarios: { label: "Usuários", href: "/usuarios" },
    risks: { label: "Gestão de Riscos", href: "/risks" },
  }

  const detailRoutes = ["controles", "risks", "kpis", "action-plans", "execucoes"]
  const isDetailPage = first && detailRoutes.includes(first) && segs.length >= 2

  // Página de listagem: usa título da página do context se houver, senão usa o do map
  if (!isDetailPage) {
    const label = pageTitle ?? map[first]?.label ?? first
    return [{ label, href: pathname }]
  }

  // Página de detalhe: Parent > título da página (do context)
  const out: Array<{ label: string; href: string }> = []
  const firstNode = map[first]
  if (firstNode) out.push(firstNode)
  out.push({ label: pageTitle ?? "Detalhamento", href: pathname })
  return out
}

export default function AppHeader({ user }: { user: UserHeader }) {
  const pathname = usePathname() || "/dashboard"
  const { title: pageTitle } = usePageTitle()

  const crumb = useMemo(() => buildBreadcrumb(pathname, pageTitle), [pathname, pageTitle])
  const userInitials = useMemo(() => initials(user.name), [user.name])

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#E6ECF5] bg-white px-6">
      {/* breadcrumb - só em páginas de detalhamento */}
      {crumb.length > 1 ? (
        <nav aria-label="Breadcrumb" className="flex items-center">
          <ol className="flex items-center gap-2 text-sm font-medium text-[#475569]">
            {crumb.map((c, idx) => {
              const last = idx === crumb.length - 1
              return (
                <React.Fragment key={`${c.label}-${idx}`}>
                  {idx > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" /> : null}
                  {last ? (
                    <li className="text-[#0F172A]">{c.label}</li>
                  ) : (
                    <li>
                      <Link href={c.href} className="transition-colors hover:text-[#06B6D4]">
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
