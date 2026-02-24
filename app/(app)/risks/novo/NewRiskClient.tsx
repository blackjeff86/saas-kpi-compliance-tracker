"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createRisk } from "../actions"

type Props = {
  sources: string[]
  naturezas: string[]
}

export default function NewRiskClient({ sources, naturezas }: Props) {
  const router = useRouter()
  const [state, formAction] = useActionState(
    async (_: unknown, formData: FormData) => createRisk(formData),
    null as { ok: boolean; error?: string; riskId?: string } | null
  )

  useEffect(() => {
    if (state?.ok && state?.riskId) router.push(`/risks/${state.riskId}`)
  }, [state, router])

  const baseField =
    "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"

  return (
    <form action={formAction} className="max-w-2xl space-y-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6">
      {state?.error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Código do risco (risk_code)
          </label>
          <input name="riskCode" type="text" required className={baseField} placeholder="Ex.: RISK-001" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Título / Nome do risco
          </label>
          <input name="title" type="text" required className={baseField} placeholder="Ex.: Perda de dados críticos" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Descrição
        </label>
        <textarea name="description" rows={4} className={baseField} placeholder="Descreva o risco..." />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fonte
          </label>
          <select name="source" className={baseField}>
            <option value="">Selecione...</option>
            {sources.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Natureza do risco
          </label>
          <select name="natureza" className={baseField}>
            <option value="">Selecione...</option>
            {naturezas.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Criticidade (classificação)
          </label>
          <select name="classification" className={baseField} defaultValue="low">
            <option value="low">Low</option>
            <option value="med">Med</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/risks")}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
          Criar Risco
        </button>
      </div>
    </form>
  )
}
