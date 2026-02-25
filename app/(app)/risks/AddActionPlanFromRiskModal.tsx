"use client"

import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { createActionPlanManual } from "../action-plans/actions-create"

type Props = {
  riskId: string
}

export default function AddActionPlanFromRiskModal({ riskId }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        title="Adicionar plano de ação"
      >
        <Plus className="h-4 w-4" />
        Planos de ação
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  Novo Plano de Ação
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Será associado automaticamente a este risco.
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
              action={async (formData: FormData) => {
                formData.set("riskId", riskId)
                await createActionPlanManual(formData)
                setOpen(false)
              }}
              className="p-6 space-y-5"
            >
              <input type="hidden" name="riskId" value={riskId} />

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Título
                </label>
                <input
                  name="title"
                  required
                  placeholder="Ex.: Implementar controle de acesso"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Descrição do plano de ação
                </label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Descreva as ações que serão executadas…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Responsável pela execução
                </label>
                <input
                  name="responsible"
                  placeholder="Ex.: Maria Silva ou maria@empresa.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Data estimada de conclusão
                  </label>
                  <input
                    name="dueDate"
                    type="date"
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Prioridade
                  </label>
                  <select
                    name="priority"
                    defaultValue="medium"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
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
