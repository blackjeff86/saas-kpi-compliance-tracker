"use client"

import React, { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { createRisk } from "./actions"

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

type Props = {
  sources: string[]
  naturezas: string[]
}

export default function NewRiskModal({ sources, naturezas }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition-all"
        title="Novo Risco"
      >
        <Plus className="h-4 w-4" />
        Novo Risco
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  Novo Risco
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Cadastre um novo risco no catálogo para vinculação a controles.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              action={async (formData) => {
                setError(null)
                const res = await createRisk(formData)
                if (res.ok && res.riskId) {
                  setOpen(false)
                  window.location.href = `/risks/${res.riskId}`
                  return
                }
                setError(res.error ?? "Erro ao criar risco.")
              }}
              className="p-6 space-y-5"
            >
              {error ? (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Identificação
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Código do risco (risk_code)
                    </label>
                    <input
                      name="riskCode"
                      type="text"
                      required
                      placeholder="Ex.: RISK-001"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Título / Nome do risco
                    </label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="Ex.: Perda de dados críticos"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    placeholder="Descreva o risco..."
                    className={clsx(
                      "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                      "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    )}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Classificação e métricas
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Fonte
                    </label>
                    <select
                      name="source"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {sources.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Natureza do risco
                    </label>
                    <select
                      name="natureza"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {naturezas.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Criticidade
                    </label>
                    <select
                      name="classification"
                      defaultValue="low"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    >
                      <option value="low">Low</option>
                      <option value="med">Med</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Impacto (1–5)
                    </label>
                    <select
                      name="impact"
                      defaultValue="1"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Probabilidade (1–5)
                    </label>
                    <select
                      name="likelihood"
                      defaultValue="1"
                      className={clsx(
                        "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      )}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Salvar Risco
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
