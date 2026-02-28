"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../../lib/context"
import { revalidatePath } from "next/cache"

export type ActionPlanDetail = {
  id: string
  title: string
  description: string | null
  responsible_name: string | null
  priority: string | null
  status: string | null
  due_date: string | null
  created_at: string | null
  updated_at: string

  execution_id: string | null
  risk_id: string | null
  control_id: string | null

  control_code: string | null
  kpi_code: string | null

  risk_title: string | null
  risk_classification: string | null

  framework: string | null
  mes_ref: string | null

  // ✅ NOVO
  evidence_folder_url: string | null
}

export type ActionPlanTask = {
  id: string
  title: string
  due_date: string | null
  priority: string | null
  responsible_name: string | null
  is_done: boolean
  created_at: string
  done_at: string | null
}

export type ActionPlanRiskOption = {
  id: string
  title: string
  frameworks: string[]
}

export type ActionPlanControlOption = {
  id: string
  label: string
  framework: string | null
}

export type ActionPlanEditOptions = {
  statuses: string[]
  priorities: string[]
  frameworks: string[]
  risks: ActionPlanRiskOption[]
  controls: ActionPlanControlOption[]
}

export type ActionPlanTimelineEvent = {
  id: string
  event_type:
    | "task_created"
    | "task_completed"
    | "task_reopened"
    | "task_deleted"
    | "update_added"
    | "plan_updated"
  task_title: string | null
  metadata: string | null
  created_at: string
}

let _actionPlanEvidenceColumnEnsured = false
async function ensureActionPlanEvidenceColumn() {
  if (_actionPlanEvidenceColumnEnsured) return
  await sql`ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS evidence_folder_url text NULL`
  _actionPlanEvidenceColumnEnsured = true
}

async function fetchEnumValues(enumName: string): Promise<string[]> {
  const { rows } = await sql<{ value: string }>`
    SELECT e.enumlabel::text AS value
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = ${enumName}
    ORDER BY e.enumsortorder
  `
  return rows.map((r) => r.value)
}

let _actionPlanTasksTableEnsured = false
async function ensureActionPlanTasksTable() {
  if (_actionPlanTasksTableEnsured) return
  await sql`
    CREATE TABLE IF NOT EXISTS action_plan_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
      title text NOT NULL,
      due_date date NULL,
      priority text NULL,
      responsible_name text NULL,
      is_done boolean NOT NULL DEFAULT false,
      done_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `

  await sql`ALTER TABLE action_plan_tasks ADD COLUMN IF NOT EXISTS due_date date NULL`
  await sql`ALTER TABLE action_plan_tasks ADD COLUMN IF NOT EXISTS priority text NULL`
  await sql`ALTER TABLE action_plan_tasks ADD COLUMN IF NOT EXISTS responsible_name text NULL`

  await sql`
    CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_tenant_plan
      ON action_plan_tasks(tenant_id, action_plan_id)
  `
  _actionPlanTasksTableEnsured = true
}

let _actionPlanEventsTableEnsured = false
async function ensureActionPlanEventsTable() {
  if (_actionPlanEventsTableEnsured) return
  await sql`
    CREATE TABLE IF NOT EXISTS action_plan_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      task_title text NULL,
      metadata jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_action_plan_events_tenant_plan_created
      ON action_plan_events(tenant_id, action_plan_id, created_at DESC)
  `
  _actionPlanEventsTableEnsured = true
}

async function logActionPlanEvent(input: {
  tenantId: string
  actionPlanId: string
  eventType: ActionPlanTimelineEvent["event_type"]
  taskTitle?: string | null
  metadata?: string | null
}) {
  await ensureActionPlanEventsTable()

  await sql`
    INSERT INTO action_plan_events (
      tenant_id,
      action_plan_id,
      event_type,
      task_title,
      metadata,
      created_at
    )
    VALUES (
      ${input.tenantId},
      ${input.actionPlanId}::uuid,
      ${input.eventType},
      ${input.taskTitle ?? null},
      ${input.metadata ?? null}::jsonb,
      NOW()
    )
  `
}

