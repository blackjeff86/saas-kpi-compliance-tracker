// app/(app)/controles/FiltersBar.tsx
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

type Opts = {
  months: string[]
  frameworks: string[]
  frequencies: string[]
  risks: string[]
  owners: { name: string; email: string }[]
  focals: { name: string; email: string }[]
}

function buildQS(sp: URLSearchParams) {
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default function FiltersBar({
  total,
  opts,
}: {
  total: number
  opts: Opts
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // estado local (pra busca com debounce)
  const [q, setQ] = useState(searchParams.get("q") ?? "")

  // sync quando muda via navegação
  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
  }, [searchParams])

  const hasFilters = useMemo(() => {
    const keys = ["q", "mes_ref", "framework", "frequency", "risk", "owner", "focal"]
    return keys.some((k) => (searchParams.get(k) ?? "").trim())
  }, [searchParams])

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value && value.trim()) sp.set(key, value)
    else sp.delete(key)
    sp.set("page", "1")
    router.push(`${pathname}${buildQS(sp)}`)
  }

  // debounce da busca
  const tRef = useRef<any>(null)
  function onQChange(v: string) {
    setQ(v)
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => {
      setParam("q", v)
    }, 350)
  }

  function clearAll() {
    router.push(pathname)
  }

  return (
    <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[280px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4 text-slate-400" />
          </div>

          <input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Buscar por nome, código, framework, owner ou focal..."
            type="text"
          />
        </div>

        {/* Mês (dropdown) */}
        <select
          value={searchParams.get("mes_ref") ?? ""}
          onChange={(e) => setParam("mes_ref", e.target.value)}
          className="w-[180px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          title="Mês de referência"
        >
          <option value="">Mês ref (todos)</option>
          {opts.months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Framework */}
        <select
          value={searchParams.get("framework") ?? ""}
          onChange={(e) => setParam("framework", e.target.value)}
          className="w-[190px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Framework (todos)</option>
          {opts.frameworks.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Frequência */}
        <select
          value={searchParams.get("frequency") ?? ""}
          onChange={(e) => setParam("frequency", e.target.value)}
          className="w-[170px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Frequência (todas)</option>
          {opts.frequencies.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Risco */}
        <select
          value={searchParams.get("risk") ?? ""}
          onChange={(e) => setParam("risk", e.target.value)}
          className="w-[190px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Risco (todos)</option>
          {opts.risks.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Owner */}
        <select
          value={searchParams.get("owner") ?? ""}
          onChange={(e) => setParam("owner", e.target.value)}
          className="w-[210px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          title="Filtrar por Control Owner (nome ou email)"
        >
          <option value="">Owner (todos)</option>
          {opts.owners.map((o) => {
            const label = o.name && o.email ? `${o.name} (${o.email})` : o.name || o.email
            const value = o.email !== "—" ? o.email : o.name !== "—" ? o.name : ""
            if (!value) return null
            return (
              <option key={`${o.name}-${o.email}`} value={value}>
                {label}
              </option>
            )
          })}
        </select>

        {/* Focal */}
        <select
          value={searchParams.get("focal") ?? ""}
          onChange={(e) => setParam("focal", e.target.value)}
          className="w-[210px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          title="Filtrar por Focal Point (nome ou email)"
        >
          <option value="">Focal (todos)</option>
          {opts.focals.map((o) => {
            const label = o.name && o.email ? `${o.name} (${o.email})` : o.name || o.email
            const value = o.email !== "—" ? o.email : o.name !== "—" ? o.name : ""
            if (!value) return null
            return (
              <option key={`${o.name}-${o.email}`} value={value}>
                {label}
              </option>
            )
          })}
        </select>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Limpar filtros"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        ) : null}

        <div className="ml-auto text-sm text-slate-500">{total} resultado(s)</div>
      </div>

      <div className="text-xs text-slate-400">
        Dica: selecione um <b>Mês ref</b> para ver o <b>resultado do controle no mês</b> (pior KPI).
      </div>
    </div>
  )
}
