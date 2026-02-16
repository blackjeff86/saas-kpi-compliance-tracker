import { NextResponse } from "next/server"
import { recomputeAllAutoStatusForTenant } from "@/app/(app)/execucoes/actions-recompute-all"

export async function GET() {
  await recomputeAllAutoStatusForTenant(0.05)
  return NextResponse.json({ ok: true })
}
