import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const loginUrl = new URL("/login", req.url)
  const res = NextResponse.redirect(loginUrl)

  // limpa cookies de sessão do modo demo
  res.cookies.set("kct_tenant", "", { path: "/", maxAge: 0 })
  res.cookies.set("kct_email", "", { path: "/", maxAge: 0 })

  return res
}

