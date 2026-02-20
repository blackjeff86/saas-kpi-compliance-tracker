import Link from "next/link"
import { notFound } from "next/navigation"

import PageContainer from "../../PageContainer"
import TasksChecklistClient from "./TasksChecklistClient"
import ActionPlanActionsButtonClient from "./ActionPlanActionsButtonClient"

import {
  fetchActionPlanDetail,
  fetchActionPlanEditOptions,
  fetchActionPlanEvents,
  fetchActionPlanTasks,
} from "./actions"

import {
  ArrowLeft,
  CalendarDays,
  Flag,
  FileText,
  CheckSquare,
  Clock3,
  FilePlus2,
  ListPlus,
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

function formatDateTime(v?: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function parseEventMessage(metadata?: string | null) {
  if (!metadata) return "Plano atualizado."
  try {
    const parsed = JSON.parse(metadata) as { message?: string }
    return parsed.message?.trim() || "Plano atualizado."
  } catch {
    return "Plano atualizado."
  }
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
  return 0
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
  const [tasks, events, editOptions] = await Promise.all([
    fetchActionPlanTasks(id),
    fetchActionPlanEvents(id),
    fetchActionPlanEditOptions(),
  ])

  const created = formatDate(plan.created_at ?? plan.updated_at)
  const due = formatDate(plan.due_date)
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.is_done).length
  const progress =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : progressFromStatus(plan.status)
  const responsible = plan.responsible_name?.trim() || "Não definido"
  const titleCode = plan.id.slice(0, 8).toUpperCase()
  const sourceMonthRef = plan.mes_ref ?? toMonthRefFromDate(plan.created_at ?? plan.updated_at)
  const sourceMonthLabel = formatMonthRef(sourceMonthRef)

  const evidenceUrl = plan.evidence_folder_url?.trim() || null

  const timeline = [
    {
      id: "plan-updated",
      at: plan.updated_at,
      icon: <Clock3 className="h-3.5 w-3.5 text-primary" />,
      bubble: "bg-primary/10",
      title: "Plano atualizado",
      description: `Status atual: ${statusLabel(plan.status)}.`,
    },
    {
      id: "plan-created",
      at: plan.created_at ?? plan.updated_at,
      icon: <FilePlus2 className="h-3.5 w-3.5 text-emerald-700" />,
      bubble: "bg-emerald-100",
      title: "Plano criado",
      description: `Plano registrado por ${responsible}.`,
    },
    ...events.map((event) => {
      if (event.event_type === "plan_updated") {
        return {
          id: event.id,
          at: event.created_at,
          icon: <Clock3 className="h-3.5 w-3.5 text-primary" />,
          bubble: "bg-primary/10",
          title: "Plano atualizado",
          description: parseEventMessage(event.metadata),
        }
      }
      if (event.event_type === "task_completed") {
        return {
          id: event.id,
          at: event.created_at,
          icon: <CheckSquare className="h-3.5 w-3.5 text-emerald-700" />,
          bubble: "bg-emerald-100",
          title: "Tarefa concluída",
          description: event.task_title ?? "—",
        }
      }
      if (event.event_type === "task_reopened") {
        return {
          id: event.id,
          at: event.created_at,
          icon: <Clock3 className="h-3.5 w-3.5 text-amber-700" />,
          bubble: "bg-amber-100",
          title: "Tarefa reaberta",
          description: event.task_title ?? "—",
        }
      }
      if (event.event_type === "task_deleted") {
        return {
          id: event.id,
          at: event.created_at,
          icon: <Clock3 className="h-3.5 w-3.5 text-rose-700" />,
          bubble: "bg-rose-100",
          title: "Tarefa deletada",
          description: event.task_title ?? "—",
        }
      }
      return {
        id: event.id,
        at: event.created_at,
        icon: <ListPlus className="h-3.5 w-3.5 text-slate-700" />,
        bubble: "bg-slate-200",
        title: "Tarefa adicionada",
        description: event.task_title ?? "—",
      }
    }),
  ]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 12)

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
            <ActionPlanActionsButtonClient
              plan={{
                id: plan.id,
                responsible_name: plan.responsible_name,
                due_date: plan.due_date,
                priority: plan.priority,
                status: plan.status,
                description: plan.description,
                risk_id: plan.risk_id,
                control_id: plan.control_id,
              }}
              options={editOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Progresso Atual</div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-extrabold text-slate-800">{progress}%</div>
              <div className="text-xs font-semibold text-primary">
                {doneTasks}/{totalTasks} tarefas
              </div>
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
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Evidências</div>
                  {evidenceUrl ? (
                    <div className="space-y-1">
                      <div className="text-slate-600">Pasta vinculada:</div>
                      <a
                        className="font-semibold text-primary hover:underline"
                        href={evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        abrir pasta de evidências
                      </a>
                    </div>
                  ) : (
                    <div className="text-slate-500">Não definida.</div>
                  )}
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

            <TasksChecklistClient
              actionPlanId={plan.id}
              defaultResponsibleName={responsible}
              tasks={tasks}
              evidenceFolderUrl={evidenceUrl}
            />
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
                {timeline.length === 0 ? (
                  <div className="text-slate-500">Sem atividades recentes.</div>
                ) : (
                  timeline.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className={`mt-1 rounded-full p-1.5 ${event.bubble}`}>{event.icon}</div>
                      <div>
                        <div className="font-semibold text-slate-800">{event.title}</div>
                        <div className="text-slate-600">{event.description}</div>
                        <div className="text-xs text-slate-400">{formatDateTime(event.at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
