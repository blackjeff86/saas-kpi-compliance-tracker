"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Circle, PlusCircle, Trash2, Folder, ExternalLink, X } from "lucide-react"
import { formatDatePtBr } from "@/lib/utils"
import {
  addActionPlanTask,
  deleteActionPlanTask,
  toggleActionPlanTask,
  setActionPlanEvidenceFolder,
  type ActionPlanTask,
} from "./actions"

type TasksChecklistClientProps = {
  actionPlanId: string
  defaultResponsibleName: string
  tasks: ActionPlanTask[]
  evidenceFolderUrl: string | null
}

function formatTaskDueDate(v?: string | null) {
  if (!v) return "Sem prazo"
  const formatted = formatDatePtBr(v)
  return formatted === "—" ? "Sem prazo" : formatted
}

function priorityLabel(value?: string | null) {
  const v = (value || "").toLowerCase()
  if (v === "critical") return "Crítica"
  if (v === "high") return "Alta"
  if (v === "medium") return "Média"
  if (v === "low") return "Baixa"
  return "—"
}

function priorityBadgeClass(value?: string | null) {
  const v = (value || "").toLowerCase()
  if (v === "critical") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
  if (v === "high") return "border-rose-200 bg-rose-50 text-rose-700"
  if (v === "medium") return "border-amber-200 bg-amber-50 text-amber-700"
  if (v === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

function normalizeUrl(v: string) {
  const s = (v || "").trim()
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

export default function TasksChecklistClient({
  actionPlanId,
  defaultResponsibleName,
  tasks,
  evidenceFolderUrl,
}: TasksChecklistClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null)

  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false)
  const [evidenceInput, setEvidenceInput] = useState(evidenceFolderUrl ?? "")

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((task) => task.is_done).length
    return { total, done }
  }, [tasks])

  function openEvidenceModal() {
    setEvidenceInput(evidenceFolderUrl ?? "")
    setIsEvidenceOpen(true)
  }

  // ✅ abre o modal quando clicar no botão "Ações" no topo
  useEffect(() => {
    function handler() {
      openEvidenceModal()
    }
    window.addEventListener("actionplan:open-evidence-modal", handler)
    return () => window.removeEventListener("actionplan:open-evidence-modal", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceFolderUrl])

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800">Checklist de Tarefas</div>
          <div className="text-xs font-semibold text-primary">
            {stats.done}/{stats.total} concluídas
          </div>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {tasks.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhuma tarefa cadastrada para este plano.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-3">
                <form action={toggleActionPlanTask} className="flex flex-1 items-start gap-3">
                  <input type="hidden" name="actionPlanId" value={actionPlanId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="nextDone" value={task.is_done ? "false" : "true"} />
                  <button type="submit" className="mt-0.5" title={task.is_done ? "Marcar pendente" : "Concluir tarefa"}>
                    {task.is_done ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300" />
                    )}
                  </button>

                  <div>
                    <div className={`font-semibold ${task.is_done ? "text-slate-700 line-through" : "text-slate-700"}`}>
                      {task.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{task.is_done ? "Concluída" : "Pendente"}</span>
                      <span>•</span>
                      <span>{formatTaskDueDate(task.due_date)}</span>
                      <span>•</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${priorityBadgeClass(task.priority)}`}>
                        {priorityLabel(task.priority)}
                      </span>
                      <span>•</span>
                      <span>{task.responsible_name?.trim() || "Sem responsável"}</span>
                    </div>
                  </div>
                </form>

                <div>
                  <button
                    type="button"
                    onClick={() => setTaskToDelete({ id: task.id, title: task.title })}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    title="Deletar tarefa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar Tarefa
          </button>

          <button
            type="button"
            onClick={openEvidenceModal}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            title="Vincular pasta do Google Drive para evidências"
          >
            <Folder className="h-4 w-4" />
            Pasta de Evidências
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Descartar
          </button>
          <button type="button" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-95">
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* Modal: Pasta de evidências */}
      {isEvidenceOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Pasta de Evidências (Google Drive)</h3>
                <p className="text-xs text-slate-500 mt-1">Cole o link da pasta onde o time irá anexar as evidências.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEvidenceOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="evidence-url" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Link da pasta
                </label>
                <input
                  id="evidence-url"
                  type="url"
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  placeholder="https://drive.google.com/drive/folders/..."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {evidenceFolderUrl ? (
                    <a
                      href={evidenceFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title="Abrir pasta"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir pasta
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">Nenhuma pasta vinculada.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {evidenceFolderUrl ? (
                    <form action={setActionPlanEvidenceFolder} onSubmit={() => setIsEvidenceOpen(false)}>
                      <input type="hidden" name="actionPlanId" value={actionPlanId} />
                      <input type="hidden" name="remove" value="1" />
                      <button type="submit" className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                        Remover vínculo
                      </button>
                    </form>
                  ) : null}

                  <form action={setActionPlanEvidenceFolder} onSubmit={() => setIsEvidenceOpen(false)}>
                    <input type="hidden" name="actionPlanId" value={actionPlanId} />
                    <input type="hidden" name="evidenceFolderUrl" value={normalizeUrl(evidenceInput)} />
                    <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                      Salvar
                    </button>
                  </form>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Dica: você pode criar uma pasta por campanha (ex.: “SOX 2026”) e salvar o link aqui.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: confirmar deleção */}
      {taskToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-800">Confirmar deleção</h3>
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-700">Deseja realmente deletar esta tarefa?</p>
              <p className="text-sm font-semibold text-slate-800">{taskToDelete.title}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <form action={deleteActionPlanTask} onSubmit={() => setTaskToDelete(null)}>
                  <input type="hidden" name="actionPlanId" value={actionPlanId} />
                  <input type="hidden" name="taskId" value={taskToDelete.id} />
                  <button type="submit" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                    Deletar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Nova tarefa */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-800">Nova Tarefa</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={addActionPlanTask} onSubmit={() => setIsModalOpen(false)} className="space-y-4 p-5">
              <input type="hidden" name="actionPlanId" value={actionPlanId} />

              <div>
                <label htmlFor="task-title" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Tarefa
                </label>
                <input
                  id="task-title"
                  name="title"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  placeholder="Ex.: Validar evidências do controle"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="task-due-date" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Data de conclusão
                  </label>
                  <input
                    id="task-due-date"
                    name="dueDate"
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label htmlFor="task-priority" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Priorização
                  </label>
                  <select
                    id="task-priority"
                    name="priority"
                    defaultValue="medium"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="task-responsible" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Responsável
                </label>
                <input
                  id="task-responsible"
                  name="responsibleName"
                  type="text"
                  defaultValue={defaultResponsibleName}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                  Salvar tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}