import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tenant = url.searchParams.get("tenant")
  const email = url.searchParams.get("email")

  if (!tenant || !email) {
    return NextResponse.json(
      { ok: false, error: "Use /api/dev/login?tenant=<TENANT_ID>&email=<EMAIL>" },
      { status: 400 }
    )
  }

  const res = NextResponse.json({ ok: true, tenant, email })

  // cookies para o modo demo
  res.cookies.set("kct_tenant", tenant, { path: "/", httpOnly: false })
  res.cookies.set("kct_email", email, { path: "/", httpOnly: false })

  return res
}
