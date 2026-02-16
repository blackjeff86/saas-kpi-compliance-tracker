"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

export async function closeActionPlansForExecution(executionId: string) {
  const ctx = await getContext()

  await sql`
    UPDATE action_plans
    SET
      status = 'done'::action_status,
      updated_at = NOW()
    WHERE tenant_id = ${ctx.tenantId}
      AND execution_id = ${executionId}
      AND status::text <> 'done'
  `

  revalidatePath(`/execucoes/${executionId}`)
  revalidatePath("/dashboard")
  revalidatePath("/action-plans")
}
