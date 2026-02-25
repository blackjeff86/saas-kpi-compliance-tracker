"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

type PageTitleContextType = {
  title: string | null
  setTitle: (title: string | null) => void
}

const PageTitleContext = createContext<PageTitleContextType | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  return (
    <PageTitleContext.Provider value={{ title, setTitle: useCallback((t) => setTitle(t), []) }}>
      {children}
    </PageTitleContext.Provider>
  )
}

export function usePageTitle() {
  const ctx = useContext(PageTitleContext)
  return ctx ?? { title: null, setTitle: () => {} }
}
