"use server"

import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { getContext } from "../lib/context"

type EvidenceType = "link" | "text" | "file"

export async function createEvidence(opts: {
  executionId: string
  title: string
  description?: string | null
  type: EvidenceType
  linkUrl?: string | null
  textContent?: string | null
  fileUrl?: string | null
}) {
  const ctx = await getContext()

  const title = (opts.title || "").trim()
  if (!title) throw new Error("Título da evidência é obrigatório.")

  // valida execução
  const execRes = await sql<{
    control_id: string
    kpi_id: string
  }>`
    SELECT control_id, kpi_id
    FROM kpi_executions
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${opts.executionId}
    LIMIT 1
  `

  const exec = execRes.rows[0]
  if (!exec) throw new Error("Execução não encontrada.")

  const type = opts.type
  const linkUrl = (opts.linkUrl || "").trim() || null
  const textContent = (opts.textContent || "").trim() || null
  const fileUrl = (opts.fileUrl || "").trim() || null
  const description = (opts.description || "").trim() || null

  // valida por tipo
  if (type === "link" && !linkUrl) {
    throw new Error("Informe a URL do link.")
  }

  if (type === "text" && !textContent) {
    throw new Error("Informe o conteúdo da evidência.")
  }

  if (type === "file" && !fileUrl) {
    throw new Error("Informe o file_url.")
  }

  await sql`
    INSERT INTO evidences (
      tenant_id,
      execution_id,
      control_id,
      kpi_id,
      type,
      title,
      description,
      file_url,
      link_url,
      text_content,
      uploaded_by_user_id,
      created_at
    )
    VALUES (
      ${ctx.tenantId},
      ${opts.executionId},
      ${exec.control_id},
      ${exec.kpi_id},
      ${type},
      ${title},
      ${description},
      ${fileUrl},
      ${linkUrl},
      ${textContent},
      ${ctx.userId},
      NOW()
    )
  `

  revalidatePath(`/execucoes/${opts.executionId}`)
  revalidatePath("/execucoes")
  revalidatePath("/revisoes")
}

export async function deleteEvidence(opts: {
  evidenceId: string
  executionId: string
}) {
  const ctx = await getContext()

  await sql`
    DELETE FROM evidences
    WHERE tenant_id = ${ctx.tenantId}
      AND id = ${opts.evidenceId}
      AND execution_id = ${opts.executionId}
  `

  revalidatePath(`/execucoes/${opts.executionId}`)
}