export async function fetchActionPlanDetail(id: string): Promise<ActionPlanDetail | null> {
  const ctx = await getContext()
  await ensureActionPlanEvidenceColumn()

  const { rows } = await sql<ActionPlanDetail>`
    SELECT
      ap.id,
      ap.title,
      ap.description,
      ap.responsible_name,
      ap.priority::text,
      ap.status::text,
      ap.due_date::text,
      ap.created_at::text,
      ap.updated_at::text,

      ap.execution_id,
      ap.risk_id,
      ap.control_id,
      to_char(date_trunc('month', e.period_start), 'YYYY-MM')::text AS mes_ref,

      c.control_code,
      k.kpi_code,

      r.title AS risk_title,
      r.classification::text AS risk_classification,

      COALESCE(fc.name, fk.name)::text AS framework,

      -- ✅ NOVO
      ap.evidence_folder_url

    FROM action_plans ap

    LEFT JOIN controls c
      ON c.id = ap.control_id
     AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpi_executions e
      ON e.id = ap.execution_id
     AND e.tenant_id = ap.tenant_id

    LEFT JOIN kpis k
      ON k.id = ap.kpi_id
     AND k.tenant_id = ap.tenant_id
    LEFT JOIN controls ck
      ON ck.id = k.control_id
     AND ck.tenant_id = ap.tenant_id
    LEFT JOIN frameworks fc
      ON fc.id = c.framework_id
    LEFT JOIN frameworks fk
      ON fk.id = ck.framework_id

    LEFT JOIN risks r
      ON r.id = ap.risk_id
     AND r.tenant_id = ap.tenant_id

    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${id}::uuid

    LIMIT 1
  `

  return rows[0] ?? null
}

export async function fetchActionPlanEditOptions(): Promise<ActionPlanEditOptions> {
  const ctx = await getContext()
  const [statuses, priorities, frameworksRes, risksRes, controlsRes] = await Promise.all([
    fetchEnumValues("action_status"),
    fetchEnumValues("action_priority"),
    sql<{ name: string }>`
      SELECT f.name::text AS name
      FROM frameworks f
      ORDER BY f.name ASC
    `,
    sql<{ id: string; title: string; frameworks_csv: string | null }>`
      SELECT r.id, r.title
           , string_agg(DISTINCT f.name::text, ' | ') AS frameworks_csv
      FROM risks r
      LEFT JOIN controls c
        ON c.risk_id = r.id
       AND c.tenant_id = r.tenant_id
      LEFT JOIN frameworks f
        ON f.id = c.framework_id
      WHERE r.tenant_id = ${ctx.tenantId}
      GROUP BY r.id, r.title
      ORDER BY r.title ASC
    `,
    sql<{ id: string; control_code: string | null; name: string | null; framework: string | null }>`
      SELECT c.id, c.control_code::text AS control_code, c.name::text AS name, f.name::text AS framework
      FROM controls c
      LEFT JOIN frameworks f
        ON f.id = c.framework_id
      WHERE c.tenant_id = ${ctx.tenantId}
      ORDER BY c.control_code ASC NULLS LAST, c.name ASC
    `,
  ])

  return {
    statuses,
    priorities,
    frameworks: frameworksRes.rows.map((f) => f.name),
    risks: risksRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      frameworks: (r.frameworks_csv ?? "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean),
    })),
    controls: controlsRes.rows.map((c) => ({
      id: c.id,
      label: [c.control_code, c.name].filter(Boolean).join(" - ") || c.id,
      framework: c.framework ?? null,
    })),
  }
}

export async function fetchActionPlanTasks(actionPlanId: string): Promise<ActionPlanTask[]> {
  const ctx = await getContext()
  await ensureActionPlanTasksTable()

  const { rows } = await sql<ActionPlanTask>`
    SELECT
      t.id,
      t.title,
      t.due_date::text AS due_date,
      t.priority,
      t.responsible_name,
      t.is_done,
      t.created_at::text AS created_at,
      t.done_at::text AS done_at
    FROM action_plan_tasks t
    WHERE t.tenant_id = ${ctx.tenantId}
      AND t.action_plan_id = ${actionPlanId}::uuid
    ORDER BY t.created_at ASC
  `

  return rows
}

