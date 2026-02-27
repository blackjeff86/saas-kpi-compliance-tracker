// app/(app)/revisoes/[id]/ReviewDetailClient.tsx
"use client"

import React, { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  ArrowLeft,
  Loader2,
  BadgeCheck,
  ShieldAlert,
  CircleDashed,
  Plus,
  Circle,
  X,
} from "lucide-react"

import { formatDatePtBr } from "@/lib/utils"
import type { ReviewDetail } from "./actions"
import { finalizeReview } from "./actions"
import { createActionPlanForKpi } from "../../kpis/[id]/actions"

function safe(v: any) {
  return String(v ?? "").trim()
}

function statusLabel(s?: string | null) {
  const v = safe(s).toLowerCase()
  if (v === "submitted") return "Enviado para Revisão"
  if (v === "under_review") return "Em Revisão"
  if (v === "approved") return "Aprovado"
  if (v === "needs_changes") return "Ajustes Necessários"
  if (v === "rejected") return "Rejeitado"
  return "—"
}

function statusBadgeClass(s?: string | null) {
  const v = safe(s).toLowerCase()
  if (v === "approved") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (v === "under_review") return "bg-blue-100 text-blue-700 border-blue-200"
  if (v === "submitted") return "bg-indigo-100 text-indigo-700 border-indigo-200"
  if (v === "needs_changes") return "bg-amber-100 text-amber-700 border-amber-200"
  if (v === "rejected") return "bg-red-100 text-red-700 border-red-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function statusIcon(s?: string | null) {
  const v = safe(s).toLowerCase()
  if (v === "approved") return <BadgeCheck className="w-4 h-4" />
  if (v === "rejected") return <ShieldAlert className="w-4 h-4" />
  if (v === "needs_changes") return <AlertCircle className="w-4 h-4" />
  return <CircleDashed className="w-4 h-4" />
}

function autoStatusLabel(s?: string | null, targetOperator?: string | null) {
  const v = safe(s).toLowerCase()
  if (v === "in_target") return "Em Conformidade"
  if (v === "warning") return "Próximo da Meta"
  if (v === "out_of_target") {
    const op = safe(targetOperator).toLowerCase()
    if (op === "lte" || op === "<=") return "Acima da Meta"
    if (op === "gte" || op === ">=") return "Abaixo da Meta"
    return "Fora da Meta"
  }
  if (v === "not_applicable") return "Não Aplicável"
  return "Aguardando Entrada"
}

function autoStatusBadge(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (!s || s === "unknown") return "bg-amber-100 text-amber-700"
  if (s === "in_target") return "bg-emerald-100 text-emerald-700"
  if (s === "warning") return "bg-amber-100 text-amber-700"
  if (s === "out_of_target") return "bg-red-100 text-red-700"
  if (s === "not_applicable") return "bg-slate-100 text-slate-700"
  return "bg-slate-100 text-slate-700"
}

function formatPercentOrDash(v?: number | null) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—"
  return `${v}%`
}

function actionPlanStatusLabel(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (s === "not_started") return "Não iniciado"
  if (s === "in_progress") return "Em andamento"
  if (s === "completed") return "Concluído"
  if (s === "blocked") return "Bloqueado"
  if (s === "cancelled") return "Cancelado"
  return "—"
}

function actionPlanStatusBadge(v?: string | null) {
  const s = safe(v).toLowerCase()
  if (s === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s === "in_progress") return "bg-blue-50 text-blue-700 border-blue-200"
  if (s === "blocked" || s === "cancelled") return "bg-red-50 text-red-700 border-red-200"
  if (s === "not_started") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

type ReviewDecision = "approved" | "needs_changes" | "rejected" | "under_review"
type ActionPriority = "low" | "medium" | "high" | "critical"
type KpiDataType = "boolean" | "percent" | "number"

function reviewDecisionControlLabel(v: ReviewDecision) {
  if (v === "approved") return "Effective"
  if (v === "needs_changes") return "Warning"
  if (v === "rejected") return "Critical"
  return "Pending"
}

function reviewDecisionValueClass(v: ReviewDecision) {
  if (v === "approved") return "text-emerald-600"
  if (v === "needs_changes") return "text-amber-600"
  if (v === "rejected") return "text-red-600"
  return "text-slate-600"
}

function normalizeKpiDataType(v?: string | null): KpiDataType {
  const s = safe(v).toLowerCase()
  if (s === "boolean") return "boolean"
  if (s === "percent") return "percent"
  return "number"
}

function formatValueByType(v: number | null | undefined, type: KpiDataType) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—"
  if (type === "boolean") {
    if (v === 1) return "Sim"
    if (v === 0) return "Não"
    return String(v)
  }
  if (type === "percent") return `${v}%`
  return String(v)
}

