// app/(app)/controles/FiltersBar.tsx
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X, CalendarDays } from "lucide-react"

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

// "2026-02" -> "Fev/2026"
function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((v) => Number(v))
  if (!y || !m || m < 1 || m > 12) return yyyyMm
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[m - 1]}/${y}`
}

// mês atual YYYY-MM (America/Sao_Paulo)
function currentYYYYMM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  return `${y}-${m}`
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

  const [q, setQ] = useState(searchParams.get("q") ?? "")

  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
  }, [searchParams])

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value && value.trim()) sp.set(key, value)
    else sp.delete(key)
    sp.set("page", "1")
    router.push(`${pathname}${buildQS(sp)}`)
  }

  // garante mes_ref sempre (mês atual)
  useEffect(() => {
    const mr = (searchParams.get("mes_ref") ?? "").trim()
    if (!mr) {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set("mes_ref", currentYYYYMM())
      sp.set("page", "1")
      router.replace(`${pathname}${buildQS(sp)}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router])

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
    const sp = new URLSearchParams()
    sp.set("mes_ref", currentYYYYMM())
    sp.set("page", "1")
    setQ("")
    router.push(`${pathname}${buildQS(sp)}`)
  }

  const mr = (searchParams.get("mes_ref") ?? "").trim() || currentYYYYMM()
  const mrCurrent = currentYYYYMM()
  const isCurrentMonth = mr === mrCurrent

  // =============================
  // Design tokens locais
  // =============================
  const baseField =
    "h-10 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 " +
    "border border-slate-200 dark:border-slate-700 " +
    "outline-none transition-colors " +
    "focus:ring-2 focus:ring-primary/30 focus:border-primary " +
    "hover:border-slate-300 dark:hover:border-slate-600"

  const selectField = baseField + " py-2"
  const inputField = baseField + " py-2"

  // mês ref (borda highlight)
  const monthSelect =
    "h-10 w-[210px] pl-10 pr-3 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 " +
    "text-slate-900 dark:text-slate-100 " +
    "border outline-none transition-colors " +
    "hover:border-slate-300 dark:hover:border-slate-600 " +
    "focus:ring-2 focus:ring-black/5"

  // ✅ mostrar "Limpar" apenas quando tiver algo aplicado:
  // - algum filtro além do mês atual OU
  // - mês ref diferente do mês atual
  const hasActiveFilters = useMemo(() => {
    const qv = (searchParams.get("q") ?? "").trim()
    const framework = (searchParams.get("framework") ?? "").trim()
    const frequency = (searchParams.get("frequency") ?? "").trim()
    const risk = (searchParams.get("risk") ?? "").trim()
    const resultado = (searchParams.get("resultado") ?? "").trim()
    const owner = (searchParams.get("owner") ?? "").trim()
    const focal = (searchParams.get("focal") ?? "").trim()
    const monthDiff = (searchParams.get("mes_ref") ?? "").trim() && !isCurrentMonth

    return Boolean(qv || framework || frequency || risk || resultado || owner || focal || monthDiff)
  }, [searchParams, isCurrentMonth])

  return (
    <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
      {/* ✅ Linha 1: busca + limpar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[280px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4 text-slate-400" />
          </div>

          <input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            className={`w-full pl-10 pr-4 ${inputField}`}
            placeholder="Buscar por nome, código, framework, owner ou focal..."
            type="text"
          />
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className={[
              "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition-colors",
              "border-slate-200 dark:border-slate-700",
              "text-slate-700 dark:text-slate-200",
              "bg-white dark:bg-slate-900",
              "hover:bg-slate-50 dark:hover:bg-slate-800",
              "shrink-0",
            ].join(" ")}
            title="Limpar filtros (mantém mês atual)"
          >
            <X className="w-4 h-4" />
            Limpar filtros
          </button>
        ) : null}

        <div className="sm:ml-auto text-sm text-slate-500">{total} resultado(s)</div>
      </div>

      {/* ✅ Linha 2: filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mês ref (highlight via globals.css --highlight) */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <CalendarDays className="w-4 h-4" style={{ color: "var(--highlight)" }} />
            </div>

            <select
              value={mr}
              onChange={(e) => setParam("mes_ref", e.target.value)}
              className={monthSelect}
              style={{
                borderColor: "var(--highlight)",
                boxShadow: "0 0 0 1px var(--highlight) inset",
              }}
              title="Mês de referência"
            >
              {opts.months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <span
            className={[
              "inline-flex items-center h-10 px-3 rounded-lg text-xs font-semibold border select-none",
              isCurrentMonth ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "",
            ].join(" ")}
            style={
              !isCurrentMonth
                ? {
                    backgroundColor: "color-mix(in srgb, var(--highlight) 12%, transparent)",
                    color: "var(--highlight)",
                    borderColor: "color-mix(in srgb, var(--highlight) 25%, transparent)",
                  }
                : undefined
            }
            title={isCurrentMonth ? "Filtrando o mês atual" : "Filtrando um mês específico"}
          >
            {isCurrentMonth ? "MÊS ATUAL" : "ATIVO"}
          </span>
        </div>

        {/* Framework */}
        <select
          value={searchParams.get("framework") ?? ""}
          onChange={(e) => setParam("framework", e.target.value)}
          className={`w-[190px] ${selectField}`}
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
          className={`w-[170px] ${selectField}`}
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
          className={`w-[190px] ${selectField}`}
        >
          <option value="">Risco (todos)</option>
          {opts.risks.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Resultado (mês) */}
        <select
          value={searchParams.get("resultado") ?? ""}
          onChange={(e) => setParam("resultado", e.target.value)}
          className={`w-[200px] ${selectField}`}
          title="Filtrar por Resultado (mês)"
        >
          <option value="">Resultado (mês)</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="effective">Effective</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="not_applicable">Not applicable</option>
        </select>

        {/* Owner */}
        <select
          value={searchParams.get("owner") ?? ""}
          onChange={(e) => setParam("owner", e.target.value)}
          className={`w-[210px] ${selectField}`}
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
          className={`w-[210px] ${selectField}`}
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
      </div>

      <div className="text-xs text-slate-400">
        Dica: o <b>Mês ref</b> sempre vem selecionado (mês atual) para mostrar o <b>resultado do controle no mês</b> (pior KPI).
      </div>
    </div>
  )
}
