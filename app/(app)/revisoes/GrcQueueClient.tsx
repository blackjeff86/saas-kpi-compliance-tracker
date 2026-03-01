// app/(app)/revisoes/GrcQueueClient.tsx
"use client"

import Link from "next/link"
import { Fragment, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { submitGrcReview } from "../execucoes/actions-detail"
import type { GrcQueueRow } from "./actions"
import {
  ClipboardList,
  Send,
  AlertTriangle,
  Filter,
  Search,
  RefreshCw,
  Info,
  Link2,
  Link2Off,
  XCircle,
  CheckCircle2,
  Clock3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"

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

function statusClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("submitted")) return "bg-blue-50 text-blue-700 border-blue-200"
  if (s.includes("under_review")) return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (s.includes("needs_changes")) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function riskTextClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical")) return "text-red-700"
  if (s.includes("high")) return "text-amber-700"
  if (s.includes("med") || s.includes("moderate") || s.includes("medium")) return "text-yellow-700"
  if (s.includes("low")) return "text-emerald-700"
  return "text-slate-600"
}

function suggestedResultLabel(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "in_target") return "Effective"
  if (s === "warning") return "Warning"
  if (s === "out_of_target") return "Critical"
  if (s === "not_applicable" || s === "not-applicable") return "Not applicable"
  return "Pending"
}

function suggestedResultClass(v?: string | null) {
  const label = suggestedResultLabel(v).toLowerCase()
  if (label === "effective") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (label === "warning") return "bg-amber-50 text-amber-700 border-amber-200"
  if (label === "critical") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function finalResultLabel(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "approved") return "Effective"
  if (s === "needs_changes") return "Warning"
  if (s === "rejected") return "Critical"
  if (s === "submitted" || s === "under_review" || s === "pending") return "Pending"
  return "Pending"
}

function finalResultClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "needs_changes") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "rejected") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function hasFinalReviewerDecision(v?: string | null) {
  const s = (v || "").toLowerCase()
  return s === "approved" || s === "needs_changes" || s === "rejected"
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

function buildQS(sp: URLSearchParams) {
  const s = sp.toString()
  return s ? `?${s}` : ""
}

function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((v) => Number(v))
  if (!y || !m || m < 1 || m > 12) return yyyyMm
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[m - 1]}/${y}`
}

function formatDateBr(dateText?: string | null) {
  const raw = String(dateText ?? "").trim()
  if (!raw) return "—"

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, d] = match
    return `${d}/${m}/${y}`
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

function currentYYYYMM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  return `${y}-${m}`
}

type Props = {
  initialRows: GrcQueueRow[]
  months: string[]
  mesRef: string
}

type Decision = "approved" | "needs_changes" | "rejected"
type QueueFilterStatus = "all" | "submitted" | "warning" | "critical"
type RiskFilter = "all" | "critical" | "high" | "medium" | "low"
type EvidenceFilter = "all" | "with" | "without"

function defaultCommentFor(decision: Decision) {
  if (decision === "approved") return "Evidência validada."
  if (decision === "needs_changes") return "Necessário ajuste/complemento de evidência."
  return "Evidência/resultado reprovado."
}

export default function GrcQueueClient({ initialRows, months, mesRef }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentMonth = currentYYYYMM()
  const selectedMonth = mesRef || currentMonth
  const isCurrentMonth = selectedMonth === currentMonth

  function setMesRef(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value && value.trim()) sp.set("mes_ref", value)
    else sp.set("mes_ref", currentMonth)
    router.push(`${pathname}${buildQS(sp)}`)
  }

  function clearAllFilters() {
    setQ("")
    setStatus("all")
    setRisk("all")
    setEvidenceFilter("all")
    setOverdueOnly(false)
    setMesRef(currentMonth)
  }

  const qFromUrl = (searchParams.get("q") ?? "").trim()
  const statusFromUrl = (searchParams.get("status") ?? "").trim().toLowerCase()
  const riskFromUrl = (searchParams.get("risk") ?? "").trim().toLowerCase()
  const evidenceFromUrl = (searchParams.get("evidence") ?? "").trim().toLowerCase()
  const overdueFromUrl = (searchParams.get("overdue") ?? "").trim().toLowerCase()

  const initialStatus: QueueFilterStatus =
    statusFromUrl === "submitted" || statusFromUrl === "warning" || statusFromUrl === "critical"
      ? (statusFromUrl as QueueFilterStatus)
      : "all"
  const initialRisk: RiskFilter =
    riskFromUrl === "critical" || riskFromUrl === "high" || riskFromUrl === "medium" || riskFromUrl === "low"
      ? (riskFromUrl as RiskFilter)
      : "all"
  const initialEvidence: EvidenceFilter =
    evidenceFromUrl === "with" || evidenceFromUrl === "without"
      ? (evidenceFromUrl as EvidenceFilter)
      : "all"
  const initialOverdue = overdueFromUrl === "1" || overdueFromUrl === "true"

  // filtros
  const [q, setQ] = useState(qFromUrl)
  const [status, setStatus] = useState<QueueFilterStatus>(initialStatus)
  const [risk, setRisk] = useState<RiskFilter>(initialRisk)
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>(initialEvidence)
  const [overdueOnly, setOverdueOnly] = useState(initialOverdue)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

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
      critical: 0,
      warning: 0,
      withEvidence: 0,
      withoutEvidence: 0,
      overdue: 0,
    }
    for (const r of initialRows) {
      c.all++
      if (r.workflow_status === "submitted") c.submitted++
      if (r.workflow_status === "under_review") c.under_review++
      if (r.workflow_status === "needs_changes") c.needs_changes++
      const finalReview = (r.reviewer_decision ?? r.workflow_status ?? "").toLowerCase()
      if (finalReview === "rejected") c.critical++
      if (finalReview === "needs_changes") c.warning++
      if (r.has_evidence) c.withEvidence++
      else c.withoutEvidence++
      if (isOverdueDate(r.review_due_date)) c.overdue++
    }
    return c
  }, [initialRows])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()

    return initialRows.filter((r) => {
      const finalReview = (r.reviewer_decision ?? r.workflow_status ?? "").toLowerCase()
      const statusBucket: QueueFilterStatus =
        finalReview === "rejected"
          ? "critical"
          : finalReview === "needs_changes"
            ? "warning"
            : finalReview === "submitted"
              ? "submitted"
              : "all"
      const matchesText =
        !query ||
        `${r.control_code} ${r.control_name} ${r.kpi_code} ${r.kpi_name}`.toLowerCase().includes(query)

      const matchesStatus = status === "all" || statusBucket === status
      const matchesRisk = risk === "all" || (r.risk_level || "").toLowerCase() === risk

      const matchesEvidence =
        evidenceFilter === "all" ||
        (evidenceFilter === "with" ? r.has_evidence : !r.has_evidence)

      const matchesOverdue = !overdueOnly || isOverdueDate(r.review_due_date)

      return matchesText && matchesStatus && matchesRisk && matchesEvidence && matchesOverdue
    })
  }, [initialRows, q, status, risk, evidenceFilter, overdueOnly])

  const groupedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        control_code: string
        control_name: string
        risk_level: string | null
        items: GrcQueueRow[]
      }
    >()

    for (const r of rows) {
      const key = `${r.control_code}::${r.control_name}`
      const found = map.get(key)
      if (found) {
        found.items.push(r)
      } else {
        map.set(key, {
          key,
          control_code: r.control_code,
          control_name: r.control_name,
          risk_level: r.risk_level,
          items: [r],
        })
      }
    }

    return Array.from(map.values())
  }, [rows])

  const returnToHref = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("mes_ref", selectedMonth)
    if (q.trim()) sp.set("q", q.trim())
    if (status !== "all") sp.set("status", status)
    if (risk !== "all") sp.set("risk", risk)
    if (evidenceFilter !== "all") sp.set("evidence", evidenceFilter)
    if (overdueOnly) sp.set("overdue", "1")
    return `${pathname}${buildQS(sp)}`
  }, [pathname, selectedMonth, q, status, risk, evidenceFilter, overdueOnly])

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const isCollapsed = prev[groupKey] ?? true
      return { ...prev, [groupKey]: !isCollapsed }
    })
  }

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
    value: QueueFilterStatus
    label: string
    count: number
  }) {
    const active = status === value
    return (
      <button
        onClick={() => setStatus(value)}
        className={[
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white hover:bg-slate-50 border-slate-200",
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
    const base = tone === "red" ? "border-red-200" : "border-slate-200"

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
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
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
    <div className="space-y-6">
      {/* ✅ Summary cards (mantidos) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[140px] flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-slate-400">{counts.all > 0 ? "Ativo" : "—"}</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Itens na Fila</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.all}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[140px] flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2 text-blue-700 dark:text-blue-400">
              <Send className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Aguardando triagem</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Submitted</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.submitted}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[140px] flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Atenção</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Atenção</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.warning}</p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[140px] flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2 text-red-700 dark:text-red-400">
              <XCircle className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-red-700 dark:text-red-400">Não conformidade</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Não Conformidade</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts.critical}</p>
        </div>
      </div>

      {/* ✅ Head + ação (estilo template) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Fila de Revisão GRC</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Valide as execuções de KPIs e evidências anexadas por Control Owners / Pontos Focais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.refresh()}
            title="Atualizar lista"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ✅ Barra de filtros (template-like) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtros</span>

            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-2"
                onClick={clearAllFilters}
                title="Limpar filtros e voltar para o mês atual"
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
              <ToggleChip
                active={overdueOnly}
                label="Overdue"
                count={counts.overdue}
                tone="red"
                onClick={() => setOverdueOnly((v) => !v)}
              />
              <ToggleChip
                active={evidenceFilter === "without"}
                label="Sem evidência"
                count={counts.withoutEvidence}
                onClick={() => setEvidenceFilter((v) => (v === "without" ? "all" : "without"))}
              />
            </div>
          </div>

          {/* chips status */}
          <div className="flex flex-wrap gap-2">
            <StatusChip value="all" label="Todos" count={counts.all} />
            <StatusChip value="submitted" label="Submitted" count={counts.submitted} />
            <StatusChip value="warning" label="Atenção" count={counts.warning} />
            <StatusChip value="critical" label="Não conformidade" count={counts.critical} />
          </div>

          {/* inputs */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative w-full md:w-[420px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por controle, KPI, nome…"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <CalendarDays className="h-4 w-4" style={{ color: "var(--highlight)" }} />
                </div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setMesRef(e.target.value)}
                  className="h-10 w-[200px] rounded-lg border bg-white dark:bg-slate-900 pl-10 pr-3 text-sm font-medium outline-none transition-colors hover:border-slate-300 dark:hover:border-slate-600"
                  style={{
                    borderColor: "var(--highlight)",
                    boxShadow: "0 0 0 1px var(--highlight) inset",
                  }}
                  title="Mês de referência"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <span
                className={[
                  "inline-flex items-center h-10 px-3 rounded-lg text-xs font-semibold border select-none",
                  isCurrentMonth ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "",
                ].join(" ")}
                style={
                  !isCurrentMonth
                    ? {
                        backgroundColor: "color-mix(in srgb, var(--highlight) 12%, transparent)",
                        color: "var(--highlight)",
                        borderColor: "color-mix(in srgb, var(--highlight) 25%, transparent)",
                      }
                    : undefined
                }
                title={isCurrentMonth ? "Filtrando o mês atual" : "Filtrando um mês específico"}
              >
                {isCurrentMonth ? "MÊS ATUAL" : "ATIVO"}
              </span>
            </div>

            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value as RiskFilter)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Criticidade: Todas</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QueueFilterStatus)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Status: Todos</option>
              <option value="submitted">submitted</option>
              <option value="warning">atenção</option>
              <option value="critical">não conformidade</option>
            </select>

            <select
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value as any)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Evidências: Todas</option>
              <option value="with">Com evidência</option>
              <option value="without">Sem evidência</option>
            </select>

            <div className="text-sm text-slate-500 dark:text-slate-400 md:ml-auto">
              {rows.length} item(ns)
            </div>
          </div>

          {/* indicador de filtro ativo */}
          {(overdueOnly || evidenceFilter !== "all" || !isCurrentMonth) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {overdueOnly && (
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-red-50 text-red-700 border-red-200">
                  filtro: overdue only
                  <button
                    className="text-red-700/80 hover:text-red-900"
                    onClick={() => setOverdueOnly(false)}
                    type="button"
                  >
                    ✕
                  </button>
                </span>
              )}
              {!isCurrentMonth && (
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                  filtro: mês {formatMonthLabel(selectedMonth)}
                </span>
              )}
              {evidenceFilter !== "all" && (
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                  filtro: {evidenceFilter === "with" ? "com evidência" : "sem evidência"}
                  <button
                    className="text-slate-700/80 hover:text-slate-900"
                    onClick={() => setEvidenceFilter("all")}
                    type="button"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ✅ Tabela agrupada por controle no padrão visual das demais páginas */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark overflow-hidden shadow-sm">
        {groupedRows.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            Nenhum registro de execução no mês selecionado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
                  <th className="ui-table-th px-4 py-3 min-w-[320px]">Controle / KPI</th>
                  <th className="ui-table-th px-4 py-3 min-w-[180px]">Responsável (Owner)</th>
                  <th className="ui-table-th px-4 py-3 min-w-[130px]">Valor Executado</th>
                  <th className="ui-table-th px-4 py-3 min-w-[170px]">Evidências</th>
                  <th className="ui-table-th px-4 py-3 min-w-[150px]">Resultado Sugerido</th>
                  <th className="ui-table-th px-4 py-3 min-w-[140px]">Resultado Final</th>
                  <th className="ui-table-th px-4 py-3 min-w-[120px] text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
                {groupedRows.map((group) => {
                  const isCollapsed = collapsedGroups[group.key] ?? true
                  const hasPendingReview = group.items.some(
                    (item) => !hasFinalReviewerDecision(item.reviewer_decision ?? item.workflow_status)
                  )
                  return (
                    <Fragment key={group.key}>
                      <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                        <td colSpan={7} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                              title={isCollapsed ? "Expandir controle" : "Recolher controle"}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              Controle: {group.control_code} - {group.control_name} |{" "}
                              <span className={riskTextClass(group.risk_level)}>
                                Risk: {(group.risk_level || "sem risco").toUpperCase()}
                              </span>
                            </span>
                            <span
                              className={[
                                "ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                                hasPendingReview
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                              ].join(" ")}
                              title={
                                hasPendingReview
                                  ? "Existe KPI pendente de revisão neste controle"
                                  : "Todos os KPIs deste controle já foram revisados"
                              }
                            >
                              {hasPendingReview ? (
                                <>
                                  <Clock3 className="h-3.5 w-3.5" />
                                  Pendente
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Revisado
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed &&
                        group.items.map((r) => {
                          const overdue = isOverdueDate(r.review_due_date)
                          const ownerName = (r.control_owner_name || "").trim() || "Sem owner"
                          const ownerEmail = (r.control_owner_email || "").trim()
                          const valueText =
                            r.result_numeric === null || r.result_numeric === undefined
                              ? "—"
                              : `${Number(r.result_numeric)}`

                          return (
                            <tr
                              key={r.execution_id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{r.kpi_name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  ID: {r.kpi_code} · período: {formatDateBr(r.period_start)} → {formatDateBr(r.period_end)}
                                </div>
                                {overdue ? (
                                  <div className="mt-1 text-[11px] text-red-600">
                                    due: {formatDateBr(r.review_due_date)} (overdue)
                                  </div>
                                ) : r.review_due_date ? (
                                  <div className="mt-1 text-[11px] text-slate-500">due: {formatDateBr(r.review_due_date)}</div>
                                ) : null}
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-800 dark:text-slate-200">{ownerName}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{ownerEmail || "—"}</div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{valueText}</div>
                              </td>

                              <td className="px-4 py-3">
                                {r.has_evidence ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Vinculada ({r.evidence_count})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-red-50 text-red-700 border-red-200">
                                    <Link2Off className="h-3.5 w-3.5" />
                                    Pendente
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${suggestedResultClass(
                                    r.auto_status
                                  )}`}
                                  title="Resultado sugerido (auto status)"
                                >
                                  {suggestedResultLabel(r.auto_status)}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${finalResultClass(
                                    r.reviewer_decision ?? r.workflow_status
                                  )}`}
                                  title="Resultado final definido pelo revisor"
                                >
                                  {finalResultLabel(r.reviewer_decision ?? r.workflow_status)}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <Link
                                  href={`/revisoes/${r.execution_id}?returnTo=${encodeURIComponent(returnToHref)}`}
                                  className="inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                  {hasFinalReviewerDecision(r.reviewer_decision ?? r.workflow_status)
                                    ? "Ver Revisão"
                                    : "Iniciar Revisão"}
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dica: os itens são agrupados por controle, com KPIs que tiveram execução no mês de referência.
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Exibindo <span className="font-bold text-slate-900 dark:text-slate-200">{groupedRows.length}</span>{" "}
            controle(s) e <span className="font-bold text-slate-900 dark:text-slate-200">{rows.length}</span>{" "}
            KPI(s)
          </div>
        </div>
      </div>

      {/* ✅ Callout (template-like) */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-300 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <div className="font-semibold">Lógica de Resultado Sugerido</div>
          <div className="mt-1 text-xs opacity-80">
            O sistema sugere automaticamente o resultado com base no desvio da meta. KPIs em vermelho
            (Off Track) associados ao controle exigem revisão detalhada da evidência antes da aprovação.
          </div>
        </div>
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
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
