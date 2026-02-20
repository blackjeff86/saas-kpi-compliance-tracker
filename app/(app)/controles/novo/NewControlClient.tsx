// app/(app)/controles/novo/NewControlClient.tsx
"use client"

import React, { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Info,
  ShieldCheck,
  Users,
  AlertTriangle,
} from "lucide-react"
import {
  checkControlCodeAvailability,
  createControlWithKpis,
  updateControlWithKpis,
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
  kpi_type: string // "numeric" | "percent" | "boolean" (UX mantém)
  kpi_target_operator: string // "higher_is_better" | "lower_is_better" (UX mantém)
  kpi_target_value: string
  kpi_target_boolean: boolean | null
  kpi_warning_buffer_pct: string // "5" => 5%
}

const EMPTY_KPI: KPIForm = {
  kpi_code: "",
  kpi_name: "",
  kpi_description: "",
  kpi_type: "numeric",
  kpi_target_operator: "higher_is_better",
  kpi_target_value: "",
  kpi_target_boolean: null,
  kpi_warning_buffer_pct: "0",
}

// ✅ UI values (vamos mapear pra DB no submit)
const CONTROL_FREQUENCIES = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual", label: "Semestral" }, // UX legado
  { value: "annual", label: "Anual" },
  { value: "adhoc", label: "Sob demanda" }, // UX legado
]

const CONTROL_TYPES = [
  { value: "preventive", label: "Preventivo", hint: "Evita riscos antes que ocorram" },
  { value: "detective", label: "Detectivo", hint: "Identifica riscos já ocorridos" },
  { value: "corrective", label: "Corretivo", hint: "Corrige problemas identificados" },
]

const classificationS = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
]

const KPI_TYPES = [
  { value: "numeric", label: "Numérico" },
  { value: "boolean", label: "Booleano" },
  { value: "percent", label: "Percentual" },
]

const KPI_DIRECTIONS = [
  { value: "higher_is_better", label: "Quanto maior, melhor" },
  { value: "lower_is_better", label: "Quanto menor, melhor" },
]

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-primary/30 dark:focus:border-primary"

const textareaClass =
  "mt-1.5 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-primary/30 dark:focus:border-primary"

const disabledFieldClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm leading-5 text-slate-500 " +
  "cursor-not-allowed " +
  "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"

