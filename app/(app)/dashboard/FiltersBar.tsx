"use client"

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { X, Loader2 } from "lucide-react"

type Framework = { id: string; name: string }
type MonthOpt = { v: number; l: string }

export default function FiltersBar({
  frameworks,
  months,
  value,
}: {
  frameworks: Framework[]
  months: MonthOpt[]
  value: { frameworkId: string; month: string; year: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [frameworkId, setFrameworkId] = useState(value.frameworkId ?? "")
  const [month, setMonth] = useState(value.month ?? "")
  const [year, setYear] = useState(value.year ?? "")

  // evita auto-apply logo no mount (já estamos na URL correta)
  const didMount = useRef(false)

  const years = useMemo(() => {
    const base = new Date().getFullYear() - 2
    return Array.from({ length: 6 }).map((_, i) => String(base + i))
  }, [])

  const hasActiveFilters = useMemo(() => {
    // frameworkId é o “filtro real”. month/year sempre existem (mesmo default).
    return Boolean(frameworkId)
  }, [frameworkId])

  const buildUrl = (next: { frameworkId: string; month: string; year: string }) => {
    const params = new URLSearchParams(sp?.toString())

    // framework
    if (next.frameworkId) params.set("frameworkId", next.frameworkId)
    else params.delete("frameworkId")

    // mês/ano
    if (next.month) params.set("month", next.month)
    else params.delete("month")

    if (next.year) params.set("year", next.year)
    else params.delete("year")

    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  // auto-apply com debounce leve (evita replace múltiplos em sequência)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    const t = window.setTimeout(() => {
      const url = buildUrl({ frameworkId, month, year })
      startTransition(() => router.replace(url))
    }, 200)

    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId, month, year])

  const clear = () => {
    // Reseta estados locais pra não reintroduzir o filtro na próxima mudança
    setFrameworkId("")
    setMonth(String(new Date().getMonth() + 1))
    setYear(String(new Date().getFullYear()))

    startTransition(() => router.replace("/dashboard"))
  }

  return (
    <div className="no-print ui-card p-4">
      <div className="flex flex-col gap-3">
        {/* linha principal */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Framework (mais largo) */}
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-medium text-[#475569]">Framework</label>
            <select
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="ui-input"
            >
              <option value="">Todos</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mês */}
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-[#475569]">Mês</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="ui-input"
            >
              {months.map((m) => (
                <option key={m.v} value={String(m.v)}>
                  {m.l}
                </option>
              ))}
            </select>
          </div>

          {/* Ano */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#475569]">Ano</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="ui-input"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Limpar */}
          <div className="md:col-span-1 md:flex md:justify-end">
            <button
              type="button"
              onClick={clear}
               className="ui-btn-secondary disabled:opacity-60 w-full md:w-auto"
              title="Limpar filtros"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Limpar
            </button>
          </div>
        </div>

        {/* linha secundária (feedback minimalista) */}
        <div className="flex items-center justify-between text-xs text-[#64748B]">
          <span>
            {hasActiveFilters ? (
              <>
                Filtros aplicados automaticamente •{" "}
                 <span className="font-medium text-[#0F172A]">Framework</span>
              </>
            ) : (
              <>Seleção aplicada automaticamente</>
            )}
          </span>

          <span className="inline-flex items-center gap-2">
             <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "bg-[#06B6D4]" : "bg-[#10B981]"} opacity-80`} />
            {isPending ? "Atualizando…" : "Atualizado"}
          </span>
        </div>
      </div>
    </div>
  )
}