export async function fetchActionPlanEvents(actionPlanId: string): Promise<ActionPlanTimelineEvent[]> {
  const ctx = await getContext()
  await ensureActionPlanEventsTable()

  const { rows } = await sql<ActionPlanTimelineEvent>`
    SELECT
      e.id,
      e.event_type::text AS event_type,
      e.task_title,
      e.metadata::text AS metadata,
      e.created_at::text AS created_at
    FROM action_plan_events e
    WHERE e.tenant_id = ${ctx.tenantId}
      AND e.action_plan_id = ${actionPlanId}::uuid
    ORDER BY e.created_at DESC
    LIMIT 50
  `

  return rows
}

export async function addActionPlanTask(formData: FormData) {
  const ctx = await getContext()
  await ensureActionPlanTasksTable()

  const actionPlanId = String(formData.get("actionPlanId") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const dueDateInput = String(formData.get("dueDate") ?? "").trim()
  const dueDate = dueDateInput || null
  const priorityInput = String(formData.get("priority") ?? "").trim().toLowerCase()
  const priority = priorityInput || null
  const responsibleNameInput = String(formData.get("responsibleName") ?? "").trim()
  const responsibleName = responsibleNameInput || null

  if (!actionPlanId) throw new Error("Plano inválido.")
  if (!title) throw new Error("Informe o título da tarefa.")

  const exists = await sql<{ id: string }>`
    SELECT ap.id
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${actionPlanId}::uuid
    LIMIT 1
  `
  if (!exists.rows[0]?.id) throw new Error("Plano não encontrado.")

  await sql`
    INSERT INTO action_plan_tasks (
      tenant_id,
      action_plan_id,
      title,
      due_date,
      priority,
      responsible_name,
      is_done,
      done_at,
      created_at,
      updated_at
    )
    VALUES (
      ${ctx.tenantId},
      ${actionPlanId}::uuid,
      ${title},
      ${dueDate}::date,
      ${priority},
      ${responsibleName},
      false,
      null,
      NOW(),
      NOW()
    )
  `

  await logActionPlanEvent({
    tenantId: ctx.tenantId,
    actionPlanId,
    eventType: "task_created",
    taskTitle: title,
  })

  revalidatePath(`/action-plans/${actionPlanId}`)
}

export async function toggleActionPlanTask(formData: FormData) {
  const ctx = await getContext()
  await ensureActionPlanTasksTable()

  const actionPlanId = String(formData.get("actionPlanId") ?? "").trim()
  const taskId = String(formData.get("taskId") ?? "").trim()
  const nextDone = String(formData.get("nextDone") ?? "false").trim() === "true"

  if (!actionPlanId || !taskId) throw new Error("Tarefa inválida.")

  const toggleRes = await sql<{ title: string }>`
    UPDATE action_plan_tasks t
    SET
      is_done = ${nextDone},
      done_at = CASE WHEN ${nextDone} THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE t.tenant_id = ${ctx.tenantId}
      AND t.action_plan_id = ${actionPlanId}::uuid
      AND t.id = ${taskId}::uuid
    RETURNING t.title
  `

  const taskTitle = toggleRes.rows[0]?.title ?? null
  if (taskTitle) {
    await logActionPlanEvent({
      tenantId: ctx.tenantId,
      actionPlanId,
      eventType: nextDone ? "task_completed" : "task_reopened",
      taskTitle,
    })
  }

  revalidatePath(`/action-plans/${actionPlanId}`)
}

export async function deleteActionPlanTask(formData: FormData) {
  const ctx = await getContext()
  await ensureActionPlanTasksTable()

  const actionPlanId = String(formData.get("actionPlanId") ?? "").trim()
  const taskId = String(formData.get("taskId") ?? "").trim()

  if (!actionPlanId || !taskId) throw new Error("Tarefa inválida.")

  const taskRes = await sql<{ title: string }>`
    SELECT t.title
    FROM action_plan_tasks t
    WHERE t.tenant_id = ${ctx.tenantId}
      AND t.action_plan_id = ${actionPlanId}::uuid
      AND t.id = ${taskId}::uuid
    LIMIT 1
  `
  const taskTitle = taskRes.rows[0]?.title ?? null

  await sql`
    DELETE FROM action_plan_tasks t
    WHERE t.tenant_id = ${ctx.tenantId}
      AND t.action_plan_id = ${actionPlanId}::uuid
      AND t.id = ${taskId}::uuid
  `

  if (taskTitle) {
    await logActionPlanEvent({
      tenantId: ctx.tenantId,
      actionPlanId,
      eventType: "task_deleted",
      taskTitle,
    })
  }

  revalidatePath(`/action-plans/${actionPlanId}`)
}

/**
 * ✅ NOVO: salva/remove o link da pasta de evidências do Google Drive
 */
export async function setActionPlanEvidenceFolder(formData: FormData) {
  const ctx = await getContext()
  await ensureActionPlanEvidenceColumn()

  const actionPlanId = String(formData.get("actionPlanId") ?? "").trim()
  const urlRaw = String(formData.get("evidenceFolderUrl") ?? "").trim()
  const remove = String(formData.get("remove") ?? "").trim() === "1"

  if (!actionPlanId) throw new Error("Plano inválido.")

  const url = remove ? null : (urlRaw || null)

  // garante que o plano existe e é do tenant
  const exists = await sql<{ id: string }>`
    SELECT ap.id
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${actionPlanId}::uuid
    LIMIT 1
  `
  if (!exists.rows[0]?.id) throw new Error("Plano não encontrado.")

  await sql`
    UPDATE action_plans ap
    SET
      evidence_folder_url = ${url},
      updated_at = NOW()
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${actionPlanId}::uuid
  `

  revalidatePath(`/action-plans/${actionPlanId}`)
}

export async function updateActionPlanFromModal(formData: FormData) {
  const ctx = await getContext()

  const actionPlanId = String(formData.get("actionPlanId") ?? "").trim()
  const responsibleNameRaw = String(formData.get("responsibleName") ?? "").trim()
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim()
  const priorityRaw = String(formData.get("priority") ?? "").trim().toLowerCase()
  const statusRaw = String(formData.get("status") ?? "").trim().toLowerCase()
  const descriptionRaw = String(formData.get("description") ?? "").trim()
  const riskInputRaw = String(formData.get("riskInput") ?? "").trim()
  const controlInputRaw = String(formData.get("controlInput") ?? "").trim()
  const riskInputProvided = formData.has("riskInput")
  const controlInputProvided = formData.has("controlInput")
  const originModeRaw = String(formData.get("originMode") ?? "keep").trim().toLowerCase()

  if (!actionPlanId) throw new Error("Plano inválido.")

  const responsibleName = responsibleNameRaw || null
  const dueDate = dueDateRaw || null
  const priority = priorityRaw || null
  const status = statusRaw || null
  const description = descriptionRaw || null
  const originMode = ["keep", "risk", "control", "manual"].includes(originModeRaw)
    ? originModeRaw
    : "keep"

  const [statusValues, priorityValues] = await Promise.all([
    fetchEnumValues("action_status"),
    fetchEnumValues("action_priority"),
  ])

  if (status && !statusValues.includes(status)) {
    throw new Error("Status inválido para action_status.")
  }
  if (priority && !priorityValues.includes(priority)) {
    throw new Error("Prioridade inválida para action_priority.")
  }

  const exists = await sql<{
    id: string
    responsible_name: string | null
    due_date: string | null
    priority: string | null
    status: string | null
    description: string | null
    risk_id: string | null
    control_id: string | null
  }>`
    SELECT ap.id
         , ap.responsible_name
         , ap.due_date::text AS due_date
         , ap.priority::text AS priority
         , ap.status::text AS status
         , ap.description
         , ap.risk_id::text AS risk_id
         , ap.control_id::text AS control_id
    FROM action_plans ap
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${actionPlanId}::uuid
    LIMIT 1
  `
  const before = exists.rows[0]
  if (!before?.id) throw new Error("Plano não encontrado.")

  const riskInput = riskInputRaw || null
  const controlInput = controlInputRaw || null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  let resolvedRiskId: string | null = null
  let resolvedControlId: string | null = null

  if (riskInput) {
    const riskRes = uuidRegex.test(riskInput)
      ? await sql<{ id: string }>`
          SELECT r.id
          FROM risks r
          WHERE r.tenant_id = ${ctx.tenantId}
            AND r.id = ${riskInput}::uuid
          LIMIT 1
        `
      : await sql<{ id: string }>`
          SELECT r.id
          FROM risks r
          WHERE r.tenant_id = ${ctx.tenantId}
            AND r.title ILIKE ${`%${riskInput}%`}
          ORDER BY r.title ASC
          LIMIT 1
        `
    resolvedRiskId = riskRes.rows[0]?.id ?? null
    if (!resolvedRiskId) throw new Error("Risco inválido para este tenant.")
  }

  if (controlInput) {
    const controlRes = uuidRegex.test(controlInput)
      ? await sql<{ id: string }>`
          SELECT c.id
          FROM controls c
          WHERE c.tenant_id = ${ctx.tenantId}
            AND c.id = ${controlInput}::uuid
          LIMIT 1
        `
      : await sql<{ id: string }>`
          SELECT c.id
          FROM controls c
          WHERE c.tenant_id = ${ctx.tenantId}
            AND (
              COALESCE(c.control_code, '') ILIKE ${`%${controlInput}%`}
              OR COALESCE(c.name, '') ILIKE ${`%${controlInput}%`}
            )
          ORDER BY c.control_code ASC NULLS LAST, c.name ASC
          LIMIT 1
        `
    resolvedControlId = controlRes.rows[0]?.id ?? null
    if (!resolvedControlId) throw new Error("Controle inválido para este tenant.")
  }

  let riskIdForUpdate = before.risk_id
  let controlIdForUpdate = before.control_id

  if (originMode === "manual") {
    riskIdForUpdate = null
    controlIdForUpdate = null
  } else if (originMode === "risk") {
    riskIdForUpdate = resolvedRiskId
    controlIdForUpdate = null
  } else if (originMode === "control") {
    controlIdForUpdate = resolvedControlId
    riskIdForUpdate = null
  } else {
    if (riskInputProvided) riskIdForUpdate = riskInput ? resolvedRiskId : null
    if (controlInputProvided) controlIdForUpdate = controlInput ? resolvedControlId : null
  }

  await sql`
    UPDATE action_plans ap
    SET
      responsible_name = ${responsibleName},
      due_date = ${dueDate}::date,
      priority = COALESCE(${priority}::action_priority, ap.priority),
      status = COALESCE(${status}::action_status, ap.status),
      description = ${description},
      risk_id = ${riskIdForUpdate}::uuid,
      control_id = ${controlIdForUpdate}::uuid,
      updated_at = NOW()
    WHERE ap.tenant_id = ${ctx.tenantId}
      AND ap.id = ${actionPlanId}::uuid
  `

  const changes: string[] = []
  if ((before.responsible_name ?? "") !== (responsibleName ?? "")) {
    changes.push(`Responsável alterado para ${responsibleName ?? "não definido"}.`)
  }
  if ((before.due_date ?? "") !== (dueDate ?? "")) {
    changes.push(`Prazo final alterado para ${dueDate ?? "não definido"}.`)
  }
  if ((before.priority ?? "") !== (priority ?? before.priority ?? "")) {
    changes.push(`Prioridade alterada para ${priority ?? before.priority ?? "—"}.`)
  }
  if ((before.status ?? "") !== (status ?? before.status ?? "")) {
    changes.push(`Status alterado para ${status ?? before.status ?? "—"}.`)
  }
  if ((before.description ?? "") !== (description ?? "")) {
    changes.push("Detalhamento do plano atualizado.")
  }
  if ((before.risk_id ?? "") !== (riskIdForUpdate ?? "")) {
    changes.push(riskIdForUpdate ? "Vínculo de risco atualizado." : "Vínculo de risco removido.")
  }
  if ((before.control_id ?? "") !== (controlIdForUpdate ?? "")) {
    changes.push(controlIdForUpdate ? "Vínculo de controle atualizado." : "Vínculo de controle removido.")
  }
  if (originMode !== "keep") {
    const originLabel =
      originMode === "risk" ? "risco" : originMode === "control" ? "controle" : "manual"
    changes.push(`Origem principal alterada para ${originLabel}.`)
  }

  for (const message of changes) {
    await logActionPlanEvent({
      tenantId: ctx.tenantId,
      actionPlanId,
      eventType: "plan_updated",
      metadata: JSON.stringify({ message }),
    })
  }

  revalidatePath(`/action-plans/${actionPlanId}`)
  revalidatePath("/action-plans")
}
