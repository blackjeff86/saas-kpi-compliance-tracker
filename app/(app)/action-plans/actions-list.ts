// app/(app)/action-plans/actions-list.ts
"use server"

import { sql } from "@vercel/postgres"
import { unstable_cache } from "next/cache"
import { getContext } from "../lib/context"
import { getActionPlansScope } from "../lib/authz"
import { ensureTeamIdColumns } from "../lib/rbac-migrations"

export type ActionPlanListRow = {
  id: string
  title: string
  description: string | null
  responsible_name: string | null
  progress_percent: number
  priority: string | null
  status: string | null
  due_date: string | null

  // origem execution
  execution_id: string | null
  control_code: string | null
  kpi_code: string | null
  auto_status: string | null
  workflow_status: string | null

  // origem risk
  risk_id: string | null
  risk_title: string | null
  risk_classification: string | null
}

export type ActionPlansListFilters = {
  riskId?: string
  framework?: string
  responsible?: string
  status?: string
  priority?: string
}

export type FetchActionPlansPageInput = ActionPlansListFilters & {
  limit?: number
  offset?: number
}

export type ActionPlansPageResult = {
  rows: ActionPlanListRow[]
  total: number
}

export type ActionPlansSummary = {
  total: number
  in_progress: number
  overdue: number
  done: number
}

