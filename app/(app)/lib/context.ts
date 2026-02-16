"use server"

import { cookies } from "next/headers"
import { sql } from "@vercel/postgres"

export type AppContext = {
  tenantId: string
  userId: string
  userEmail: string
  userRole: string
}

// Cookies usados no modo demo
const COOKIE_TENANT = "kct_tenant"
const COOKIE_EMAIL = "kct_email"

async function getDefaultTenantId(): Promise<string> {
  const t = await sql<{ id: string }>`
    SELECT id
    FROM tenants
    ORDER BY created_at ASC
    LIMIT 1
  `
  const tenantId = t.rows[0]?.id
  if (!tenantId) throw new Error("Nenhum tenant encontrado. Crie um tenant antes.")
  return tenantId
}

async function ensureUser(opts: { tenantId: string; email: string }): Promise<{ id: string; name: string; role: string }> {
  const { tenantId, email } = opts

  // 1) tenta achar
  const found = await sql<{ id: string; name: string; role: string }>`
    SELECT id, name, role::text AS role
    FROM users
    WHERE tenant_id = ${tenantId}
      AND email = ${email}
    LIMIT 1
  `
  if (found.rows[0]) return found.rows[0]

  // 2) cria (modo demo)
  const name = email.split("@")[0] || "User"
  const role = email.startsWith("grc") ? "grc" : "admin"

  const created = await sql<{ id: string; name: string; role: string }>`
    INSERT INTO users (tenant_id, name, email, role, is_active, created_at, updated_at)
    VALUES (${tenantId}, ${name}, ${email}, ${role}::user_role, true, NOW(), NOW())
    RETURNING id, name, role::text AS role
  `
  return created.rows[0]
}

/**
 * Contexto do app (modo demo):
 * - pega tenant/email via cookie
 * - fallback: primeiro tenant + admin@demo.com
 * - garante que o user exista (cria se faltar)
 */
export async function getContext(): Promise<AppContext> {
  const ck = await cookies()
  const cookieTenant = ck.get(COOKIE_TENANT)?.value
  const cookieEmail = ck.get(COOKIE_EMAIL)?.value

  const tenantId = cookieTenant || (await getDefaultTenantId())
  const userEmail = cookieEmail || "admin@demo.com"

  const u = await ensureUser({ tenantId, email: userEmail })

  return {
    tenantId,
    userId: u.id,
    userEmail,
    userRole: u.role,
  }
}