function decisionFromAutoStatus(autoStatus?: string | null): ReviewDecision {
  const s = safe(autoStatus).toLowerCase()
  if (s === "in_target") return "approved"
  if (s === "warning") return "needs_changes"
  if (s === "out_of_target") return "rejected"
  return "under_review"
}

function computeAutomaticDecision(args: {
  value: number | null
  targetOperator?: string | null
  targetValue?: number | null
  warningBufferPct?: number | null
  autoStatus?: string | null
}): ReviewDecision {
  const value = args.value
  const op = safe(args.targetOperator).toLowerCase()
  const target = args.targetValue
  const bufferRaw = args.warningBufferPct
  const buffer = Number.isFinite(bufferRaw as number) ? Number(bufferRaw) : null

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return decisionFromAutoStatus(args.autoStatus)
  }
  if (target === null || target === undefined || !Number.isFinite(target)) {
    return decisionFromAutoStatus(args.autoStatus)
  }

  if (op === "gte" || op === ">=") {
    if (value >= target) return "approved"
    const warningFloor = buffer === null ? null : target * (1 - Math.max(0, buffer))
    if (warningFloor !== null && value >= warningFloor) return "needs_changes"
    return "rejected"
  }

  if (op === "lte" || op === "<=") {
    if (value <= target) return "approved"
    const warningCeiling = buffer === null ? null : target * (1 + Math.max(0, buffer))
    if (warningCeiling !== null && value <= warningCeiling) return "needs_changes"
    return "rejected"
  }

  if (op === "eq" || op === "=") {
    return value === target ? "approved" : "rejected"
  }

  return decisionFromAutoStatus(args.autoStatus)
}

