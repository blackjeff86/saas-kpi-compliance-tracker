// app/(app)/kpis/[id]/KpiExecutionClient.tsx
"use client"

import React, { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  CloudUpload,
  Eye,
  Loader2,
  Save,
  Search,
  Pencil,
  X,
  Circle,
  Plus,
} from "lucide-react"

import { formatDatePtBr } from "@/lib/utils"
import type { KpiDetail, KpiExecutionForMonth, KpiHistoryRow, ActionPlanForKpiRow } from "./actions"
import { upsertKpiExecutionForMonth, updateKpiConfig, createActionPlanForKpi } from "./actions"
import { computeAutoStatus } from "../../lib/auto-status"

function safe(v: any) {
  return String(v ?? "").trim()
}

function finiteNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null
  const raw = String(v).trim().replace(",", ".")
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function boolFromNumericValue(v: number | null | undefined): boolean | null {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v)) return null
  if (v === 1) return true
  if (v === 0) return false
  return null
}

function formatMonthLabel(yyyyMm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm
  const [y, m] = yyyyMm.split("-").map((x) => Number(x))
  const monthsPt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${monthsPt[(m || 1) - 1]}/${y}`
}

function getActiveTargetValueOnly(kpi: KpiDetail): number | null {
  const isActive = Boolean((kpi as any)?.is_active)
  if (!isActive) return null

  const v = (kpi as any)?.target_value
  if (v === null || v === undefined) return null

  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatMetaValueOnly(val?: number | null) {
  if (val === null || val === undefined) return "—"
  return String(val)
}

function autoStatusLabel(s?: string | null, targetOperator?: string | null) {
  const v = (s ?? "").toLowerCase()
  if (v === "in_target") return "Em Conformidade"
  if (v === "warning") return "Próximo da Meta"
  if (v === "out_of_target") {
    const op = (targetOperator ?? "").toString().toLowerCase()
    if (op === "lte" || op === "<=" || op.includes("menor") || op.includes("lower")) return "Acima da Meta"
    if (op === "gte" || op === ">=" || op.includes("maior") || op.includes("higher")) return "Abaixo da Meta"
    return "Fora da Meta"
  }
  if (v === "not_applicable") return "Não Aplicável"
  return "Aguardando Entrada"
}

function autoStatusBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (!s || s === "unknown") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "in_target") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s === "warning") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "out_of_target") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  if (s === "not_applicable") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

function autoStatusBoxClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (!s || s === "unknown") return "bg-amber-50 text-amber-700 border-amber-100"
  if (s === "in_target") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (s === "warning") return "bg-amber-50 text-amber-700 border-amber-100"
  if (s === "out_of_target") return "bg-red-50 text-red-700 border-red-100"
  if (s === "not_applicable") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function actionPlanStatusLabel(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (s === "not_started") return "Não iniciado"
  if (s === "in_progress") return "Em andamento"
  if (s === "completed" || s === "done") return "Concluído"
  if (s === "blocked") return "Bloqueado"
  if (s === "cancelled") return "Cancelado"
  return "—"
}

function actionPlanStatusBadge(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (s === "completed" || s === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "in_progress") return "bg-blue-50 text-blue-700 border-blue-200"
  if (s === "blocked" || s === "cancelled") return "bg-red-50 text-red-700 border-red-200"
  if (s === "not_started") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

// ✅ NOVO: status de revisão (coluna nova no banco: grc_review_status)
function reviewStatusNormalize(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (!s) return ""
  // aceita alguns legados
  if (s === "in_review") return "under_review"
  return s
}

function reviewStatusLabel(v?: string | null) {
  const s = reviewStatusNormalize(v)
  if (s === "submitted") return "Enviado para Revisão"
  if (s === "under_review") return "Em Revisão"
  if (s === "approved") return "Aprovado"
  if (s === "needs_changes") return "Ajustes Necessários"
  if (s === "rejected") return "Rejeitado"
  return "—"
}

function reviewStatusBadgeClass(v?: string | null) {
  const s = reviewStatusNormalize(v)
  if (s === "approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (s === "under_review") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  if (s === "submitted") return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
  if (s === "needs_changes") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
}

type KpiMetaType = "percent" | "number" | "boolean"
type KpiDirection = "higher_better" | "lower_better" | "yes_no"

type ActionPriority = "low" | "medium" | "high" | "critical"

export default function KpiExecutionClient(props: {
  kpi: KpiDetail
  mes_ref_used: string // YYYY-MM
  execution: KpiExecutionForMonth
  history: KpiHistoryRow[]
  actionPlans: ActionPlanForKpiRow[]
}) {
  const router = useRouter()
  const { kpi, mes_ref_used, execution, history, actionPlans } = props

  const [isPending, startTransition] = useTransition()

  const isActive = Boolean((kpi as any)?.is_active)
  const isBooleanKpi = String((kpi as any)?.kpi_type ?? "").toLowerCase() === "boolean"

  const [resultText, setResultText] = useState<string>(
    execution.result_numeric === null || execution.result_numeric === undefined ? "" : String(execution.result_numeric)
  )

  const [notes, setNotes] = useState<string>(execution.result_notes ?? "")
  const [msg, setMsg] = useState<string>("")
  const [err, setErr] = useState<string>("")
  const [q, setQ] = useState<string>("")

  const [configOpen, setConfigOpen] = useState(false)

  // ✅ Plano de ação (obrigatório quando fora da meta)
  const [apOpen, setApOpen] = useState(false)
  const [apTitle, setApTitle] = useState("")
  const [apDescription, setApDescription] = useState("")
  const [apResponsible, setApResponsible] = useState("")
  const [apDueDate, setApDueDate] = useState("") // yyyy-mm-dd
  const [apPriority, setApPriority] = useState<ActionPriority>("medium")

  // ✅ melhoria: se já existe plano de ação para o mês atual, não exigir novamente
  const [actionPlanRegistered, setActionPlanRegistered] = useState<boolean>(() => {
    const mr = safe(mes_ref_used)
    if (!mr) return false
    return (actionPlans ?? []).some((ap) => safe(ap.mes_ref) === mr)
  })

  const [metaType, setMetaType] = useState<KpiMetaType>(() => {
    const t = String((kpi as any)?.kpi_type ?? "").toLowerCase()
    if (t === "percent") return "percent"
    if (t === "boolean") return "boolean"
    if (t === "number") return "number"
    return "number"
  })

  const [direction, setDirection] = useState<KpiDirection>(() => {
    const t = String((kpi as any)?.kpi_type ?? "").toLowerCase()
    if (t === "boolean") return "yes_no"
    const op = (kpi.target_operator ?? "").toLowerCase()
    if (op === "lte" || op === "<=") return "lower_better"
    if (op === "gte" || op === ">=") return "higher_better"
    return "higher_better"
  })

  const activeTargetValue = useMemo(() => getActiveTargetValueOnly(kpi), [kpi])

  const activeTargetOperator = useMemo(() => {
    return isActive ? (kpi.target_operator ?? null) : null
  }, [isActive, kpi.target_operator])

  const [targetText, setTargetText] = useState<string>(() => {
    const initial = getActiveTargetValueOnly(kpi)
    return initial === null || initial === undefined ? "" : String(initial)
  })

  const [lastNumericTargetText, setLastNumericTargetText] = useState<string>(() => {
    const initial = getActiveTargetValueOnly(kpi)
    return initial === null || initial === undefined ? "" : String(initial)
  })
  const [lastBooleanTargetText, setLastBooleanTargetText] = useState<"0" | "1">(() => {
    const v = (kpi as any)?.target_value
    const n = Number(v)
    if (Number.isFinite(n) && (n === 0 || n === 1)) return String(n) as "0" | "1"
    return "1"
  })
  const [lastNonBooleanMetaType, setLastNonBooleanMetaType] = useState<KpiMetaType>(() => {
    const t = String((kpi as any)?.kpi_type ?? "").toLowerCase()
    return t === "percent" ? "percent" : "number"
  })

  const [warningPctText, setWarningPctText] = useState<string>(() => {
    const pct = finiteNumberOrNull((kpi as any).warning_buffer_pct)
    if (pct !== null) return String((pct * 100).toFixed(0))
    return "5"
  })

  const targetNumericDraft = useMemo(() => {
    const t = safe(targetText)
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }, [targetText])

  const warningPctDraft = useMemo(() => {
    const t = safe(warningPctText)
    if (!t) return 0.05
    const n = Number(t)
    if (!Number.isFinite(n)) return 0.05
    const pct = n / 100
    return Math.min(Math.max(pct, 0), 0.5)
  }, [warningPctText])

  const toleranceWarningPct = useMemo(() => {
    const pct = finiteNumberOrNull((kpi as any).warning_buffer_pct)
    if (pct === null) return null
    return Number((pct * 100).toFixed(0))
  }, [kpi])

  // ✅ manter actionPlanRegistered coerente se props mudarem
  useEffect(() => {
    const mr = safe(mes_ref_used)
    const has = (actionPlans ?? []).some((ap) => safe(ap.mes_ref) === mr)
    setActionPlanRegistered(has)
  }, [actionPlans, mes_ref_used])

  useEffect(() => {
    const nextTypeRaw = String((kpi as any)?.kpi_type ?? "").toLowerCase()
    const nextMetaType: KpiMetaType =
      nextTypeRaw === "percent" ? "percent" : nextTypeRaw === "boolean" ? "boolean" : "number"
    const nextDirection: KpiDirection =
      nextMetaType === "boolean"
        ? "yes_no"
        : (kpi.target_operator ?? "").toLowerCase() === "lte" || (kpi.target_operator ?? "").toLowerCase() === "<="
          ? "lower_better"
          : "higher_better"

    const currentTarget = getActiveTargetValueOnly(kpi)
    const nextBooleanText: "0" | "1" = Number((kpi as any)?.target_value) === 0 ? "0" : "1"
    const nextNumericText = currentTarget === null || currentTarget === undefined ? "" : String(currentTarget)

    const savedWarning = finiteNumberOrNull((kpi as any)?.warning_buffer_pct)
    const nextWarningText = savedWarning === null ? "5" : String((savedWarning * 100).toFixed(0))

    setMetaType(nextMetaType)
    setDirection(nextDirection)
    setLastNonBooleanMetaType(nextMetaType === "percent" ? "percent" : "number")
    setLastBooleanTargetText(nextBooleanText)
    setLastNumericTargetText(nextNumericText)
    setTargetText(nextMetaType === "boolean" ? nextBooleanText : nextNumericText)
    setWarningPctText(nextWarningText)
  }, [kpi])

  const resultNumeric = useMemo(() => {
    const t = safe(resultText)
    if (!t) return null
    const normalized = t.replace(",", ".")
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }, [resultText])

  const liveStatus = useMemo(() => {
    if (!isActive) return "unknown"
    return computeAutoStatus(
      {
        kpi_type: (kpi as any)?.kpi_type ?? null,
        target_operator: activeTargetOperator,
        target_value: activeTargetValue,
      },
      {
        result_numeric: resultNumeric,
        result_boolean: isBooleanKpi ? boolFromNumericValue(resultNumeric) : null,
      },
      finiteNumberOrNull((kpi as any).warning_buffer_pct) ?? 0.05
    )
  }, [
    isActive,
    isBooleanKpi,
    (kpi as any)?.kpi_type,
    activeTargetOperator,
    activeTargetValue,
    (kpi as any).warning_buffer_pct,
    resultNumeric,
  ])

  const shouldRequireActionPlan = useMemo(() => {
    return String(liveStatus).toLowerCase() === "out_of_target"
  }, [liveStatus])

  const filteredHistory = useMemo(() => {
    const qq = safe(q).toLowerCase()
    if (!qq) return history
    return history.filter((h) => {
      const p = safe(h.period_start)
      return (
        p.toLowerCase().includes(qq) || (p ? formatMonthLabel(p.slice(0, 7)).toLowerCase().includes(qq) : false)
      )
    })
  }, [q, history])

  function openActionPlanModal() {
    setErr("")
    setMsg("")

    setApTitle("")
    setApDescription("")
    setApResponsible("")
    setApDueDate("")
    setApPriority("medium")

    setApOpen(true)
  }

  function validateActionPlan() {
    if (!safe(apTitle)) return "Informe o título do plano de ação."
    if (!safe(apDueDate)) return "Informe a data estimada de conclusão."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safe(apDueDate))) return "Data inválida. Use o formato AAAA-MM-DD."
    return null
  }

  function validateResult() {
    const t = safe(resultText)
    if (!t) return null
    const normalized = t.replace(",", ".")
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return "Resultado inválido. Use apenas números (ex: 96.5 ou 96,5)."
    return null
  }

  async function doSaveExecutionOnly() {
    const v = validateResult()
    if (v) {
      setErr(v)
      return
    }

    const parsed = resultNumeric

    startTransition(async () => {
      try {
        const resp = await upsertKpiExecutionForMonth({
          kpiId: kpi.kpi_id,
          mes_ref: mes_ref_used,
          result_numeric: parsed,
          result_notes: safe(notes) ? notes : null,
        })

        // ✅ se o backend já devolver grc_review_status, mostramos também
        const grc = reviewStatusNormalize((resp as any)?.grc_review_status)
        if (grc === "submitted") {
          setMsg(`Salvo com sucesso. Execução: ${resp.executionId ?? "OK"}. Enviado para Revisão.`)
        } else {
          setMsg(`Salvo com sucesso. Execução: ${resp.executionId ?? "OK"}`)
        }

        router.refresh()
      } catch (e: any) {
        setErr(e?.message || "Falha ao salvar execução.")
      }
    })
  }

  async function onSave() {
    setMsg("")
    setErr("")

    // ✅ regra: se fora da meta, obrigatório ter AP (mas se já existe AP no mês, segue)
    if (shouldRequireActionPlan && !actionPlanRegistered) {
      openActionPlanModal()
      return
    }

    await doSaveExecutionOnly()
  }

  async function onSaveActionPlanOnly() {
    setErr("")
    setMsg("")

    const vPlan = validateActionPlan()
    if (vPlan) {
      setErr(vPlan)
      return
    }

    const finalDescription = safe(apDescription) ? safe(apDescription) : null

    startTransition(async () => {
      try {
        const ap = await createActionPlanForKpi({
          execution_id: execution.execution_id ?? null,
          control_id: kpi.control_id,
          kpi_id: kpi.kpi_id,
          title: safe(apTitle),
          description: finalDescription,
          responsible: safe(apResponsible) ? safe(apResponsible) : null,
          due_date: safe(apDueDate),
          priority: apPriority,
        })

        setApOpen(false)
        setActionPlanRegistered(true)

        setMsg(`Plano de Ação criado (${ap?.id ?? "OK"}).`)
      } catch (e: any) {
        setErr(e?.message || "Falha ao salvar plano de ação.")
      }
    })
  }

  function handleMetaTypeChange(next: KpiMetaType) {
    if (metaType === "boolean" || direction === "yes_no") {
      const b = safe(targetText) === "0" ? "0" : "1"
      setLastBooleanTargetText(b)
    } else {
      setLastNumericTargetText(targetText)
      setLastNonBooleanMetaType(metaType)
    }

    if (next === "boolean") {
      setMetaType("boolean")
      setDirection("yes_no")
      setTargetText(lastBooleanTargetText || "1")
      return
    }

    setMetaType(next)
    setLastNonBooleanMetaType(next)

    if (direction === "yes_no") {
      setDirection("higher_better")
    }

    const restore = safe(lastNumericTargetText) ? lastNumericTargetText : ""
    setTargetText(restore)
  }

  function handleDirectionChange(next: KpiDirection) {
    if (metaType !== "boolean" && direction !== "yes_no") {
      setLastNumericTargetText(targetText)
      setLastNonBooleanMetaType(metaType)
    } else if (metaType === "boolean" || direction === "yes_no") {
      const b = safe(targetText) === "0" ? "0" : "1"
      setLastBooleanTargetText(b)
    }

    if (next === "yes_no") {
      if (metaType !== "boolean") {
        setLastNumericTargetText(targetText)
        setLastNonBooleanMetaType(metaType)
      }
      setDirection("yes_no")
      setMetaType("boolean")
      setTargetText(lastBooleanTargetText || "1")
      return
    }

    setDirection(next)

    if (metaType === "boolean") {
      const restoreType = lastNonBooleanMetaType === "percent" ? "percent" : "number"
      setMetaType(restoreType)
      const restore = safe(lastNumericTargetText) ? lastNumericTargetText : ""
      setTargetText(restore)
    }
  }

  const previewOperator = useMemo(() => {
    if (direction === "lower_better") return "lte"
    if (direction === "higher_better") return "gte"
    return "eq"
  }, [direction])

  const previewStatus = useMemo(() => {
    const previewIsBoolean = metaType === "boolean" || direction === "yes_no"
    return computeAutoStatus(
      {
        kpi_type: previewIsBoolean ? "boolean" : metaType,
        target_operator: previewIsBoolean ? "eq" : previewOperator,
        target_value: targetNumericDraft,
      },
      {
        result_numeric: resultNumeric,
        result_boolean: previewIsBoolean ? boolFromNumericValue(resultNumeric) : null,
      },
      warningPctDraft
    )
  }, [metaType, direction, previewOperator, targetNumericDraft, resultNumeric, warningPctDraft])

  const configHasErrors = useMemo(() => {
    if (metaType === "boolean" || direction === "yes_no") return false

    if (safe(targetText) && targetNumericDraft === null) return true

    if (safe(warningPctText)) {
      const n = Number(warningPctText)
      if (!Number.isFinite(n)) return true
      if (n < 0 || n > 50) return true
    }
    return false
  }, [metaType, direction, targetText, targetNumericDraft, warningPctText])

  function onSaveConfig() {
    setErr("")
    setMsg("")
    if (configHasErrors) {
      setErr("Corrija os campos inválidos no modal antes de salvar.")
      return
    }

    const op: "gte" | "lte" | "eq" =
      direction === "lower_better" ? "lte" : direction === "higher_better" ? "gte" : "eq"

    const kpiType: "percent" | "number" | "boolean" =
      metaType === "percent" ? "percent" : metaType === "boolean" || direction === "yes_no" ? "boolean" : "number"

    const isBool = kpiType === "boolean"

    const target_boolean = isBool ? safe(targetText) !== "0" : null
    const target_value = isBool ? null : targetNumericDraft

    startTransition(async () => {
      try {
        await updateKpiConfig({
          kpiId: kpi.kpi_id,
          kpi_type: kpiType,
          target_operator: op,
          target_value: target_value,
          target_boolean: target_boolean,
          warning_buffer_pct: warningPctDraft,
        })

        setConfigOpen(false)
        setMsg("Configuração do KPI salva no banco com sucesso.")
        router.refresh()
      } catch (e: any) {
        setErr(e?.message || "Falha ao salvar configuração do KPI.")
      }
    })
  }

  const execReviewStatus = reviewStatusNormalize((execution as any)?.grc_review_status)

  return (
    <div className="space-y-6">
      {/* KPI Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <span className="text-2xl font-black">KPI</span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">{kpi.kpi_name}</h1>

              <p className="text-slate-500 flex items-center gap-2 text-sm mt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="text-slate-400">Frequência:</span> {kpi.control_frequency ?? "—"}
                </span>
                <span className="mx-2">•</span>
                Meta: <span className="font-semibold text-slate-700">{formatMetaValueOnly(activeTargetValue)}</span>
              </p>

              <div className="text-xs text-slate-400 mt-2 font-mono">
                {kpi.kpi_code} •{" "}
                <Link
                  className="underline hover:text-primary"
                  href={`/controles/${kpi.control_id}?mes_ref=${encodeURIComponent(mes_ref_used)}`}
                >
                  Controle: {kpi.control_code}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Período de Referência</p>
              <p className="text-lg font-semibold">{formatMonthLabel(mes_ref_used)}</p>
            </div>

            <div className="h-12 w-px bg-slate-200" />

            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Status Automático (salvo)</p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${autoStatusBadge(
                  execution.auto_status
                )}`}
              >
                <span className="w-2 h-2 rounded-full mr-2 bg-current opacity-60" />
                {autoStatusLabel(execution.auto_status, kpi.target_operator)}
              </span>

              {/* ✅ NOVO: status de revisão (se existir no payload) */}
              {execReviewStatus ? (
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${reviewStatusBadgeClass(
                      execReviewStatus
                    )}`}
                    title="Status de revisão GRC"
                  >
                    {reviewStatusLabel(execReviewStatus)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {err ? (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{err}</span>
        </div>
      ) : null}

      {msg ? (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5" />
          <span>{msg}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Registrar Resultado do Período</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Período selecionado: <span className="font-semibold">{formatMonthLabel(mes_ref_used)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={onSave}
                disabled={isPending}
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-95 transition disabled:opacity-60"
                title={shouldRequireActionPlan ? "Obrigatório criar Plano de Ação para salvar" : "Salvar alterações"}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {shouldRequireActionPlan ? "Salvar (exige Plano de Ação)" : "Salvar"}
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resultado */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Resultado Alcançado</label>

                  <div className="relative">
                    <input
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder={isBooleanKpi ? "1 (Sim) ou 0 (Não)" : "Ex: 96.5"}
                      step={isBooleanKpi ? "1" : "0.01"}
                      type="number"
                      value={resultText}
                      onChange={(e) => setResultText(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">#</div>
                  </div>

                  {safe(resultText) && resultNumeric === null ? (
                    <p className="text-xs text-red-600">Valor inválido.</p>
                  ) : (
                    <p className="text-xs text-slate-400">Dica: você pode deixar vazio se ainda não tem o resultado do mês.</p>
                  )}
                </div>

                {/* Status calculado (AO VIVO) */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Status Calculado</label>
                  <div className={`h-[50px] flex items-center px-4 rounded-lg border font-medium ${autoStatusBoxClass(liveStatus)}`}>
                    <CheckCircle2 className="w-4 h-4 mr-2 opacity-80" />
                    {autoStatusLabel(liveStatus, activeTargetOperator)}
                  </div>
                  <p className="text-xs text-slate-400">
                    Faixa de warning: meta até{" "}
                    {(((finiteNumberOrNull((kpi as any).warning_buffer_pct) ?? 0.05) as number) * 100).toFixed(0)}.{" "}
                    {isActive ? "" : "KPI desativado (is_active=false): meta ignorada."}
                  </p>
                </div>
              </div>

              {/* obrigatório quando fora da meta */}
              {shouldRequireActionPlan ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-red-800">
                        KPI {autoStatusLabel("out_of_target", activeTargetOperator).toLowerCase()}
                      </p>
                      <p className="text-sm text-red-700 mt-0.5">
                        É obrigatório registrar um plano de ação, pois este KPI está{" "}
                        {autoStatusLabel("out_of_target", activeTargetOperator).toLowerCase()} esperada.
                      </p>

                      {actionPlanRegistered ? (
                        <p className="text-xs text-red-700/80 mt-1">
                          Já existe plano de ação cadastrado para este mês — você pode salvar o KPI.
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={openActionPlanModal}
                      className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-red-700 text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
                    >
                      <Pencil className="w-4 h-4" />
                      Criar Plano de Ação
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Evidência (placeholder) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Evidência (Upload)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-primary/50 transition-colors bg-slate-50 group cursor-not-allowed text-center opacity-80">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <CloudUpload className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Upload ainda não implementado (vamos plugar depois)</p>
                  <p className="text-xs text-slate-400 mt-1">Formatos: PDF, XLSX, PNG (Máx 10MB)</p>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Comentários e Observações</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="Descreva os fatores que influenciaram este resultado..."
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Side Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-slate-900">Informações de Apoio</h3>

              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2 py-2 text-slate-600"
                title="Configurar cálculo do KPI"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  {kpi.kpi_description?.trim() ? kpi.kpi_description : "Sem descrição cadastrada para este KPI."}
                </p>
              </div>

              {isBooleanKpi ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="font-semibold">Dica (Sim/Não):</span> preencha <b>Sim = 1</b> e <b>Não = 0</b>.
                </div>
              ) : null}

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs font-bold text-primary uppercase mb-2">Meta configurada</p>
                <p className="text-sm font-mono text-slate-700">{formatMetaValueOnly(activeTargetValue)}</p>
                {!isActive ? <p className="text-xs text-slate-500 mt-2">KPI desativado: meta ignorada.</p> : null}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Régua de Tolerância</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
                      Conforme (Green)
                    </span>
                    <span className="font-semibold">
                      {activeTargetOperator === "gte" || activeTargetOperator === ">="
                        ? `>= ${activeTargetValue ?? "—"}%`
                        : `<= ${activeTargetValue ?? "—"}%`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      Atenção (Warning)
                    </span>
                    <span className="font-semibold">
                      {toleranceWarningPct !== null && Number.isFinite(toleranceWarningPct)
                        ? `${Math.max(0, toleranceWarningPct).toFixed(0)}% - ${activeTargetValue ?? "—"}%`
                        : "Faixa configurada"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />
                      Crítico (Critical)
                    </span>
                    <span className="font-semibold">
                      {activeTargetOperator === "gte" || activeTargetOperator === ">="
                        ? `< ${toleranceWarningPct ?? "—"}%`
                        : `> ${toleranceWarningPct ?? "—"}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-6 text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--primary), #1D4ED8)" }}
          >
            <h3 className="font-bold mb-2">Próxima Revisão</h3>
            <p className="text-blue-100 text-sm mb-4">Placeholder: depois calculamos pela frequência.</p>
            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <span className="font-bold">{formatMonthLabel(mes_ref_used)}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Plano de Ação</h3>
              <Link
                href={`/action-plans?kpi_id=${encodeURIComponent(kpi.kpi_id)}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>

            {actionPlans.length === 0 ? (
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                <p className="text-xs font-bold text-rose-600">Pendente: Revisão de Processo</p>
                <p className="mt-1 text-[11px] text-rose-500">
                  Crie um novo plano para acompanhamento do desvio identificado.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionPlans.slice(0, 3).map((ap) => (
                  <Link
                    key={ap.id}
                    href={`/action-plans/${encodeURIComponent(ap.id)}`}
                    className="block rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors p-3"
                    title={`Abrir plano ${ap.title}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{ap.title || "Sem título"}</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${actionPlanStatusBadge(
                          ap.status
                        )}`}
                      >
                        {actionPlanStatusLabel(ap.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                      {ap.description?.trim() || "Sem descrição."}
                    </p>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {ap.due_date ? `Prazo: ${formatDatePtBr(ap.due_date)}` : "Prazo: —"}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={openActionPlanModal}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Plano de Ação */}
      {apOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApOpen(false)} aria-hidden="true" />

          <div className="relative z-10 w-[95vw] max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 truncate">Plano de Ação</h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  KPI <span className="font-mono">{kpi.kpi_code}</span> • {formatMonthLabel(mes_ref_used)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setApOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2 py-2 text-slate-600"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {shouldRequireActionPlan ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  É obrigatório registrar um plano de ação, pois este KPI está{" "}
                  {autoStatusLabel("out_of_target", activeTargetOperator).toLowerCase()} esperada.
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Título</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  value={apTitle}
                  onChange={(e) => setApTitle(e.target.value)}
                  placeholder="Ex.: Ajustar checklist da coleta de evidências"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Descrição do plano de ação</label>
                <textarea
                  className="w-full min-h-[110px] bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                  value={apDescription}
                  onChange={(e) => setApDescription(e.target.value)}
                  placeholder="Descreva as ações que serão executadas para recuperar o KPI."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Responsável pela execução</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  value={apResponsible}
                  onChange={(e) => setApResponsible(e.target.value)}
                  placeholder="Ex.: maria@empresa.com ou Maria Silva"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Data estimada de conclusão</label>
                  <input
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    type="date"
                    value={apDueDate}
                    onChange={(e) => setApDueDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">Obrigatório.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Prioridade</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    value={apPriority}
                    onChange={(e) => setApPriority(e.target.value as ActionPriority)}
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
                  onClick={() => setApOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={onSaveActionPlanOnly}
                  disabled={isPending}
                  className={[
                    "px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium transition",
                    isPending ? "opacity-60 cursor-not-allowed" : "hover:opacity-95",
                  ].join(" ")}
                  title="Salvar"
                >
                  {isPending ? "Salvando..." : "Salvar Plano de Ação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal para Configuração do KPI */}
      {configOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfigOpen(false)} aria-hidden="true" />

          <div className="relative z-10 w-[95vw] max-w-3xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 truncate">Configuração do KPI</h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Defina meta, tipo e regra de cálculo (operador + faixa de warning)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2 py-2 text-slate-600"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">KPI</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{kpi.kpi_name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{kpi.kpi_code}</p>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Meta atual (salva)</p>
                  <p className="text-sm font-mono text-slate-900 mt-1">{formatMetaValueOnly(activeTargetValue)}</p>
                  <p className="text-xs text-slate-500 mt-1">Salvar configuração atualiza kpis e registra audit.</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  Aqui você vai definir: <span className="font-mono">meta</span> + <span className="font-mono">tipo</span>{" "}
                  (%, número, sim/não) + <span className="font-mono">faixa de warning</span> +{" "}
                  <span className="font-mono">direção</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Meta */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Meta (target_value)</label>

                  {metaType === "boolean" ? (
                    <select
                      className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      value={safe(targetText) === "0" ? "0" : "1"}
                      onChange={(e) => setTargetText(e.target.value)}
                    >
                      <option value="1">Sim (True)</option>
                      <option value="0">Não (False)</option>
                    </select>
                  ) : (
                    <input
                      className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder={metaType === "percent" ? "Ex: 98 (para 98%)" : "Ex: 10"}
                      type="number"
                      step="0.01"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                    />
                  )}

                  {safe(targetText) && metaType !== "boolean" && targetNumericDraft === null ? (
                    <p className="text-xs text-red-600">Meta inválida.</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {metaType === "percent"
                        ? "Dica: use 98 para 98%."
                        : metaType === "number"
                          ? "Use número normal."
                          : "Escolha Sim/Não."}
                    </p>
                  )}
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Tipo do KPI</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    value={metaType}
                    onChange={(e) => handleMetaTypeChange(e.target.value as KpiMetaType)}
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="number">Numérico</option>
                    <option value="boolean">Sim / Não</option>
                  </select>
                </div>

                {/* Warning buffer */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Faixa de Warning (amarelo)</label>
                  <div className="relative">
                    <input
                      className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-3 pr-10 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="Ex: 5"
                      type="number"
                      step="0.1"
                      value={warningPctText}
                      onChange={(e) => setWarningPctText(e.target.value)}
                      disabled={metaType === "boolean"}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">%</div>
                  </div>
                  <p className="text-xs text-slate-500">Ex.: 5 = 5% (0 a 50)</p>
                </div>

                {/* Direção */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Regra</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    value={direction}
                    onChange={(e) => handleDirectionChange(e.target.value as KpiDirection)}
                  >
                    <option value="higher_better">Quanto maior, melhor</option>
                    <option value="lower_better">Quanto menor, melhor</option>
                    <option value="yes_no">Sim / Não</option>
                  </select>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase">Prévia do cálculo</p>
                    <p className="text-sm text-slate-700 mt-1">
                      Operador: <span className="font-mono">{direction === "yes_no" ? "boolean" : previewOperator}</span> • Meta:{" "}
                      <span className="font-mono">
                        {metaType === "boolean" ? (safe(targetText) === "0" ? "Não" : "Sim") : targetNumericDraft ?? "—"}
                      </span>{" "}
                      • Warning: <span className="font-mono">{(warningPctDraft * 100).toFixed(1)}%</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Obs: a prévia usa o valor do campo “Resultado Alcançado”.</p>
                  </div>

                  <div className={`shrink-0 h-[42px] px-4 rounded-lg border flex items-center font-semibold ${autoStatusBoxClass(previewStatus)}`}>
                    {autoStatusLabel(previewStatus, previewOperator)}
                  </div>
                </div>

                {configHasErrors ? <p className="text-xs text-red-600 mt-2">Corrija os campos inválidos.</p> : null}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={onSaveConfig}
                  disabled={configHasErrors || isPending}
                  className={[
                    "px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium transition",
                    configHasErrors || isPending ? "opacity-60 cursor-not-allowed" : "hover:opacity-95",
                  ].join(" ")}
                  title={configHasErrors ? "Corrija os campos inválidos" : "Salvar configuração"}
                >
                  {isPending ? "Salvando..." : "Salvar configuração"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Histórico de Execuções</h2>
            <p className="text-sm text-slate-500">Últimas 5 medições registradas para este indicador</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Buscar período..."
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F2F6FF]">
                <th className="ui-table-th px-6 py-4">Período</th>
                <th className="ui-table-th px-6 py-4">Valor</th>
                <th className="ui-table-th px-6 py-4">Status</th>
                <th className="ui-table-th px-6 py-4">Data registro</th>
                <th className="ui-table-th px-6 py-4 text-left">Ações</th>
              </tr>
            </thead>

            <tbody className="ui-table-tbody divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-sm text-slate-500">
                    Nenhuma execução encontrada.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.execution_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">
                      {h.period_start ? formatMonthLabel(h.period_start.slice(0, 7)) : "—"}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {h.result_numeric === null || h.result_numeric === undefined ? "—" : h.result_numeric}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${autoStatusBadge(h.auto_status)}`}>
                        {autoStatusLabel(h.auto_status, kpi.target_operator)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{h.created_at ? formatDatePtBr(h.created_at) : "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        className="text-primary hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1 justify-end"
                        href={`/execucoes/${h.execution_id}`}
                        title="Ver execução"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-center">
          <Link
            href={`/execucoes?kpi_id=${encodeURIComponent(kpi.kpi_id)}`}
            className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors flex items-center gap-2"
            title="Placeholder"
          >
            Carregar histórico completo
          </Link>
        </div>
      </div>
    </div>
  )
}
