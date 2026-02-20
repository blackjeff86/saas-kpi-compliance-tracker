"use client"

import { useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { updateActionPlanFromModal, type ActionPlanEditOptions } from "./actions"

type Props = {
  plan: {
    id: string
    responsible_name: string | null
    due_date: string | null
    priority: string | null
    status: string | null
    description: string | null
    risk_id: string | null
    control_id: string | null
  }
  options: ActionPlanEditOptions
}

function statusLabel(value: string) {
  const v = value.toLowerCase()
  if (v === "done") return "Concluído"
  if (v === "blocked") return "Bloqueado"
  if (v === "in_progress") return "Em andamento"
  if (v === "not_started") return "Não iniciado"
  return value
}

function priorityLabel(value: string) {
  const v = value.toLowerCase()
  if (v === "critical") return "Crítica"
  if (v === "high") return "Alta"
  if (v === "medium") return "Média"
  if (v === "low") return "Baixa"
  return value
}

export default function ActionPlanActionsButtonClient({ plan, options }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
      >
        Ações
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-800">Editar Plano de Ação</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={updateActionPlanFromModal} onSubmit={() => setOpen(false)} className="space-y-4 p-5">
              <input type="hidden" name="actionPlanId" value={plan.id} />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="ap-responsible" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Responsável
                  </label>
                  <input
                    id="ap-responsible"
                    name="responsibleName"
                    defaultValue={plan.responsible_name ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label htmlFor="ap-due" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Prazo final
                  </label>
                  <input
                    id="ap-due"
                    name="dueDate"
                    type="date"
                    defaultValue={plan.due_date ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="ap-priority" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Prioridade
                  </label>
                  <select
                    id="ap-priority"
                    name="priority"
                    defaultValue={plan.priority ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  >
                    {options.priorities.map((value) => (
                      <option key={value} value={value}>
                        {priorityLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ap-status" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Status
                  </label>
                  <select
                    id="ap-status"
                    name="status"
                    defaultValue={plan.status ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  >
                    {options.statuses.map((value) => (
                      <option key={value} value={value}>
                        {statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ap-description" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Detalhamento do plano
                </label>
                <textarea
                  id="ap-description"
                  name="description"
                  rows={5}
                  defaultValue={plan.description ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
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
