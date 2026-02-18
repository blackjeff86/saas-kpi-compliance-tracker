// app/(app)/controles/novo/NewControlClient.tsx
"use client"

import React, { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import {
  checkControlCodeAvailability,
  createControlWithKpis,
  type FrameworkOption,
  type UserOption,
} from "./actions"

function safe(v: any) {
  return String(v ?? "").trim()
}

type KPIForm = {
  kpi_code: string
  kpi_name: string
  kpi_description: string
  kpi_type: string
  kpi_target_operator: string
  kpi_target_value: string
  kpi_target_boolean: boolean | null
  kpi_warning_buffer_pct: string
}

const EMPTY_KPI: KPIForm = {
  kpi_code: "",
  kpi_name: "",
  kpi_description: "",
  kpi_type: "numeric",
  kpi_target_operator: ">=",
  kpi_target_value: "",
  kpi_target_boolean: null,
  kpi_warning_buffer_pct: "0",
}

const CONTROL_FREQUENCIES = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
  { value: "adhoc", label: "Sob demanda" },
]

const CONTROL_TYPES = [
  { value: "preventive", label: "Preventivo" },
  { value: "detective", label: "Detectivo" },
  { value: "corrective", label: "Corretivo" },
]

const RISK_CLASSIFICATIONS = [
  { value: "low", label: "Baixo" },
  { value: "med", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
]

const KPI_TYPES = [
  { value: "numeric", label: "Numérico" },
  { value: "boolean", label: "Booleano" },
  { value: "percent", label: "Percentual" },
]

const KPI_OPERATORS = [
  { value: ">=", label: "≥" },
  { value: ">", label: ">" },
  { value: "<=", label: "≤" },
  { value: "<", label: "<" },
  { value: "=", label: "=" },
]

export default function NewControlClient({
  frameworks,
  users,
}: {
  frameworks: FrameworkOption[]
  users: UserOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const userByEmail = useMemo(() => {
    const m = new Map<string, UserOption>()
    for (const u of users) m.set(u.email.toLowerCase(), u)
    return m
  }, [users])

  const [form, setForm] = useState({
    framework: frameworks?.[0]?.name ?? "",
    control_code: "",
    control_name: "",
    control_description: "",
    control_goal: "",
    control_status: "active",
    control_frequency: "monthly",
    control_type: "detective",
    control_owner_email: "",
    control_owner_name: "",
    focal_point_email: "",
    focal_point_name: "",
    risk_code: "",
    risk_name: "",
    risk_description: "",
    risk_classification: "med",
    impact: 3,
    likelihood: 3,
  })

  const [kpis, setKpis] = useState<KPIForm[]>([{ ...EMPTY_KPI }])

  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [codeCheck, setCodeCheck] = useState<{
    checking: boolean
    available: boolean | null
  }>({ checking: false, available: null })

  useEffect(() => {
    const code = safe(form.control_code)
    if (!code) {
      setCodeCheck({ checking: false, available: null })
      return
    }

    let alive = true
    setCodeCheck({ checking: true, available: null })

    const t = setTimeout(async () => {
      const r = await checkControlCodeAvailability(code)
      if (!alive) return
      setCodeCheck({ checking: false, available: r.available })
    }, 350)

    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [form.control_code])

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function fillUserByEmail(kind: "owner" | "focal", email: string) {
    const u = userByEmail.get(email.toLowerCase())
    if (!u) return
    if (kind === "owner") {
      setField("control_owner_email", u.email)
      setField("control_owner_name", u.name)
    } else {
      setField("focal_point_email", u.email)
      setField("focal_point_name", u.name)
    }
  }

  function updateKpi(idx: number, patch: Partial<KPIForm>) {
    setKpis((prev) => prev.map((k, i) => (i === idx ? { ...k, ...patch } : k)))
  }

  function addKpi() {
    setKpis((p) => [...p, { ...EMPTY_KPI }])
  }

  function removeKpi(idx: number) {
    setKpis((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    if (!safe(form.framework)) return setError("Framework é obrigatório.")
    if (!safe(form.control_code)) return setError("Código do controle é obrigatório.")
    if (!safe(form.control_name)) return setError("Nome do controle é obrigatório.")
    if (!safe(form.control_frequency)) return setError("Frequência é obrigatória.")
    if (!safe(form.control_type)) return setError("Tipo de controle é obrigatório.")
    if (!safe(form.control_owner_email) || !safe(form.control_owner_name))
      return setError("Control Owner (nome e email) é obrigatório.")

    if (codeCheck.available === false) {
      return setError(`Já existe um controle com code "${safe(form.control_code)}". Use outro code.`)
    }

    const normalizedKpis = kpis
      .map((k) => ({
        ...k,
        kpi_code: safe(k.kpi_code),
        kpi_name: safe(k.kpi_name),
        kpi_description: safe(k.kpi_description),
        kpi_type: safe(k.kpi_type),
        kpi_target_operator: safe(k.kpi_target_operator),
        kpi_target_value: safe(k.kpi_target_value),
        kpi_warning_buffer_pct: safe(k.kpi_warning_buffer_pct),
      }))
      .filter((k) => {
        const any =
          k.kpi_code || k.kpi_name || k.kpi_description || k.kpi_target_value || k.kpi_target_boolean !== null
        return Boolean(any)
      })

    for (const k of normalizedKpis) {
      if (!k.kpi_code || !k.kpi_name) return setError("KPI: código e nome são obrigatórios.")
      if (!k.kpi_type) return setError("KPI: tipo é obrigatório.")
      if (k.kpi_type === "boolean") {
        if (k.kpi_target_boolean === null) return setError(`KPI ${k.kpi_code}: selecione o alvo booleano.`)
      } else {
        if (!k.kpi_target_value) return setError(`KPI ${k.kpi_code}: informe o alvo numérico.`)
      }
    }

    startTransition(async () => {
      const res = await createControlWithKpis({
        ...form,
        impact: Number(form.impact),
        likelihood: Number(form.likelihood),
        kpis: normalizedKpis.map((k) => ({
          kpi_code: k.kpi_code,
          kpi_name: k.kpi_name,
          kpi_description: k.kpi_description,
          kpi_type: k.kpi_type,
          kpi_target_operator: k.kpi_type === "boolean" ? "=" : k.kpi_target_operator,
          kpi_target_value: k.kpi_type === "boolean" ? null : k.kpi_target_value ? Number(k.kpi_target_value) : null,
          kpi_target_boolean: k.kpi_type === "boolean" ? Boolean(k.kpi_target_boolean) : null,
          kpi_warning_buffer_pct: k.kpi_warning_buffer_pct ? Number(k.kpi_warning_buffer_pct) : 0,
        })),
      })

      if (!res.ok) {
        setError(res.error || "Falha ao salvar controle.")
        return
      }

      setOk("Controle salvo com sucesso.")
      router.push(`/controles/${res.control_id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/controles"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para listagem
        </Link>

        <div className="text-xs text-slate-500">* Campos alinhados ao template CSV</div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5" />
          <span>{ok}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Informações básicas */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Informações básicas</h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Framework <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.framework}
                onChange={(e) => setField("framework", e.target.value)}
              >
                {frameworks.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
                {!frameworks.length ? <option value="">(sem frameworks)</option> : null}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_code}
                onChange={(e) => setField("control_code", e.target.value)}
                placeholder="SOX-CTRL-001"
              />
              <div className="mt-1 text-xs text-slate-500">
                {codeCheck.checking ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> validando code...
                  </span>
                ) : codeCheck.available === true ? (
                  <span className="text-emerald-600">code disponível</span>
                ) : codeCheck.available === false ? (
                  <span className="text-red-600">já existe</span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_status}
                onChange={(e) => setField("control_status", e.target.value)}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nome do controle <span className="text-red-500">*</span>
              </label>
              <input
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_name}
                onChange={(e) => setField("control_name", e.target.value)}
                placeholder="Ex: Revisão mensal de vulnerabilidades (Cloud)"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
              <textarea
                className="mt-1 h-28 w-full resize-none rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_description}
                onChange={(e) => setField("control_description", e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Objetivo (goal)</label>
              <textarea
                className="mt-1 h-20 w-full resize-none rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_goal}
                onChange={(e) => setField("control_goal", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Configurações */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Configurações</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Frequência <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_frequency}
                onChange={(e) => setField("control_frequency", e.target.value)}
              >
                {CONTROL_FREQUENCIES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo de controle <span className="text-red-500">*</span>
              </label>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                {CONTROL_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      form.control_type === t.value
                        ? "border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="control_type"
                      className="h-4 w-4"
                      checked={form.control_type === t.value}
                      onChange={() => setField("control_type", t.value)}
                    />
                    <span className="font-medium text-slate-900 dark:text-white">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Responsáveis */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Responsáveis</h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Control Owner *</div>

              <select
                className="mt-2 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.control_owner_email}
                onChange={(e) => {
                  const email = e.target.value
                  setField("control_owner_email", email)
                  fillUserByEmail("owner", email)
                }}
              >
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
                  <input
                    className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={form.control_owner_email}
                    onChange={(e) => setField("control_owner_email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Nome</label>
                  <input
                    className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={form.control_owner_name}
                    onChange={(e) => setField("control_owner_name", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Focal Point</div>

              <select
                className="mt-2 w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.focal_point_email}
                onChange={(e) => {
                  const email = e.target.value
                  setField("focal_point_email", email)
                  fillUserByEmail("focal", email)
                }}
              >
                <option value="">(opcional)</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
                  <input
                    className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={form.focal_point_email}
                    onChange={(e) => setField("focal_point_email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Nome</label>
                  <input
                    className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={form.focal_point_name}
                    onChange={(e) => setField("focal_point_name", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Risco */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Risco associado (opcional)</h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Risk code</label>
              <input
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.risk_code}
                onChange={(e) => setField("risk_code", e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Risk name</label>
              <input
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.risk_name}
                onChange={(e) => setField("risk_name", e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Risk description</label>
              <textarea
                className="mt-1 h-24 w-full resize-none rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.risk_description}
                onChange={(e) => setField("risk_description", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Risk classification</label>
              <select
                className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={form.risk_classification}
                onChange={(e) => setField("risk_classification", e.target.value)}
              >
                {RISK_CLASSIFICATIONS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Impacto (1–5)</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={form.impact}
                    onChange={(e) => setField("impact", Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-white">
                    {form.impact}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Probabilidade (1–5)
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={form.likelihood}
                    onChange={(e) => setField("likelihood", Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-white">
                    {form.likelihood}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">KPIs do controle</h2>
              <p className="mt-1 text-sm text-slate-500">Adicionar / remover KPIs antes de salvar.</p>
            </div>

            <button
              type="button"
              onClick={addKpi}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Adicionar KPI
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {kpis.map((k, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">KPI #{idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeKpi(idx)}
                    disabled={kpis.length <= 1}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">KPI code</label>
                    <input
                      className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_code}
                      onChange={(e) => updateKpi(idx, { kpi_code: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">KPI name</label>
                    <input
                      className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_name}
                      onChange={(e) => updateKpi(idx, { kpi_name: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      KPI description
                    </label>
                    <textarea
                      className="mt-1 h-20 w-full resize-none rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_description}
                      onChange={(e) => updateKpi(idx, { kpi_description: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">KPI type</label>
                    <select
                      className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_type}
                      onChange={(e) =>
                        updateKpi(idx, {
                          kpi_type: e.target.value,
                          kpi_target_boolean: e.target.value === "boolean" ? false : null,
                          kpi_target_value: e.target.value === "boolean" ? "" : k.kpi_target_value,
                        })
                      }
                    >
                      {KPI_TYPES.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Target operator
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_target_operator}
                      onChange={(e) => updateKpi(idx, { kpi_target_operator: e.target.value })}
                      disabled={k.kpi_type === "boolean"}
                    >
                      {KPI_OPERATORS.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Warning buffer (%)
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={k.kpi_warning_buffer_pct}
                      onChange={(e) => updateKpi(idx, { kpi_warning_buffer_pct: e.target.value })}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="md:col-span-6">
                    {k.kpi_type === "boolean" ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Target boolean
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={k.kpi_target_boolean === null ? "" : k.kpi_target_boolean ? "true" : "false"}
                          onChange={(e) => updateKpi(idx, { kpi_target_boolean: e.target.value === "true" })}
                        >
                          <option value="">Selecione...</option>
                          <option value="true">Sim (true)</option>
                          <option value="false">Não (false)</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Target value
                        </label>
                        <input
                          className="mt-1 w-full rounded-lg border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={k.kpi_target_value}
                          onChange={(e) => updateKpi(idx, { kpi_target_value: e.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
          <Link
            href="/controles"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar controle
          </button>
        </div>
      </form>
    </div>
  )
}
