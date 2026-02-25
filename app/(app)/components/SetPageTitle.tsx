"use client"

import { useEffect } from "react"
import { usePageTitle } from "../contexts/PageTitleContext"

export default function SetPageTitle({ title }: { title: string }) {
  const { setTitle } = usePageTitle()
  useEffect(() => {
    setTitle(title)
    return () => setTitle(null)
  }, [title, setTitle])
  return null
}
