"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, X } from "lucide-react"
import { updateRisk } from "./actions"

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export type RiskForEdit = {
  id: string
  title: string
  description: string | null
  risk_code?: string
  domain: string
  classification: string
  risk_source?: string | null
  natureza?: string | null
  impact: number
  likelihood: number
}

type Props = {
  risk: RiskForEdit
  sources: string[]
  naturezas: string[]
}

export default function EditRiskModal({ risk, sources, naturezas }: Props) {
  const router = useRouter()
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
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
        title="Editar Risco"
      >
        <Pencil className="w-4 h-4" />
        Editar Risco
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  Editar Risco
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Atualize os dados do risco no catálogo.
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
                const res = await updateRisk(risk.id, formData)
                if (res.ok) {
                  setOpen(false)
                  router.refresh()
                  return
                }
                setError(res.error ?? "Erro ao atualizar risco.")
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
                      placeholder="Ex.: RISK-001"
                      defaultValue={risk.risk_code ?? risk.domain ?? ""}
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
                      defaultValue={risk.title}
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
                    defaultValue={risk.description ?? ""}
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
                      defaultValue={risk.risk_source ?? ""}
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
                      defaultValue={risk.natureza ?? ""}
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
                      defaultValue={risk.classification ?? "low"}
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
                      defaultValue={String(risk.impact ?? 1)}
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
                      defaultValue={String(risk.likelihood ?? 1)}
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
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
