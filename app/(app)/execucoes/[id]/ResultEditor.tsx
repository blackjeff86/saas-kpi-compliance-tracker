"use client"

import { useState } from "react"
import { saveExecutionResult } from "../actions-save-result"

function autoClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("in_target")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s.includes("warning")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("out")) return "bg-red-50 text-red-700 border-red-200"
  if (s.includes("not_applicable")) return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

type Props = {
  executionId: string
  initialNumeric: number | null
  initialNotes: string | null
  initialAutoStatus: string | null
  initialWorkflowStatus: string | null
}

export default function ResultEditor({
  executionId,
  initialNumeric,
  initialNotes,
  initialAutoStatus,
  initialWorkflowStatus,
}: Props) {
  const [num, setNum] = useState<string>(initialNumeric === null ? "" : String(initialNumeric))
  const [notes, setNotes] = useState<string>(initialNotes ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSave() {
    try {
      setSaving(true)
      setErr(null)

      const parsed =
        num.trim() === "" ? null : Number(num.replace(",", "."))

      if (parsed !== null && Number.isNaN(parsed)) {
        setErr("Valor numérico inválido.")
        return
      }

      await saveExecutionResult({
        executionId,
        result_numeric: parsed,
        result_notes: notes.trim() === "" ? null : notes,
      })
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Resultado</h2>
          <div className="text-xs text-slate-500">Atualize o valor e salve para recalcular o auto status.</div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-xs text-slate-500">auto</div>
          <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${autoClass(initialAutoStatus)}`}>
            {initialAutoStatus ?? "—"}
          </span>
          <div className="text-xs text-slate-500 mt-2">wf</div>
          <div className="text-xs text-slate-600">{initialWorkflowStatus ?? "—"}</div>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-slate-600">Valor (numérico / %)</label>
        <input
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="Ex: 95"
          className="rounded-lg border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-slate-600">Observações</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalhes do resultado / contexto…"
          className="rounded-lg border bg-white px-3 py-2 text-sm min-h-[110px]"
        />
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  )
}