function CardHeader({
  icon,
  iconClassName,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  iconClassName: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconClassName}`}>{icon}</div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  )
}

type EditInitialData = {
  control: {
    id: string
    framework: string | null
    control_code: string
    control_name: string
    control_description: string | null
    control_goal: string | null
    control_status: string | null
    control_frequency: string | null
    control_type: string | null

    control_owner_email: string | null
    control_owner_name: string | null
    focal_point_email: string | null
    focal_point_name: string | null

    risk_code: string | null
    risk_name: string | null
    risk_description: string | null
    risk_classification: string | null
  }
  kpis: Array<{
    kpi_code: string
    kpi_name: string
    kpi_description: string | null
    kpi_type: string | null
    kpi_target_operator: string | null
    kpi_target_value: number | null
    kpi_warning_buffer_pct: number | null // 0.05 no DB
  }>
}

function mapDbFrequencyToUx(freq?: string | null) {
  const s = String(freq || "").toLowerCase()
  if (!s) return "monthly"
  if (s === "semiannual") return "biannual"
  if (s === "on_demand") return "adhoc"
  return s
}

function mapUxFrequencyToDb(freqUx: string) {
  const s = String(freqUx || "").toLowerCase()
  if (s === "biannual") return "semiannual"
  if (s === "adhoc") return "on_demand"
  return s
}

function mapDbKpiTypeToUx(t?: string | null) {
  const s = String(t || "").toLowerCase()
  if (s === "number") return "numeric"
  if (s === "percent") return "percent"
  if (s === "boolean") return "boolean"
  return "numeric"
}

function mapDbOpToUxDirection(op?: string | null) {
  const s = String(op || "").toLowerCase()
  if (s === "lte") return "lower_is_better"
  return "higher_is_better" // gte/eq -> default
}

export default function NewControlClient({
  frameworks,
  users,
  mode = "create",
  controlId,
  initialData,
}: {
  frameworks: FrameworkOption[]
  users: UserOption[]
  mode?: "create" | "edit"
  controlId?: string
  initialData?: EditInitialData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const userByEmail = useMemo(() => {
    const m = new Map<string, UserOption>()
    for (const u of users || []) m.set(String(u.email || "").toLowerCase(), u)
    return m
  }, [users])

  const existingFrameworkNames = useMemo(() => {
    const set = new Set<string>()
    for (const f of frameworks || []) {
      const name = safe((f as any)?.name)
      if (name) set.add(name)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [frameworks])

  const [frameworkMode, setFrameworkMode] = useState<"select" | "custom">(
    existingFrameworkNames.length ? "select" : "custom"
  )
  const [ownerMode, setOwnerMode] = useState<"select" | "custom">(users?.length ? "select" : "custom")
  const [focalMode, setFocalMode] = useState<"select" | "custom">(users?.length ? "select" : "custom")

  const [form, setForm] = useState({
    framework: existingFrameworkNames?.[0] ?? "",
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
    risk_classification: "medium",
  })

  const [kpis, setKpis] = useState<KPIForm[]>([{ ...EMPTY_KPI }])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [codeCheck, setCodeCheck] = useState<{ checking: boolean; available: boolean | null }>({
    checking: false,
    available: null,
  })

  // ✅ Prefill modo edição
  useEffect(() => {
    if (mode !== "edit") return
    if (!initialData?.control) return

    const c = initialData.control

    // framework: se existir na lista -> select, senão custom
    const fw = safe(c.framework)
    const fwExists = fw && existingFrameworkNames.includes(fw)
    setFrameworkMode(fwExists ? "select" : "custom")

    setForm((p) => ({
      ...p,
      framework: fw || p.framework,
      control_code: safe(c.control_code),
      control_name: safe(c.control_name),
      control_description: safe(c.control_description),
      control_goal: safe(c.control_goal),
      control_status: safe(c.control_status) || "active",
      control_frequency: mapDbFrequencyToUx(c.control_frequency),
      control_type: safe(c.control_type) || "detective",

      control_owner_email: safe(c.control_owner_email),
      control_owner_name: safe(c.control_owner_name),

      focal_point_email: safe(c.focal_point_email),
      focal_point_name: safe(c.focal_point_name),

      risk_code: safe(c.risk_code),
      risk_name: safe(c.risk_name),
      risk_description: safe(c.risk_description),
      risk_classification: safe(c.risk_classification) || "medium",
    }))

    // KPIs
    const ks = (initialData.kpis || []).map((k): KPIForm => {
      const uxType = mapDbKpiTypeToUx(k.kpi_type)
      const isBool = uxType === "boolean"
      const dir = mapDbOpToUxDirection(k.kpi_target_operator)

      const warningUi = k.kpi_warning_buffer_pct == null ? "0" : String(Math.round(k.kpi_warning_buffer_pct * 100))

      return {
        kpi_code: safe(k.kpi_code),
        kpi_name: safe(k.kpi_name),
        kpi_description: safe(k.kpi_description),
        kpi_type: uxType,
        kpi_target_operator: isBool ? "higher_is_better" : dir,
        kpi_target_value: isBool ? "" : k.kpi_target_value == null ? "" : String(k.kpi_target_value),
        kpi_target_boolean: isBool ? (k.kpi_target_value === 1 ? true : k.kpi_target_value === 0 ? false : null) : null,
        kpi_warning_buffer_pct: isBool ? "0" : warningUi,
      }
    })

    setKpis(ks.length ? ks : [{ ...EMPTY_KPI }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialData, existingFrameworkNames])

  // ✅ code availability (no edit: exclui o próprio controle)
  useEffect(() => {
    const code = safe(form.control_code)
    if (!code) {
      setCodeCheck({ checking: false, available: null })
      return
    }

    let alive = true
    setCodeCheck({ checking: true, available: null })

    const t = setTimeout(async () => {
      const r = await checkControlCodeAvailability(code, mode === "edit" ? controlId : undefined)
      if (!alive) return
      setCodeCheck({ checking: false, available: r.available })
    }, 350)

    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [form.control_code, mode, controlId])

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function fillUserByEmail(kind: "owner" | "focal", email: string) {
    const u = userByEmail.get(email.toLowerCase())
    if (!u) return
    if (kind === "owner") {
      setField("control_owner_email", u.email as any)
      setField("control_owner_name", u.name as any)
    } else {
      setField("focal_point_email", u.email as any)
      setField("focal_point_name", u.name as any)
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

    const framework = safe(form.framework)
    if (!framework) return setError("Framework é obrigatório.")
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
        const any = k.kpi_code || k.kpi_name || k.kpi_description || k.kpi_target_value || k.kpi_target_boolean !== null
        return Boolean(any)
      })

    for (const k of normalizedKpis) {
      if (!k.kpi_code || !k.kpi_name) return setError("KPI: código e nome são obrigatórios.")
      if (!k.kpi_type) return setError("KPI: tipo é obrigatório.")

      if (k.kpi_type === "boolean") {
        if (k.kpi_target_boolean === null) return setError(`KPI ${k.kpi_code}: selecione o alvo booleano.`)
      } else {
        if (!k.kpi_target_value) return setError(`KPI ${k.kpi_code}: informe o alvo numérico.`)
        if (!k.kpi_target_operator) return setError(`KPI ${k.kpi_code}: selecione a direção (maior/menor).`)
      }
    }

    startTransition(async () => {
      const kpisPayload = normalizedKpis.map((k) => {
        const isBoolean = k.kpi_type === "boolean"

        // kpi_type: UX numeric -> DB number
        const kpiTypeDb = k.kpi_type === "numeric" ? "number" : k.kpi_type

        // operator: UX direction -> DB gte/lte/eq
        const dir = (k.kpi_target_operator || "higher_is_better") as "higher_is_better" | "lower_is_better"
        const opDb = isBoolean ? "eq" : dir === "lower_is_better" ? "lte" : "gte"

        // boolean -> 1/0
        let targetValueDb: number | null = null
        if (isBoolean) {
          if (typeof k.kpi_target_boolean === "boolean") targetValueDb = k.kpi_target_boolean ? 1 : 0
          else targetValueDb = null
        } else {
          targetValueDb = k.kpi_target_value ? Number(k.kpi_target_value) : null
        }

        const warningPctRaw = k.kpi_warning_buffer_pct ? Number(k.kpi_warning_buffer_pct) : 0

        return {
          kpi_code: k.kpi_code,
          kpi_name: k.kpi_name,
          kpi_description: k.kpi_description,
          kpi_type: kpiTypeDb,
          kpi_target_operator: opDb,
          kpi_target_value: targetValueDb,
          kpi_warning_buffer_pct: warningPctRaw,
        }
      })

      const payload = {
        framework,
        control_code: form.control_code,
        control_name: form.control_name,
        control_description: form.control_description,
        control_goal: form.control_goal,
        control_status: form.control_status,
        // ✅ mapeia UX para DB
        control_frequency: mapUxFrequencyToDb(form.control_frequency),
        control_type: form.control_type,

        control_owner_email: form.control_owner_email,
        control_owner_name: form.control_owner_name,
        focal_point_email: form.focal_point_email,
        focal_point_name: form.focal_point_name,

        risk_code: form.risk_code,
        risk_name: form.risk_name,
        risk_description: form.risk_description,
        risk_classification: form.risk_classification,

        kpis: kpisPayload as any,
      } as any

      const res =
        mode === "edit"
          ? await updateControlWithKpis(String(controlId || ""), payload)
          : await createControlWithKpis(payload)

      if (!res.ok) {
        setError(res.error || "Falha ao salvar controle.")
        return
      }

      setOk(mode === "edit" ? "Controle atualizado com sucesso." : "Controle salvo com sucesso.")
      router.push(`/controles/${res.control_id}`)
      router.refresh()
    })
  }

  return (
    <>
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

      <form id="new-control-form" onSubmit={onSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <CardHeader
            icon={<Info className="h-4 w-4" />}
            iconClassName="bg-blue-50 dark:bg-slate-800 text-primary"
            title="Informações Básicas"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nome do controle <span className="text-red-500">*</span>
              </label>
              <input
                className={fieldClass}
                value={form.control_name}
                onChange={(e) => setField("control_name", e.target.value)}
                placeholder="Ex: Política de Backup Diário"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                className={fieldClass}
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

            <div className="md:col-span-2">
              <div className="flex items-end justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Framework <span className="text-red-500">*</span>
                </label>

                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setFrameworkMode((m) => (m === "select" ? "custom" : "select"))}
                >
                  {frameworkMode === "select" ? "Adicionar novo" : "Selecionar existente"}
                </button>
              </div>

              {frameworkMode === "select" ? (
                <select className={fieldClass} value={form.framework} onChange={(e) => setField("framework", e.target.value)}>
                  {existingFrameworkNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {!existingFrameworkNames.length ? <option value="">(sem frameworks)</option> : null}
                </select>
              ) : (
                <input
                  className={fieldClass}
                  value={form.framework}
                  onChange={(e) => setField("framework", e.target.value)}
                  placeholder="Ex: ISO27701"
                />
              )}

              <p className="text-xs text-slate-500 mt-1">Você pode selecionar um existente ou digitar um novo.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Status <span className="text-red-500">*</span>
              </label>
              <select className={fieldClass} value={form.control_status} onChange={(e) => setField("control_status", e.target.value)}>
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Descrição do controle</label>
              <textarea className={`${textareaClass} h-32`} value={form.control_description} onChange={(e) => setField("control_description", e.target.value)} />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Objetivo (goal)</label>
              <textarea className={`${textareaClass} h-24`} value={form.control_goal} onChange={(e) => setField("control_goal", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Configurações */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            iconClassName="bg-purple-50 dark:bg-slate-800 text-purple-600"
            title="Configurações de Compliance"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Frequência de Execução <span className="text-red-500">*</span>
              </label>
              <select className={fieldClass} value={form.control_frequency} onChange={(e) => setField("control_frequency", e.target.value)}>
                {CONTROL_FREQUENCIES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Tipo de Controle <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col md:flex-row gap-4">
                {CONTROL_TYPES.map((t) => {
                  const active = form.control_type === t.value
                  return (
                    <label
                      key={t.value}
                      className={
                        "flex items-center p-3 border rounded-lg cursor-pointer transition-colors flex-1 " +
                        (active ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")
                      }
                    >
                      <input
                        type="radio"
                        name="control_type"
                        className="h-4 w-4 text-primary focus:ring-primary border-slate-300"
                        checked={active}
                        onChange={() => setField("control_type", t.value)}
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{t.label}</span>
                        <span className="block text-xs text-slate-500">{t.hint}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Responsáveis */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <CardHeader icon={<Users className="h-4 w-4" />} iconClassName="bg-emerald-50 dark:bg-slate-800 text-emerald-600" title="Responsabilidade" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OWNER */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Control Owner <span className="text-red-500">*</span>
                </label>
                <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setOwnerMode((m) => (m === "select" ? "custom" : "select"))}>
                  {ownerMode === "select" ? "Adicionar novo" : "Selecionar existente"}
                </button>
              </div>

              {ownerMode === "select" ? (
                <select
                  className={fieldClass}
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
              ) : (
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nome</label>
                    <input className={fieldClass} value={form.control_owner_name} onChange={(e) => setField("control_owner_name", e.target.value)} placeholder="Ex: Maria Silva" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
                    <input className={fieldClass} value={form.control_owner_email} onChange={(e) => setField("control_owner_email", e.target.value)} placeholder="maria@empresa.com" inputMode="email" />
                  </div>
                </div>
              )}

              {ownerMode === "select" ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
                    <input className={fieldClass} value={form.control_owner_email} onChange={(e) => setField("control_owner_email", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nome</label>
                    <input className={fieldClass} value={form.control_owner_name} onChange={(e) => setField("control_owner_name", e.target.value)} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">Para “adicionar novo”, preencha nome e email manualmente.</p>
              )}
            </div>

            {/* FOCAL */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Focal Point / Substituto</label>
                <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setFocalMode((m) => (m === "select" ? "custom" : "select"))}>
                  {focalMode === "select" ? "Adicionar novo" : "Selecionar existente"}
                </button>
              </div>

              {focalMode === "select" ? (
                <select
                  className={fieldClass}
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
              ) : (
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nome</label>
                    <input className={fieldClass} value={form.focal_point_name} onChange={(e) => setField("focal_point_name", e.target.value)} placeholder="Ex: João Souza" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
                    <input className={fieldClass} value={form.focal_point_email} onChange={(e) => setField("focal_point_email", e.target.value)} placeholder="joao@empresa.com" inputMode="email" />
                  </div>
                </div>
              )}

              {focalMode === "select" ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
                    <input className={fieldClass} value={form.focal_point_email} onChange={(e) => setField("focal_point_email", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nome</label>
                    <input className={fieldClass} value={form.focal_point_name} onChange={(e) => setField("focal_point_name", e.target.value)} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">Para “adicionar novo”, preencha nome e email manualmente.</p>
              )}
            </div>
          </div>
        </div>

        {/* Classificação de Risco */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <CardHeader icon={<AlertTriangle className="h-4 w-4" />} iconClassName="bg-orange-50 dark:bg-slate-800 text-orange-600" title="Classificação de Risco" subtitle="(opcional)" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Risk code</label>
              <input className={fieldClass} value={form.risk_code} onChange={(e) => setField("risk_code", e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Risk name</label>
              <input className={fieldClass} value={form.risk_name} onChange={(e) => setField("risk_name", e.target.value)} />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Risk description</label>
              <textarea className={`${textareaClass} h-28`} value={form.risk_description} onChange={(e) => setField("risk_description", e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Risk classification</label>
              <select className={fieldClass} value={form.risk_classification} onChange={(e) => setField("risk_classification", e.target.value)}>
                {classificationS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">KPIs do controle</h2>
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

          <div className="space-y-4">
            {kpis.map((k, idx) => {
              const isBoolean = k.kpi_type === "boolean"

              return (
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
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">KPI code</label>
                      <input className={fieldClass} value={k.kpi_code} onChange={(e) => updateKpi(idx, { kpi_code: e.target.value })} />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">KPI name</label>
                      <input className={fieldClass} value={k.kpi_name} onChange={(e) => updateKpi(idx, { kpi_name: e.target.value })} />
                    </div>

                    <div className="md:col-span-6">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">KPI description</label>
                      <textarea className={`${textareaClass} h-24`} value={k.kpi_description} onChange={(e) => updateKpi(idx, { kpi_description: e.target.value })} />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">KPI type</label>
                      <select
                        className={fieldClass}
                        value={k.kpi_type}
                        onChange={(e) => {
                          const nextType = e.target.value
                          updateKpi(idx, {
                            kpi_type: nextType,
                            kpi_target_boolean: nextType === "boolean" ? false : null,
                            kpi_target_value: nextType === "boolean" ? "" : k.kpi_target_value,
                            kpi_target_operator: nextType === "boolean" ? "higher_is_better" : k.kpi_target_operator || "higher_is_better",
                            kpi_warning_buffer_pct: nextType === "boolean" ? "0" : k.kpi_warning_buffer_pct,
                          })
                        }}
                      >
                        {KPI_TYPES.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Direção do alvo</label>
                      {isBoolean ? (
                        <select className={disabledFieldClass} disabled value="">
                          <option>—</option>
                        </select>
                      ) : (
                        <select className={fieldClass} value={k.kpi_target_operator || "higher_is_better"} onChange={(e) => updateKpi(idx, { kpi_target_operator: e.target.value })}>
                          {KPI_DIRECTIONS.map((x) => (
                            <option key={x.value} value={x.value}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Warning buffer (%)</label>
                      <input
                        className={isBoolean ? disabledFieldClass : fieldClass}
                        disabled={isBoolean}
                        value={isBoolean ? "—" : k.kpi_warning_buffer_pct}
                        onChange={(e) => updateKpi(idx, { kpi_warning_buffer_pct: e.target.value })}
                        inputMode="numeric"
                      />
                    </div>

                    <div className="md:col-span-6">
                      {isBoolean ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Target boolean</label>
                          <select
                            className={fieldClass}
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
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Target value</label>
                          <input className={fieldClass} value={k.kpi_target_value} onChange={(e) => updateKpi(idx, { kpi_target_value: e.target.value })} inputMode="decimal" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Barra fixa */}
        <div className="fixed bottom-0 right-0 left-0 lg:left-64 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 z-20 backdrop-blur">
          <div className="max-w-6xl mx-auto w-full px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Link
                href={mode === "edit" ? `/controles/${controlId}` : "/controles"}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors text-sm shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {mode === "edit" ? "Atualizar Controle" : "Salvar Controle"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