function normalizeString(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function ensureActionPlanTasksTable() {
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
}

let ensureActionPlanTasksTablePromise: Promise<void> | null = null
async function ensureActionPlanTasksTableOnce() {
  if (!ensureActionPlanTasksTablePromise) {
    ensureActionPlanTasksTablePromise = ensureActionPlanTasksTable()
  }
  await ensureActionPlanTasksTablePromise
}

let ensureTeamIdColumnsPromise: Promise<void> | null = null
async function ensureTeamIdColumnsOnce() {
  if (!ensureTeamIdColumnsPromise) {
    ensureTeamIdColumnsPromise = ensureTeamIdColumns()
  }
  await ensureTeamIdColumnsPromise
}

export async function fetchActionPlansPage(input?: FetchActionPlansPageInput): Promise<ActionPlansPageResult> {
  const ctx = await getContext()
  await ensureActionPlanTasksTableOnce()
  await ensureTeamIdColumnsOnce()
  const scope = await getActionPlansScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const riskId = normalizeString(input?.riskId)
  const framework = normalizeString(input?.framework)
  const responsible = normalizeString(input?.responsible)
  const responsibleLike = responsible ? `%${responsible}%` : null
  const status = normalizeString(input?.status)
  const priority = normalizeString(input?.priority)
  const limit = Math.max(1, Math.min(100, input?.limit ?? 10))
  const offset = Math.max(0, input?.offset ?? 0)

  const totalRes = noScope
    ? await sql<{ total: number }>`
        SELECT COUNT(*)::int AS total
        FROM action_plans ap
        LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
        LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
        LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
        LEFT JOIN frameworks fc ON fc.id = c.framework_id
        LEFT JOIN frameworks fk ON fk.id = ck.framework_id
        WHERE ap.tenant_id = ${ctx.tenantId}::uuid
          AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
          AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
          AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
          AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
          AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
      `
    : oneTeam
      ? await sql<{ total: number }>`
          SELECT COUNT(*)::int AS total
          FROM action_plans ap
          LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
          LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
          LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
          LEFT JOIN frameworks fc ON fc.id = c.framework_id
          LEFT JOIN frameworks fk ON fk.id = ck.framework_id
          WHERE ap.tenant_id = ${ctx.tenantId}::uuid
            AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
            AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
            AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
            AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
            AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
            AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
        `
      : await sql<{ total: number }>`
          SELECT COUNT(*)::int AS total
          FROM action_plans ap
          LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
          LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
          LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
          LEFT JOIN frameworks fc ON fc.id = c.framework_id
          LEFT JOIN frameworks fk ON fk.id = ck.framework_id
          WHERE ap.tenant_id = ${ctx.tenantId}::uuid
            AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
            AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
            AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
            AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
            AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
            AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
        `

  const rowsRes = noScope
    ? await sql<ActionPlanListRow>`
    SELECT
      ap.id::text AS id,
      ap.title::text AS title,
      ap.description::text AS description,
      ap.responsible_name::text AS responsible_name,

      CASE
        WHEN COALESCE(tc.task_total, 0) > 0
          THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int
        WHEN ap.status::text = 'done' THEN 100
        ELSE 0
      END::int AS progress_percent,

      ap.priority::text AS priority,
      ap.status::text AS status,
      ap.due_date::text AS due_date,

      ap.execution_id::text AS execution_id,
      c.control_code::text AS control_code,
      k.kpi_code::text AS kpi_code,
      e.auto_status::text AS auto_status,
      e.workflow_status::text AS workflow_status,

      ap.risk_id::text AS risk_id,
      r.title::text AS risk_title,
      r.classification::text AS risk_classification

    FROM action_plans ap

    LEFT JOIN kpi_executions e
      ON e.id = ap.execution_id
     AND e.tenant_id = ap.tenant_id

    LEFT JOIN controls c
      ON c.id = ap.control_id
     AND c.tenant_id = ap.tenant_id

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

    -- ✅ alinhar com o resto do projeto (risk_catalog)
    LEFT JOIN risk_catalog r
      ON r.id = ap.risk_id
     AND r.tenant_id = ap.tenant_id

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS task_total,
        SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done
      FROM action_plan_tasks t
      WHERE t.tenant_id = ap.tenant_id
        AND t.action_plan_id = ap.id
    ) tc ON true

    WHERE ap.tenant_id = ${ctx.tenantId}::uuid
      AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
      AND (
        ${framework}::text IS NULL
        OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text))
      )
      AND (
        ${responsibleLike}::text IS NULL
        OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text)
      )
      AND (
        ${status}::text IS NULL
        OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text))
      )
      AND (
        ${priority}::text IS NULL
        OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text))
      )

    ORDER BY ap.updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `
    : oneTeam
      ? await sql<ActionPlanListRow>`
    SELECT ap.id::text AS id, ap.title::text AS title, ap.description::text AS description, ap.responsible_name::text AS responsible_name, CASE WHEN COALESCE(tc.task_total, 0) > 0 THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int WHEN ap.status::text = 'done' THEN 100 ELSE 0 END::int AS progress_percent, ap.priority::text AS priority, ap.status::text AS status, ap.due_date::text AS due_date, ap.execution_id::text AS execution_id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code, e.auto_status::text AS auto_status, e.workflow_status::text AS workflow_status, ap.risk_id::text AS risk_id, r.title::text AS risk_title, r.classification::text AS risk_classification
    FROM action_plans ap
    LEFT JOIN kpi_executions e ON e.id = ap.execution_id AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
    LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
    LEFT JOIN frameworks fc ON fc.id = c.framework_id
    LEFT JOIN frameworks fk ON fk.id = ck.framework_id
    LEFT JOIN risk_catalog r ON r.id = ap.risk_id AND r.tenant_id = ap.tenant_id
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS task_total, SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done FROM action_plan_tasks t WHERE t.tenant_id = ap.tenant_id AND t.action_plan_id = ap.id) tc ON true
    WHERE ap.tenant_id = ${ctx.tenantId}::uuid AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
      AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
      AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
      AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
      AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
      AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
    ORDER BY ap.updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `
      : await sql<ActionPlanListRow>`
    SELECT ap.id::text AS id, ap.title::text AS title, ap.description::text AS description, ap.responsible_name::text AS responsible_name, CASE WHEN COALESCE(tc.task_total, 0) > 0 THEN ROUND((COALESCE(tc.task_done, 0)::numeric * 100.0) / COALESCE(tc.task_total, 0))::int WHEN ap.status::text = 'done' THEN 100 ELSE 0 END::int AS progress_percent, ap.priority::text AS priority, ap.status::text AS status, ap.due_date::text AS due_date, ap.execution_id::text AS execution_id, c.control_code::text AS control_code, k.kpi_code::text AS kpi_code, e.auto_status::text AS auto_status, e.workflow_status::text AS workflow_status, ap.risk_id::text AS risk_id, r.title::text AS risk_title, r.classification::text AS risk_classification
    FROM action_plans ap
    LEFT JOIN kpi_executions e ON e.id = ap.execution_id AND e.tenant_id = ap.tenant_id
    LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
    LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
    LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
    LEFT JOIN frameworks fc ON fc.id = c.framework_id
    LEFT JOIN frameworks fk ON fk.id = ck.framework_id
    LEFT JOIN risk_catalog r ON r.id = ap.risk_id AND r.tenant_id = ap.tenant_id
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS task_total, SUM(CASE WHEN t.is_done THEN 1 ELSE 0 END)::int AS task_done FROM action_plan_tasks t WHERE t.tenant_id = ap.tenant_id AND t.action_plan_id = ap.id) tc ON true
    WHERE ap.tenant_id = ${ctx.tenantId}::uuid AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
      AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
      AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
      AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
      AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
      AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
    ORDER BY ap.updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return {
    rows: rowsRes.rows,
    total: totalRes.rows[0]?.total ?? 0,
  }
}

export async function fetchActionPlansSummary(input?: ActionPlansListFilters): Promise<ActionPlansSummary> {
  const ctx = await getContext()
  await ensureTeamIdColumnsOnce()
  const scope = await getActionPlansScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string

  const riskId = normalizeString(input?.riskId)
  const framework = normalizeString(input?.framework)
  const responsible = normalizeString(input?.responsible)
  const responsibleLike = responsible ? `%${responsible}%` : null
  const status = normalizeString(input?.status)
  const priority = normalizeString(input?.priority)

  const summaryRes = noScope
    ? await sql<ActionPlansSummary>`
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN ap.status::text = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
          SUM(CASE WHEN ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue,
          SUM(CASE WHEN ap.status::text = 'done' THEN 1 ELSE 0 END)::int AS done
        FROM action_plans ap
        LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
        LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
        LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
        LEFT JOIN frameworks fc ON fc.id = c.framework_id
        LEFT JOIN frameworks fk ON fk.id = ck.framework_id
        WHERE ap.tenant_id = ${ctx.tenantId}::uuid
          AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
          AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
          AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
          AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
          AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
      `
    : oneTeam
      ? await sql<ActionPlansSummary>`
          SELECT
            COUNT(*)::int AS total,
            SUM(CASE WHEN ap.status::text = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
            SUM(CASE WHEN ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue,
            SUM(CASE WHEN ap.status::text = 'done' THEN 1 ELSE 0 END)::int AS done
          FROM action_plans ap
          LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
          LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
          LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
          LEFT JOIN frameworks fc ON fc.id = c.framework_id
          LEFT JOIN frameworks fk ON fk.id = ck.framework_id
          WHERE ap.tenant_id = ${ctx.tenantId}::uuid
            AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
            AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
            AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
            AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
            AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
            AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
        `
      : await sql<ActionPlansSummary>`
          SELECT
            COUNT(*)::int AS total,
            SUM(CASE WHEN ap.status::text = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
            SUM(CASE WHEN ap.status::text <> 'done' AND ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue,
            SUM(CASE WHEN ap.status::text = 'done' THEN 1 ELSE 0 END)::int AS done
          FROM action_plans ap
          LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
          LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
          LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
          LEFT JOIN frameworks fc ON fc.id = c.framework_id
          LEFT JOIN frameworks fk ON fk.id = ck.framework_id
          WHERE ap.tenant_id = ${ctx.tenantId}::uuid
            AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
            AND (${riskId}::uuid IS NULL OR ap.risk_id = ${riskId}::uuid)
            AND (${framework}::text IS NULL OR lower(btrim(COALESCE(fc.name, fk.name)::text)) = lower(btrim(${framework}::text)))
            AND (${responsibleLike}::text IS NULL OR lower(COALESCE(ap.responsible_name, '')) LIKE lower(${responsibleLike}::text))
            AND (${status}::text IS NULL OR lower(btrim(COALESCE(ap.status::text, ''))) = lower(btrim(${status}::text)))
            AND (${priority}::text IS NULL OR lower(btrim(COALESCE(ap.priority::text, ''))) = lower(btrim(${priority}::text)))
        `

  const row = summaryRes.rows[0]
  return {
    total: row?.total ?? 0,
    in_progress: row?.in_progress ?? 0,
    overdue: row?.overdue ?? 0,
    done: row?.done ?? 0,
  }
}

type ActionPlansFilterOptions = {
  frameworks: string[]
  responsibles: string[]
  statuses: string[]
  priorities: string[]
}

export async function fetchActionPlansFilterOptions(): Promise<ActionPlansFilterOptions> {
  const ctx = await getContext()
  await ensureTeamIdColumnsOnce()
  const scope = await getActionPlansScope(ctx.tenantId, ctx.userId)
  const teamIdsArr = scope.teamIds
  const noScope = scope.canViewAll || teamIdsArr.length === 0
  const oneTeam = !noScope && teamIdsArr.length === 1
  const firstTeamId = teamIdsArr[0] ?? ""
  const teamsArray = teamIdsArr as unknown as string
  const scopeKey = noScope ? "all" : oneTeam ? `one:${firstTeamId}` : `many:${teamIdsArr.slice().sort().join(",")}`

  const cached = unstable_cache(
    async (): Promise<ActionPlansFilterOptions> => {
      const res = noScope
        ? await sql<{ frameworks: string[] | null; responsibles: string[] | null; statuses: string[] | null; priorities: string[] | null }>`
            SELECT
              ARRAY(
                SELECT DISTINCT COALESCE(fc.name, fk.name)::text
                FROM action_plans ap
                LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
                LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
                LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
                LEFT JOIN frameworks fc ON fc.id = c.framework_id
                LEFT JOIN frameworks fk ON fk.id = ck.framework_id
                WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                  AND COALESCE(fc.name, fk.name) IS NOT NULL
                  AND btrim(COALESCE(fc.name, fk.name)::text) <> ''
                ORDER BY 1
              ) AS frameworks,
              ARRAY(
                SELECT DISTINCT ap.responsible_name::text
                FROM action_plans ap
                WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                  AND ap.responsible_name IS NOT NULL
                  AND btrim(ap.responsible_name) <> ''
                ORDER BY 1
              ) AS responsibles,
              ARRAY(
                SELECT DISTINCT ap.status::text
                FROM action_plans ap
                WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                  AND ap.status IS NOT NULL
                  AND btrim(ap.status::text) <> ''
                ORDER BY 1
              ) AS statuses,
              ARRAY(
                SELECT DISTINCT ap.priority::text
                FROM action_plans ap
                WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                  AND ap.priority IS NOT NULL
                  AND btrim(ap.priority::text) <> ''
                ORDER BY 1
              ) AS priorities
          `
        : oneTeam
          ? await sql<{ frameworks: string[] | null; responsibles: string[] | null; statuses: string[] | null; priorities: string[] | null }>`
              SELECT
                ARRAY(
                  SELECT DISTINCT COALESCE(fc.name, fk.name)::text
                  FROM action_plans ap
                  LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
                  LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
                  LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
                  LEFT JOIN frameworks fc ON fc.id = c.framework_id
                  LEFT JOIN frameworks fk ON fk.id = ck.framework_id
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
                    AND COALESCE(fc.name, fk.name) IS NOT NULL
                    AND btrim(COALESCE(fc.name, fk.name)::text) <> ''
                  ORDER BY 1
                ) AS frameworks,
                ARRAY(
                  SELECT DISTINCT ap.responsible_name::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
                    AND ap.responsible_name IS NOT NULL
                    AND btrim(ap.responsible_name) <> ''
                  ORDER BY 1
                ) AS responsibles,
                ARRAY(
                  SELECT DISTINCT ap.status::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
                    AND ap.status IS NOT NULL
                    AND btrim(ap.status::text) <> ''
                  ORDER BY 1
                ) AS statuses,
                ARRAY(
                  SELECT DISTINCT ap.priority::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ${firstTeamId}::uuid)
                    AND ap.priority IS NOT NULL
                    AND btrim(ap.priority::text) <> ''
                  ORDER BY 1
                ) AS priorities
            `
          : await sql<{ frameworks: string[] | null; responsibles: string[] | null; statuses: string[] | null; priorities: string[] | null }>`
              SELECT
                ARRAY(
                  SELECT DISTINCT COALESCE(fc.name, fk.name)::text
                  FROM action_plans ap
                  LEFT JOIN controls c ON c.id = ap.control_id AND c.tenant_id = ap.tenant_id
                  LEFT JOIN kpis k ON k.id = ap.kpi_id AND k.tenant_id = ap.tenant_id
                  LEFT JOIN controls ck ON ck.id = k.control_id AND ck.tenant_id = ap.tenant_id
                  LEFT JOIN frameworks fc ON fc.id = c.framework_id
                  LEFT JOIN frameworks fk ON fk.id = ck.framework_id
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
                    AND COALESCE(fc.name, fk.name) IS NOT NULL
                    AND btrim(COALESCE(fc.name, fk.name)::text) <> ''
                  ORDER BY 1
                ) AS frameworks,
                ARRAY(
                  SELECT DISTINCT ap.responsible_name::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
                    AND ap.responsible_name IS NOT NULL
                    AND btrim(ap.responsible_name) <> ''
                  ORDER BY 1
                ) AS responsibles,
                ARRAY(
                  SELECT DISTINCT ap.status::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
                    AND ap.status IS NOT NULL
                    AND btrim(ap.status::text) <> ''
                  ORDER BY 1
                ) AS statuses,
                ARRAY(
                  SELECT DISTINCT ap.priority::text
                  FROM action_plans ap
                  WHERE ap.tenant_id = ${ctx.tenantId}::uuid
                    AND (ap.team_id IS NULL OR ap.team_id = ANY(${teamsArray}::uuid[]))
                    AND ap.priority IS NOT NULL
                    AND btrim(ap.priority::text) <> ''
                  ORDER BY 1
                ) AS priorities
            `

      const row = res.rows[0]
      return {
        frameworks: row?.frameworks ?? [],
        responsibles: row?.responsibles ?? [],
        statuses: row?.statuses ?? [],
        priorities: row?.priorities ?? [],
      }
    },
    ["action-plans-filter-options", ctx.tenantId, ctx.userId, scopeKey],
    { revalidate: 300 }
  )

  return cached()
}
