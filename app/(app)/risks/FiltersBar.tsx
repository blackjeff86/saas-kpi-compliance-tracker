"use client"

import React, { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

type Opts = {
  classifications: string[]
  sources: string[]
  naturezas: string[]
}

function buildQS(sp: URLSearchParams) {
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default function FiltersBar({ total, opts }: { total: number; opts: Opts }) {
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

  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onQChange(v: string) {
    setQ(v)
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => setParam("q", v), 350)
  }

  function clearAll() {
    const sp = new URLSearchParams()
    sp.set("page", "1")
    setQ("")
    router.push(`${pathname}${buildQS(sp)}`)
  }

  const hasActiveFilters =
    (searchParams.get("q") ?? "").trim() !== "" ||
    (searchParams.get("classification") ?? "").trim() !== "" ||
    (searchParams.get("source") ?? "").trim() !== "" ||
    (searchParams.get("natureza") ?? "").trim() !== ""

  const baseField =
    "h-10 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 " +
    "border border-slate-200 dark:border-slate-700 outline-none transition-colors " +
    "focus:ring-2 focus:ring-primary/30 focus:border-primary hover:border-slate-300 dark:hover:border-slate-600"

  return (
    <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            className={`w-full pl-10 pr-4 ${baseField} py-2`}
            placeholder="Buscar por código, título ou descrição..."
            type="text"
          />
        </div>

        <select
          value={searchParams.get("classification") ?? ""}
          onChange={(e) => setParam("classification", e.target.value)}
          className={`w-[170px] ${baseField} py-2`}
        >
          <option value="">Classificação (todas)</option>
          {opts.classifications.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("source") ?? ""}
          onChange={(e) => setParam("source", e.target.value)}
          className={`w-[180px] ${baseField} py-2`}
        >
          <option value="">Fonte (todas)</option>
          {opts.sources.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("natureza") ?? ""}
          onChange={(e) => setParam("natureza", e.target.value)}
          className={`w-[180px] ${baseField} py-2`}
        >
          <option value="">Natureza (todas)</option>
          {opts.naturezas.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            title="Limpar filtros"
          >
            <X className="w-4 h-4" />
            Limpar filtros
          </button>
        ) : null}

        <div className="sm:ml-auto text-sm text-slate-500">{total} resultado(s)</div>
      </div>
    </div>
  )
}
