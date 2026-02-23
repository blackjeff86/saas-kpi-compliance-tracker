// app/(app)/action-plans/NewActionPlanModal.tsx
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Plus, X, ChevronDown, Search, Check } from "lucide-react"
import { createActionPlanManual, type OriginItem, type OriginOptions } from "./actions-create"

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void
) {
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

type ComboProps = {
  label: string
  placeholder: string
  items: OriginItem[]
  hiddenName: string // id(uuid) gravado no form
}

function OriginCombobox({ label, placeholder, items, hiddenName }: ComboProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<OriginItem | null>(null)

  useOnClickOutside(wrapRef, () => setOpen(false))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 30)
    const out = items.filter((it) => {
      const code = (it.code || "").toLowerCase()
      const name = (it.name || "").toLowerCase()
      return code.includes(q) || name.includes(q)
    })
    return out.slice(0, 30)
  }, [items, query])

  function openAndFocus() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function clear() {
    setSelected(null)
    setQuery("")
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function pick(it: OriginItem) {
    setSelected(it)
    setQuery(it.code) // mostra só o código no campo (sem UUID)
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      {/* hidden (uuid) */}
      <input type="hidden" name={hiddenName} value={selected?.id ?? ""} />

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
          placeholder={placeholder}
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 outline-none",
            "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          )}
        />

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openAndFocus())}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
          title="Abrir"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* helper: mostra nome selecionado sem poluir input */}
      {selected ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 line-clamp-1">
            <span className="font-semibold text-slate-700">{selected.code}</span>{" "}
            <span className="text-slate-400">•</span> {selected.name || "—"}
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-semibold text-slate-500 hover:text-primary"
          >
            limpar
          </button>
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-slate-400">
          Digite para buscar pelo <b>ID/código</b> ou nome.
        </div>
      )}

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <div className="text-xs text-slate-500">Sugestões</div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">Nenhum resultado.</div>
            ) : (
              filtered.map((it) => {
                const isSel = selected?.id === it.id
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => pick(it)}
                    className={clsx(
                      "w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors",
                      "flex items-start justify-between gap-3"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{it.code}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{it.name || "—"}</div>
                    </div>
                    {isSel ? <Check className="h-4 w-4 text-primary mt-0.5" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Props = {
  originOptions: OriginOptions
}

export default function NewActionPlanModal({ originOptions }: Props) {
  const [open, setOpen] = useState(false)

  const risks = originOptions.risks || []
  const controls = originOptions.controls || []
  const kpis = originOptions.kpis || []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition-all"
        title="Novo Plano"
      >
        <Plus className="h-4 w-4" />
        Novo Plano
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="text-base font-semibold text-slate-900">Plano de Ação</div>
                <div className="text-xs text-slate-500">
                  Crie um plano manual e vincule a origem (Risco / Controle / KPI).
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              action={async (formData) => {
                await createActionPlanManual(formData)
                setOpen(false)
              }}
              className="p-6 space-y-5"
            >
              {/* ORIGEM */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Origem do plano
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <OriginCombobox
                    label="Risco (ID)"
                    placeholder="Buscar risco..."
                    items={risks}
                    hiddenName="riskId"
                  />
                  <OriginCombobox
                    label="Controle (ID)"
                    placeholder="Buscar controle..."
                    items={controls}
                    hiddenName="controlId"
                  />
                  <OriginCombobox
                    label="KPI (ID)"
                    placeholder="Buscar KPI..."
                    items={kpis}
                    hiddenName="kpiId"
                  />
                </div>
              </div>

              {/* CAMPOS DO PLANO */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Título
                  </label>
                  <input
                    name="title"
                    required
                    placeholder="Ex.: Ajustar checklist da coleta de evidências"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Descrição do plano de ação
                  </label>
                  <textarea
                    name="description"
                    rows={5}
                    placeholder="Descreva as ações que serão executadas…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Responsável pela execução
                  </label>
                  <input
                    name="responsible"
                    placeholder="Ex.: maria@empresa.com ou Maria Silva"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data estimada de conclusão
                    </label>
                    <input
                      name="dueDate"
                      type="date"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">Obrigatório.</div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Prioridade
                    </label>
                    <select
                      name="priority"
                      defaultValue="medium"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white"
                      )}
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Salvar Plano de Ação
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
