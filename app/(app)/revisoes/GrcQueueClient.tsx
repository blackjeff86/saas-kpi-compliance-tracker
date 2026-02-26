// app/(app)/revisoes/GrcQueueClient.tsx
"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { submitGrcReview } from "../execucoes/actions-detail"
import type { GrcQueueRow } from "./actions"
import { ClipboardList, Send, Eye, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

function pillClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical")) return "bg-red-50 text-red-700 border-red-200"
  if (s.includes("high")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("med") || s.includes("moderate") || s.includes("medium"))
    return "bg-yellow-50 text-yellow-700 border-yellow-200"
  if (s.includes("low")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function statusClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("submitted")) return "bg-blue-50 text-blue-700 border-blue-200"
  if (s.includes("under_review")) return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (s.includes("needs_changes")) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function autoStatusClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (!s) return "bg-slate-50 text-slate-700 border-slate-200"

  // tentei ser resiliente a nomes diferentes de status automático
  if (s.includes("within") || s.includes("ok") || s.includes("met") || s.includes("pass"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200"

  if (s.includes("below") || s.includes("fail") || s.includes("breach"))
    return "bg-red-50 text-red-700 border-red-200"

  if (s.includes("warn") || s.includes("partial") || s.includes("attention"))
    return "bg-amber-50 text-amber-700 border-amber-200"

  return "bg-slate-50 text-slate-700 border-slate-200"
}

function isOverdueDate(dateText?: string | null) {
  if (!dateText) return false
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < today
}

type Props = {
  initialRows: GrcQueueRow[]
}

type Decision = "approved" | "needs_changes" | "rejected"

function defaultCommentFor(decision: Decision) {
  if (decision === "approved") return "Evidência validada."
  if (decision === "needs_changes") return "Necessário ajuste/complemento de evidência."
  return "Evidência/resultado reprovado."
}

export default function GrcQueueClient({ initialRows }: Props) {
  const router = useRouter()

  // filtros
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [risk, setRisk] = useState<string>("all")
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "with" | "without">("all")
  const [overdueOnly, setOverdueOnly] = useState(false)

  // modal
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<{
    executionId: string
    decision: Decision
    control_code: string
    kpi_code: string
  } | null>(null)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // contadores
  const counts = useMemo(() => {
    const c = {
      all: 0,
      submitted: 0,
      under_review: 0,
      needs_changes: 0,
      withEvidence: 0,
      withoutEvidence: 0,
      overdue: 0,
    }
    for (const r of initialRows) {
      c.all++
      if (r.workflow_status === "submitted") c.submitted++
      if (r.workflow_status === "under_review") c.under_review++
      if (r.workflow_status === "needs_changes") c.needs_changes++
      if (r.has_evidence) c.withEvidence++
      else c.withoutEvidence++
      if (isOverdueDate(r.review_due_date)) c.overdue++
    }
    return c
  }, [initialRows])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()

    return initialRows.filter((r) => {
      const matchesText =
        !query ||
        `${r.control_code} ${r.control_name} ${r.kpi_code} ${r.kpi_name}`.toLowerCase().includes(query)

      const matchesStatus = status === "all" || r.workflow_status === status
      const matchesRisk = risk === "all" || (r.risk_level || "").toLowerCase() === risk

      const matchesEvidence =
        evidenceFilter === "all" ||
        (evidenceFilter === "with" ? r.has_evidence : !r.has_evidence)

      const matchesOverdue = !overdueOnly || isOverdueDate(r.review_due_date)

      return matchesText && matchesStatus && matchesRisk && matchesEvidence && matchesOverdue
    })
  }, [initialRows, q, status, risk, evidenceFilter, overdueOnly])

  function openReview(r: GrcQueueRow, decision: Decision) {
    setError(null)
    setSelected({
      executionId: r.execution_id,
      decision,
      control_code: r.control_code,
      kpi_code: r.kpi_code,
    })
    setComment(defaultCommentFor(decision))
    setOpen(true)
  }

  const commentRequired = selected?.decision === "needs_changes" || selected?.decision === "rejected"
  const canSubmit = selected && (!commentRequired || comment.trim().length > 0)

  async function submit() {
    if (!selected) return
    if (!canSubmit) {
      setError("Comentário é obrigatório para Needs changes / Reject.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      await submitGrcReview({
        executionId: selected.executionId,
        decision: selected.decision,
        comment: comment.trim() || defaultCommentFor(selected.decision),
      })

      setOpen(false)
      setSelected(null)
      setComment("")
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar revisão.")
    } finally {
      setSaving(false)
    }
  }

  function StatusChip({
    value,
    label,
    count,
  }: {
    value: string
    label: string
    count: number
  }) {
    const active = status === value
    return (
      <button
        onClick={() => setStatus(value)}
        className={[
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm",
          active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50",
        ].join(" ")}
      >
        <span>{label}</span>
        <span className={active ? "text-white/80" : "text-slate-500"}>{count}</span>
      </button>
    )
  }

  function ToggleChip({
    active,
    label,
    count,
    onClick,
    tone = "slate",
  }: {
    active: boolean
    label: string
    count: number
    onClick: () => void
    tone?: "slate" | "red"
  }) {
    const base =
      tone === "red"
        ? "border-red-200"
        : "border-slate-200"

    const activeCls =
      tone === "red"
        ? "bg-red-600 text-white border-red-600"
        : "bg-slate-900 text-white border-slate-900"

    const inactiveCls =
      tone === "red"
        ? "bg-white text-red-700 hover:bg-red-50"
        : "bg-white hover:bg-slate-50"

    return (
      <button
        onClick={onClick}
        className={[
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm",
          base,
          active ? activeCls : inactiveCls,
        ].join(" ")}
        title={label}
      >
        <span>{label}</span>
        <span className={active ? "text-white/80" : tone === "red" ? "text-red-600" : "text-slate-500"}>
          {count}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-slate-400">{counts.all > 0 ? "Ativo" : "—"}</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Itens na Fila</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.all}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2 text-blue-700 dark:text-blue-400">
              <Send className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Aguardando triagem</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Submitted</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.submitted}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2 text-indigo-700 dark:text-indigo-400">
              <Eye className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Em validação</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Under Review</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.under_review}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Requer ação</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Needs Changes</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.needs_changes}</p>
        </div>
      </div>

      {/* CHIPS + FILTROS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <StatusChip value="all" label="Todos" count={counts.all} />
          <StatusChip value="submitted" label="Submitted" count={counts.submitted} />
          <StatusChip value="under_review" label="Under review" count={counts.under_review} />
          <StatusChip value="needs_changes" label="Needs changes" count={counts.needs_changes} />

          <div className="ml-auto flex flex-wrap gap-2">
            {/* ✅ atalho 1-clique: Overdue only */}
            <ToggleChip
              active={overdueOnly}
              label="Overdue"
              count={counts.overdue}
              tone="red"
              onClick={() => setOverdueOnly((v) => !v)}
            />

            {/* ✅ atalho 1-clique: sem evidência */}
            <ToggleChip
              active={evidenceFilter === "without"}
              label="Sem evidência"
              count={counts.withoutEvidence}
              onClick={() => setEvidenceFilter((v) => (v === "without" ? "all" : "without"))}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por controle, KPI, nome…"
            className="w-full md:w-96 rounded-lg border bg-white px-3 py-2 text-sm"
          />

          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Risco: Todos</option>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Status: Todos</option>
            <option value="submitted">submitted</option>
            <option value="under_review">under_review</option>
            <option value="needs_changes">needs_changes</option>
          </select>

          <select
            value={evidenceFilter}
            onChange={(e) => setEvidenceFilter(e.target.value as any)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Evidências: Todas</option>
            <option value="with">Com evidência</option>
            <option value="without">Sem evidência</option>
          </select>

          <div className="text-sm text-slate-500 md:ml-auto">{rows.length} item(ns) exibidos</div>
        </div>

        {/* ✅ indicador de filtro ativo */}
        {(overdueOnly || evidenceFilter !== "all") && (
          <div className="flex flex-wrap gap-2 text-xs">
            {overdueOnly && (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-red-50 text-red-700 border-red-200">
                filtro: overdue only
                <button className="text-red-700/80 hover:text-red-900" onClick={() => setOverdueOnly(false)}>
                  ✕
                </button>
              </span>
            )}
            {evidenceFilter !== "all" && (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                filtro: {evidenceFilter === "with" ? "com evidência" : "sem evidência"}
                <button className="text-slate-700/80 hover:text-slate-900" onClick={() => setEvidenceFilter("all")}>
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* TABELA */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="grid grid-cols-14 gap-2 px-4 py-3 bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800 ui-table-th">
          <div className="col-span-2">Risco</div>
          <div className="col-span-3">Controle</div>
          <div className="col-span-3">KPI</div>
          <div className="col-span-2">Evidências</div>
          <div className="col-span-2">Período</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-center">Ações</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum item na fila com os filtros atuais.</div>
        ) : (
          rows.map((r) => {
            const overdue = isOverdueDate(r.review_due_date)

            return (
              <div
                key={r.execution_id}
                className="grid grid-cols-14 gap-2 px-4 py-3 text-sm border-b last:border-b-0 items-center"
              >
                <div className="col-span-2 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${pillClass(r.risk_level)}`}>
                    {r.risk_level ?? "—"}
                  </span>

                  {overdue ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md border text-xs bg-red-50 text-red-700 border-red-200">
                      overdue
                    </span>
                  ) : null}
                </div>

                <div className="col-span-3">
                  <Link href={`/execucoes/${r.execution_id}`} className="font-medium hover:underline">
                    {r.control_code}
                  </Link>
                  <div className="text-xs text-slate-500 line-clamp-1">{r.control_name}</div>
                </div>

                <div className="col-span-3">
                  <div className="font-medium">{r.kpi_code}</div>
                  <div className="text-xs text-slate-500 line-clamp-1">{r.kpi_name}</div>

                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] ${autoStatusClass(r.auto_status)}`}
                      title="Auto status (cálculo automático do KPI)"
                    >
                      auto: {r.auto_status || "—"}
                    </span>
                  </div>
                </div>

                <div className="col-span-2">
                  {r.has_evidence ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-md border text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                        {r.evidence_count} evidência(s)
                      </span>
                      {r.last_evidence_at ? (
                        <div className="text-[11px] text-slate-500">última: {r.last_evidence_at}</div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md border text-xs bg-red-50 text-red-700 border-red-200">
                      Sem evidência
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-slate-600">
                  <div>
                    {r.period_start} → {r.period_end}
                  </div>
                  {r.review_due_date ? (
                    <div className={`text-[11px] ${overdue ? "text-red-600" : "text-slate-500"}`}>
                      due: {r.review_due_date}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">due: —</div>
                  )}
                </div>

                <div className="col-span-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${statusClass(r.workflow_status)}`}>
                    {r.workflow_status}
                  </span>
                </div>

                {/* AÇÕES */}
                <div className="col-span-1 flex justify-end gap-1">
                  <button
                    onClick={() => openReview(r, "approved")}
                    className="px-2 py-1 rounded-md text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                    title="Approve"
                  >
                    ✓
                  </button>

                  <button
                    onClick={() => openReview(r, "needs_changes")}
                    className="px-2 py-1 rounded-md text-xs bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                    title="Needs changes"
                  >
                    ↺
                  </button>

                  <button
                    onClick={() => openReview(r, "rejected")}
                    className="px-2 py-1 rounded-md text-xs bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                    title="Reject"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="text-xs text-slate-500">
        Dica: clique no código do controle para abrir o detalhe e ver evidências/resultado.
      </div>

      {/* MODAL */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setSelected(null)
            setComment("")
            setError(null)
            setSaving(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Registrar revisão (GRC)</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  Controle <span className="font-medium">{selected.control_code}</span> • KPI{" "}
                  <span className="font-medium">{selected.kpi_code}</span>
                </>
              ) : (
                "Selecione uma ação."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm">
              Decisão:{" "}
              <span className="font-semibold capitalize">
                {(selected?.decision ?? "-").replace("_", " ")}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600">
                Comentário {commentRequired ? "(obrigatório)" : "(opcional)"}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Descreva o motivo / ajustes necessários…"
                rows={5}
              />
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!canSubmit || saving}>
              {saving ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

