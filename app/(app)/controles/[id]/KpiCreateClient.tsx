// app/(app)/controles/[id]/KpiCreateClient.tsx
"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { createKpiForControl } from "./actions"

export default function KpiCreateClient({ controlId }: { controlId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-white hover:bg-slate-50"
        title="Criar KPI para este controle"
      >
        <Plus className="w-4 h-4" />
        Criar KPI
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-base font-semibold text-slate-900">Criar KPI</div>
                <div className="text-xs text-slate-500">
                  Cria um KPI automaticamente associado ao controle selecionado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              action={createKpiForControl}
              onSubmit={() => setOpen(false)}
              className="p-5 space-y-4"
            >
              <input type="hidden" name="controlId" value={controlId} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ID do KPI (kpi_code)
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
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Fechar
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