"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

export async function fetchUsers(): Promise<UserRow[]> {
  const ctx = await getContext()

  const { rows } = await sql<UserRow>`
    SELECT
      id,
      name,
      email,
      role::text AS role,
      created_at::text AS created_at
    FROM users
    WHERE tenant_id = ${ctx.tenantId}
    ORDER BY created_at DESC
    LIMIT 200
  `
  return rows
}