export default function ReviewDetailClient({ detail }: { detail: ReviewDetail }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  const exec = detail.execution
  const kpi = detail.kpi
  const control = detail.control

  const baseDeclaredValue = exec.result_numeric
  const declaredNotes = exec.result_notes
  const adjustedReviewValue = (exec as any)?.reviewer_adjusted_result_numeric

  const [reviewValueText, setReviewValueText] = useState<string>(
    adjustedReviewValue !== null && adjustedReviewValue !== undefined
      ? String(adjustedReviewValue)
      : baseDeclaredValue !== null && baseDeclaredValue !== undefined
        ? String(baseDeclaredValue)
        : ""
  )

  const [reviewerNotes, setReviewerNotes] = useState<string>(exec.reviewer_notes ?? "")
  const [apOpen, setApOpen] = useState(false)
  const [apTitle, setApTitle] = useState("")
  const [apDescription, setApDescription] = useState("")
  const [apResponsible, setApResponsible] = useState("")
  const [apDueDate, setApDueDate] = useState("")
  const [apPriority, setApPriority] = useState<ActionPriority>("medium")

  const reviewValueNumeric = useMemo(() => {
    const t = safe(reviewValueText)
    if (!t) return null
    const n = Number(t.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }, [reviewValueText])

  const automaticDecision = useMemo<ReviewDecision>(() => {
    return computeAutomaticDecision({
      value: reviewValueNumeric,
      targetOperator: kpi.target_operator,
      targetValue: kpi.target_value,
      warningBufferPct: kpi.warning_buffer_pct,
      autoStatus: exec.auto_status,
    })
  }, [reviewValueNumeric, kpi.target_operator, kpi.target_value, kpi.warning_buffer_pct, exec.auto_status])

  const [decision, setDecision] = useState<ReviewDecision>(() => {
    return automaticDecision
  })
  const [manualDecisionOverride, setManualDecisionOverride] = useState<boolean>(false)

  useEffect(() => {
    if (!manualDecisionOverride) {
      setDecision(automaticDecision)
    }
  }, [automaticDecision, manualDecisionOverride])

  const riskLabel = useMemo(() => {
    const rl = safe(detail.risk.risk_level).toLowerCase()
    if (!rl) return "—"
    if (rl === "critical") return "Crítico"
    if (rl === "high") return "Alto"
    if (rl === "medium") return "Médio"
    if (rl === "low") return "Baixo"
    return rl
  }, [detail.risk.risk_level])

  function bannerTone() {
    const s = safe(exec.workflow_status).toLowerCase()
    if (s === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900"
    if (s === "needs_changes") return "border-amber-200 bg-amber-50 text-amber-900"
    if (s === "rejected") return "border-red-200 bg-red-50 text-red-900"
    return "border-blue-200 bg-blue-50 text-blue-900"
  }

  async function onFinalize() {
    setErr("")
    setMsg("")

    if (safe(reviewValueText) && reviewValueNumeric === null) {
      setErr("Valor ajustado inválido. Use apenas número (ex: 72 ou 72.5).")
      return
    }

    startTransition(async () => {
      try {
        await finalizeReview({
          executionId: exec.execution_id,
          decision,
          reviewerAdjustedResultNumeric: reviewValueNumeric,
          reviewerNotes: safe(reviewerNotes) ? reviewerNotes : null,
        })

        setMsg("Revisão salva com sucesso.")
        router.push(returnTo)
      } catch (e: any) {
        setErr(e?.message || "Falha ao salvar revisão.")
      }
    })
  }

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
          execution_id: exec.execution_id ?? null,
          control_id: exec.control_id,
          kpi_id: exec.kpi_id,
          title: safe(apTitle),
          description: finalDescription,
          responsible: safe(apResponsible) ? safe(apResponsible) : null,
          due_date: safe(apDueDate),
          priority: apPriority,
        })

        setApOpen(false)
        setMsg(`Plano de Ação criado (${ap?.id ?? "OK"}).`)
        router.refresh()
      } catch (e: any) {
        setErr(e?.message || "Falha ao salvar plano de ação.")
      }
    })
  }

  const ownerName = safe(control.control_owner_name) || "—"
  const ownerEmail = safe(control.control_owner_email) || "—"
  const warningPct =
    kpi.warning_buffer_pct === null || kpi.warning_buffer_pct === undefined
      ? null
      : Number((kpi.warning_buffer_pct as number) * 100)
  const kpiDataType = useMemo<KpiDataType>(() => normalizeKpiDataType(kpi.kpi_type), [kpi.kpi_type])
  const isBooleanKpi = kpiDataType === "boolean"
  const inputStep = kpiDataType === "number" ? "1" : "0.01"
  const executionLabel = kpiDataType === "percent" ? "Valor declarado (%)" : "Valor declarado"
  const reviewInputLabel = kpiDataType === "percent" ? "Ajustar Valor de Execução (%)" : "Ajustar Valor de Execução"
  const displayDeclaredValue = formatValueByType(baseDeclaredValue, kpiDataType)
  const displayTargetValue = formatValueByType(kpi.target_value, kpiDataType)
  const declaredDecision = useMemo<ReviewDecision>(() => {
    return computeAutomaticDecision({
      value: baseDeclaredValue,
      targetOperator: kpi.target_operator,
      targetValue: kpi.target_value,
      warningBufferPct: kpi.warning_buffer_pct,
      autoStatus: exec.auto_status,
    })
  }, [baseDeclaredValue, kpi.target_operator, kpi.target_value, kpi.warning_buffer_pct, exec.auto_status])

  const warningBuffer = useMemo(() => {
    if (kpi.warning_buffer_pct === null || kpi.warning_buffer_pct === undefined) return null
    const n = Number(kpi.warning_buffer_pct)
    return Number.isFinite(n) ? n : null
  }, [kpi.warning_buffer_pct])

  const warningFloor = useMemo(() => {
    if (kpi.target_value === null || kpi.target_value === undefined || warningBuffer === null) return null
    const n = Number(kpi.target_value)
    if (!Number.isFinite(n)) return null
    return n * (1 - Math.max(0, warningBuffer))
  }, [kpi.target_value, warningBuffer])

  const warningCeiling = useMemo(() => {
    if (kpi.target_value === null || kpi.target_value === undefined || warningBuffer === null) return null
    const n = Number(kpi.target_value)
    if (!Number.isFinite(n)) return null
    return n * (1 + Math.max(0, warningBuffer))
  }, [kpi.target_value, warningBuffer])
  const returnTo = useMemo(() => {
    const raw = (searchParams.get("returnTo") ?? "").trim()
    if (!raw || !raw.startsWith("/")) return "/revisoes"
    return raw
  }, [searchParams])

  return (
    <div className="space-y-5">
      <Link
        href={returnTo}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Revisões
      </Link>

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

      <div className={`rounded-xl border px-5 py-3 flex items-center justify-between gap-4 ${bannerTone()}`}>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">KPI em Revisão</p>
            <p className="text-xs opacity-80 truncate">Aguardando análise e validação dos dados de execução coletados.</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold border uppercase ${statusBadgeClass(
            exec.workflow_status
          )}`}
        >
          {statusLabel(exec.workflow_status)}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold leading-tight text-slate-900">{control.control_name}</h1>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              KPI {kpi.kpi_code}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
              <h2 className="text-base font-bold text-blue-700 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Dados da Execução (Focal Point)
              </h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{executionLabel}</div>
                <div className={`mt-2 text-3xl font-bold ${reviewDecisionValueClass(declaredDecision)}`}>
                  {displayDeclaredValue}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Meta: {displayTargetValue}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Responsável coleta</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{ownerName}</div>
                <div className="text-xs text-slate-500">{ownerEmail}</div>
              </div>

              <div className="md:col-span-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Justificativa do executante</div>
                <div className="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700">
                  {declaredNotes?.trim() ? declaredNotes : "Sem justificativa registrada."}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Evidências anexadas</div>
                {detail.evidences.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-500">Nenhuma evidência anexada.</div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.evidences.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/evidences/${encodeURIComponent(ev.id)}`}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:border-primary transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="max-w-[320px] truncate">{ev.filename}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
              <h2 className="text-base font-bold text-blue-700 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Painel do Revisor
              </h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{reviewInputLabel}</label>
                  {isBooleanKpi ? (
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-semibold"
                      value={reviewValueText}
                      onChange={(e) => setReviewValueText(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="1">Sim</option>
                      <option value="0">Não</option>
                    </select>
                  ) : (
                    <input
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-semibold"
                      placeholder="0.00"
                      type="number"
                      step={inputStep}
                      value={reviewValueText}
                      onChange={(e) => setReviewValueText(e.target.value)}
                    />
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Valor inicial fornecido pelo ponto focal: {displayDeclaredValue}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Resultado Final (Status)</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    value={decision}
                    disabled={!manualDecisionOverride}
                    onChange={(e) => {
                      setManualDecisionOverride(true)
                      setDecision(e.target.value as ReviewDecision)
                    }}
                  >
                    <option value="under_review">Pending</option>
                    <option value="approved">Effective</option>
                    <option value="needs_changes">Warning</option>
                    <option value="rejected">Critical</option>
                  </select>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      Cálculo automático:{" "}
                      <span className="font-semibold">
                        {reviewDecisionControlLabel(automaticDecision)}
                      </span>
                    </p>
                    {manualDecisionOverride ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline"
                        onClick={() => {
                          setManualDecisionOverride(false)
                          setDecision(automaticDecision)
                        }}
                      >
                        Usar automático
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline"
                        onClick={() => setManualDecisionOverride(true)}
                      >
                        Alterar manualmente
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Observações do Analista</label>
                <textarea
                  className="w-full min-h-[140px] bg-white border border-slate-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="Insira aqui sua análise detalhada sobre este KPI..."
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Link href={returnTo} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  Cancelar
                </Link>
                <button
                  type="button"
                  onClick={onFinalize}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-95 transition-all disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isPending ? "Salvando..." : "Salvar decisão"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informações do Controle</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Código</span>
                <span className="font-semibold text-slate-800">{control.control_code || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Nome</span>
                <span className="font-semibold text-slate-800 text-right">{control.control_name || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Descrição</span>
                <span className="font-semibold text-slate-800 text-right">
                  {control.control_description?.trim() || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Frequência</span>
                <span className="font-semibold text-slate-800">{control.control_frequency ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Responsável</span>
                <span className="font-semibold text-slate-800 text-right">{ownerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Risco associado</span>
                <span className="font-semibold text-slate-800">{riskLabel}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informações do KPI</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Área Responsável</span>
                <span className="font-semibold text-slate-800 text-right">{ownerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Frequência</span>
                <span className="font-semibold text-slate-800">{control.control_frequency ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Tipo de dado</span>
                <span className="font-semibold text-slate-800">
                  {kpiDataType === "boolean" ? "Booleano (Sim/Não)" : kpiDataType === "percent" ? "Percentual" : "Numérico"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Última Revisão</span>
                <span className="font-semibold text-slate-800">{exec.review_due_date ? formatDatePtBr(exec.review_due_date) : "--/--/----"}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Régua de Tolerância</h4>
              {isBooleanKpi ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2"><Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />Conforme (Green)</span>
                    <span className="font-semibold">igual à meta ({displayTargetValue})</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2"><Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />Crítico (Critical)</span>
                    <span className="font-semibold">diferente da meta</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2"><Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />Conforme (Green)</span>
                    <span className="font-semibold">
                      {kpi.target_operator === "gte" || kpi.target_operator === ">="
                        ? `>= ${displayTargetValue}`
                        : `<= ${displayTargetValue}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2"><Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />Atenção (Warning)</span>
                    <span className="font-semibold">
                      {warningBuffer === null || warningFloor === null || warningCeiling === null
                        ? "Faixa configurada"
                        : kpi.target_operator === "gte" || kpi.target_operator === ">="
                          ? `${formatValueByType(warningFloor, kpiDataType)} - ${displayTargetValue}`
                          : `${displayTargetValue} - ${formatValueByType(warningCeiling, kpiDataType)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="inline-flex items-center gap-2"><Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />Crítico (Critical)</span>
                    <span className="font-semibold">
                      {kpi.target_operator === "gte" || kpi.target_operator === ">="
                        ? `< ${formatValueByType(warningFloor, kpiDataType)}`
                        : `> ${formatValueByType(warningCeiling, kpiDataType)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Plano de Ação</h3>
              <Link
                href={`/action-plans?kpi_id=${encodeURIComponent(exec.kpi_id)}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>

            {detail.actionPlans.length === 0 ? (
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                <p className="text-xs font-bold text-rose-600">Pendente: Revisão de Processo</p>
                <p className="mt-1 text-[11px] text-rose-500">
                  Crie um novo plano para acompanhamento do desvio identificado.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.actionPlans.slice(0, 3).map((ap) => (
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

            <Link
              href={`/action-plans?kpi_id=${encodeURIComponent(exec.kpi_id)}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
              onClick={(e) => {
                e.preventDefault()
                openActionPlanModal()
              }}
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </Link>
          </div>
        </div>
      </div>

      {apOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApOpen(false)} aria-hidden="true" />

          <div className="relative z-10 w-[95vw] max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 truncate">Plano de Ação</h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  KPI <span className="font-mono">{kpi.kpi_code}</span> • {detail.periodLabel}
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
              {(safe(exec.auto_status).toLowerCase() === "out_of_target" || decision === "rejected") ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  É obrigatório registrar um plano de ação, pois este KPI está abaixo da meta esperada.
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
    </div>
  )
}
