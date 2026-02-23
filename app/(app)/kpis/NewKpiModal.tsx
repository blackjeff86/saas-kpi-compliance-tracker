"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, ChevronDown, Search, Check } from "lucide-react"
import { createKpi } from "./actions"

type ControlOption = { id: string; control_code: string; name: string }

function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, onOutside: () => void) {
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = ref.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      onOutside()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [ref, onOutside])
}

function ControlCombobox({ controls }: { controls: ControlOption[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<ControlOption | null>(null)

  useOnClickOutside(wrapRef, () => setOpen(false))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return controls.slice(0, 50)
    return controls.filter((c) => {
      const code = (c.control_code || "").toLowerCase()
      const name = (c.name || "").toLowerCase()
      return code.includes(q) || name.includes(q)
    }).slice(0, 50)
  }, [controls, query])

  function openAndFocus() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function clear() {
    setSelected(null)
    setQuery("")
    setOpen(false)
  }

  function pick(c: ControlOption) {
    setSelected(c)
    setQuery(`${c.control_code} — ${c.name}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Controle
      </label>
      <input type="hidden" name="controlId" value={selected?.id ?? ""} />
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setSelected(null)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Digite para buscar pelo código ou nome do controle..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openAndFocus())}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
          title="Abrir lista"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {selected ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 line-clamp-1">
            Selecionado: <span className="font-semibold text-slate-700">{selected.control_code}</span>
            <span className="text-slate-400"> — </span>
            {selected.name || "—"}
          </div>
          <button type="button" onClick={clear} className="text-[11px] font-semibold text-slate-500 hover:text-primary">
            limpar
          </button>
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-slate-400">
          Digite para buscar pelo <b>código</b> ou <b>nome</b> do controle.
        </div>
      )}
      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">Sugestões</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">Nenhum resultado.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{c.control_code}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{c.name || "—"}</div>
                  </div>
                  {selected?.id === c.id ? <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Props = {
  controls: ControlOption[]
}

export default function NewKpiModal({ controls }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition-all"
        title="Novo KPI"
      >
        <Plus className="h-4 w-4" />
        Novo KPI
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="text-base font-semibold text-slate-900">Novo KPI</div>
                <div className="text-xs text-slate-500">
                  Crie um KPI e vincule a um controle existente.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              action={async (formData) => {
                setError(null)
                const res = await createKpi(formData)
                if (res.ok && res.kpiId) {
                  setOpen(false)
                  router.push(`/kpis/${res.kpiId}`)
                } else {
                  setError(res.error ?? "Erro ao criar KPI.")
                }
              }}
              className="p-6 space-y-5"
            >
              {error ? (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <ControlCombobox controls={controls} />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Código do KPI (kpi_code)
                  </label>
                  <input
                    name="kpiCode"
                    type="text"
                    required
                    placeholder="Ex.: KPI_7894"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                  <div className="mt-1 text-[11px] text-slate-400">
                    Sugestão: use um padrão fixo (ex.: KPI_0001).
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nome do KPI (kpi_name)
                  </label>
                  <input
                    name="kpiName"
                    type="text"
                    required
                    placeholder="Ex.: Cobertura de Evidências"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Descrição do KPI
                </label>
                <textarea
                  name="kpiDescription"
                  rows={4}
                  placeholder="Descreva o objetivo/como calcular/observações…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setError(null)
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Criar KPI
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
