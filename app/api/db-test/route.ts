import { NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export async function GET() {
  try {
    const countExec = await sql`SELECT COUNT(*)::int AS n FROM kpi_executions;`
    const countControls = await sql`SELECT COUNT(*)::int AS n FROM controls;`
    const countKpis = await sql`SELECT COUNT(*)::int AS n FROM kpis;`

    return NextResponse.json({
      ok: true,
      env: {
        POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
      },
      counts: {
        kpi_executions: countExec.rows[0]?.n ?? null,
        controls: countControls.rows[0]?.n ?? null,
        kpis: countKpis.rows[0]?.n ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}
