"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type ControlRow = {
  id: string
  control_code: string
  name: string
  framework: string | null
  frequency: string | null
  risk_level: string | null
  created_at: string
}

export type FetchControlsInput = {
  q?: string
  limit?: number
  offset?: number
}

export async function fetchControlsPage(input: FetchControlsInput = {}): Promise<{
  rows: ControlRow[]
  total: number
}> {
  const ctx = await getContext()

  const qRaw = (input.q ?? "").trim()
  const q = qRaw.length ? `%${qRaw}%` : null

  const limit = Math.max(1, Math.min(100, input.limit ?? 10))
  const offset = Math.max(0, input.offset ?? 0)

  // total
  const totalRes = await sql<{ total: number }>`
    SELECT COUNT(*)::int AS total
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR f.name ILIKE ${q}
      )
  `
  const total = totalRes.rows?.[0]?.total ?? 0

  // page
  const { rows } = await sql<ControlRow>`
    SELECT
      c.id,
      c.control_code,
      c.name,
      f.name::text AS framework,
      c.frequency::text AS frequency,
      r.classification::text AS risk_level,
      c.created_at::text AS created_at
    FROM controls c
    LEFT JOIN frameworks f ON f.id = c.framework_id
    LEFT JOIN risk_catalog r ON r.id = c.risk_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.control_code ILIKE ${q}
        OR f.name ILIKE ${q}
      )
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return { rows, total }
}
