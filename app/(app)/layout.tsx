// app/(app)/layout.tsx
import Image from "next/image"
import AppHeader from "./AppHeader"
import SidebarNav from "./SidebarNav"
import { PageTitleProvider } from "./contexts/PageTitleContext"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = {
    name: "Ricardo Mendes",
    role: "Compliance Officer",
    email: "admin@demo.com",
  }

  return (
    <div className="flex min-h-screen bg-[#F6F8FC] text-[#0F172A]">
      {/* SIDEBAR */}
      <aside className="no-print hidden w-64 flex-col border-r border-white/10 bg-[#0B1220] md:fixed md:inset-y-0 md:left-0 md:flex md:h-screen md:overflow-hidden">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0B1220]">
            <Image
              src="/logo3.png"
              alt=""
              width={48}
              height={48}
              unoptimized
              className="size-full object-contain"
            />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white/90">
            KPI Compliance
          </span>
        </div>

        <SidebarNav />
      </aside>

      {/* CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#F6F8FC] md:ml-64">
        <PageTitleProvider>
          <div className="no-print">
            <AppHeader user={user} />
          </div>
          {children}
        </PageTitleProvider>
      </div>
    </div>
  )
}
