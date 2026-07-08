"use client"

import type { ReactNode } from "react"

import { ToastProvider } from "@/components/providers/toast-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
