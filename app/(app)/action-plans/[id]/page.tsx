import Link from "next/link"
import { notFound } from "next/navigation"

import PageContainer from "../../PageContainer"

import { fetchActionPlanDetail } from "./actions"

import {
  ArrowLeft,
  Download,
  ChevronDown,
  CalendarDays,
  User,
  Flag,
  FileText,
  CheckSquare,
  Clock3,
  CheckCircle2,
  Circle,
  Paperclip,
  PlusCircle,
  Upload,
  Sparkles,
} from "lucide-react"

function formatDate(v?: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function toMonthRefFromDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function formatMonthRef(v?: string | null) {
  if (!v) return "—"
  if (!/^\d{4}-\d{2}$/.test(v)) return v
  const d = new Date(`${v}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return v
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(d)
}

function priorityLabel(p?: string | null) {
  const v = (p || "").toLowerCase()

  if (v === "critical") return "Crítica"
  if (v === "high") return "Alta"
  if (v === "medium") return "Média"
  if (v === "low") return "Baixa"

  return "—"
}

function priorityAccent(p?: string | null) {
  const v = (p || "").toLowerCase()
  if (v === "critical") return "text-fuchsia-700 bg-fuchsia-100"
  if (v === "high") return "text-rose-700 bg-rose-100"
  if (v === "medium") return "text-amber-700 bg-amber-100"
  if (v === "low") return "text-slate-700 bg-slate-100"
  return "text-slate-700 bg-slate-100"
}

function statusLabel(s?: string | null) {
  const v = (s || "").toLowerCase()

  if (v === "done") return "Concluído"
  if (v === "blocked") return "Bloqueado"
  if (v === "in_progress") return "Em andamento"

  return "A fazer"
}

function statusPill(s?: string | null) {
  const v = (s || "").toLowerCase()

  if (v === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (v === "blocked") return "bg-red-50 text-red-700 border-red-200"
  if (v === "in_progress") return "bg-primary/10 text-primary border-primary/20"

  return "bg-slate-50 text-slate-700 border-slate-200"
}

function progressFromStatus(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (v === "done") return 100
  if (v === "in_progress") return 75
  if (v === "blocked") return 30
  return 10
}

function initialsFromName(name?: string | null) {
  const clean = (name || "").trim()
  if (!clean) return "—"
  const parts = clean.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase() || clean.slice(0, 2).toUpperCase()
}

export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) return notFound()

  const plan = await fetchActionPlanDetail(id)
  if (!plan) return notFound()

  const created = formatDate(plan.created_at ?? plan.updated_at)
  const due = formatDate(plan.due_date)
  const progress = progressFromStatus(plan.status)
  const responsible = plan.responsible_name?.trim() || "Não definido"
  const titleCode = plan.id.slice(0, 8).toUpperCase()
  const sourceMonthRef = plan.mes_ref ?? toMonthRefFromDate(plan.created_at ?? plan.updated_at)
  const sourceMonthLabel = formatMonthRef(sourceMonthRef)

  return (
    <PageContainer variant="default">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link
              href="/action-plans"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              title="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">{plan.title}</h1>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(plan.status)}`}
                >
                  {statusLabel(plan.status)}
                </span>
              </div>
              <div className="text-xs text-slate-500">Cód: PL-{titleCode} • Criado em {created}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Ações
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Progresso Atual</div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-extrabold text-slate-800">{progress}%</div>
              <div className="text-xs font-semibold text-primary">{Math.round(progress / 12.5)}/8 tarefas</div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Responsável</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                {initialsFromName(plan.responsible_name)}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">{responsible}</div>
                <div className="text-xs text-slate-500">Owner do plano</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Prazo Final</div>
            <div className="mt-3 flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-orange-200 bg-orange-50 text-orange-600">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-bold">{due}</div>
                <div className="text-xs text-rose-600">Acompanhar SLA</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Prioridade</div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${priorityAccent(plan.priority)}`}>
                <Flag className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-800">{priorityLabel(plan.priority)}</div>
                <div className="text-xs text-slate-500">Impacto do plano</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-primary" />
                Detalhamento do Plano
              </div>
              <div className="space-y-5 p-5 text-sm text-slate-600">
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Descrição</div>
                  <p className="leading-relaxed">{plan.description ?? "Sem descrição cadastrada."}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Origem</div>
                  <div className="space-y-1">
                    {plan.execution_id ? (
                      <div>
                        Execução:{" "}
                        <Link href={`/execucoes/${plan.execution_id}`} className="font-semibold text-primary hover:underline">
                          abrir execução
                        </Link>
                      </div>
                    ) : null}
                    {plan.risk_id ? (
                      <div>
                        Risco:{" "}
                        <Link href={`/risks/${plan.risk_id}`} className="font-semibold text-primary hover:underline">
                          {plan.risk_title ?? plan.risk_id}
                        </Link>
                      </div>
                    ) : null}
                    <div>Framework: {plan.framework ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Checklist de Tarefas
                </div>
                <button type="button" className="text-xs font-semibold text-primary hover:underline">
                  Ver todas
                </button>
              </div>
              <div className="space-y-4 p-5 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <div className="font-semibold text-slate-700 line-through">Mapeamento de dados sensíveis</div>
                    <div className="text-xs text-slate-500">Concluído por {responsible}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <div className="font-semibold text-slate-700 line-through">Revisão de contratos com operadores</div>
                    <div className="text-xs text-slate-500">Concluído pelo time GRC</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Circle className="mt-0.5 h-4 w-4 text-slate-300" />
                  <div>
                    <div className="font-semibold text-slate-700">Atualizar evidências no repositório</div>
                    <div className="text-xs text-slate-500">Pendente</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 border-b border-primary/10 px-5 py-4 font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                Origem do Plano
              </div>
              <div className="space-y-2 p-5 text-sm text-slate-700">
                {plan.execution_id ? (
                  <p>
                    Este plano foi registrado no controle <b>{plan.control_code ?? "—"}</b>, KPI <b>{plan.kpi_code ?? "—"}</b>.
                  </p>
                ) : plan.risk_id ? (
                  <p>
                    Este plano foi registrado no risco <b>{plan.risk_title ?? plan.risk_id ?? "—"}</b>.
                  </p>
                ) : (
                  <p>A origem deste plano não foi identificada.</p>
                )}
                <p>
                  Mês referência: <b>{sourceMonthLabel}</b>
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold text-slate-800">
                <Clock3 className="h-4 w-4 text-primary" />
                Timeline de Atividades
              </div>
              <div className="space-y-5 p-5 text-sm">
                <div className="flex gap-3">
                  <div className="mt-1 rounded-full bg-primary/10 p-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">Status alterado</div>
                    <div className="text-slate-600">
                      Status modificado para <b>{statusLabel(plan.status)}</b>.
                    </div>
                    <div className="text-xs text-slate-400">Hoje, 16:30</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 rounded-full bg-emerald-100 p-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">Evidência vinculada</div>
                    <div className="text-slate-600">Documento anexado à execução vinculada.</div>
                    <div className="text-xs text-slate-400">Ontem, 09:15</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 rounded-full bg-slate-200 p-1.5">
                    <User className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">Plano criado</div>
                    <div className="text-slate-600">Plano registrado por {responsible}.</div>
                    <div className="text-xs text-slate-400">{created}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar Tarefa
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Upload className="h-4 w-4" />
              Subir Evidência
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Descartar
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
