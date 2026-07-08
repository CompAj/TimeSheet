"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CircleCheck, CircleX, Info, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error"

type ToastInput = {
  title?: string
  description: string
  variant?: ToastVariant
  duration?: number
}

type ToastItem = ToastInput & {
  id: string
}

type ToastContextValue = {
  toast: (input: ToastInput) => void
  success: (description: string, title?: string) => void
  error: (description: string, title?: string) => void
  message: (description: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID()
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
        duration: input.duration ?? DEFAULT_DURATION,
      }

      setToasts((current) => [...current, item])

      const timer = setTimeout(() => dismiss(id), item.duration)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (description, title) => toast({ description, title, variant: "success" }),
      error: (description, title) => toast({ description, title, variant: "error" }),
      message: (description, title) => toast({ description, title, variant: "default" }),
    }),
    [toast],
  )

  useEffect(() => {
    const timersRef = timers.current
    return () => {
      for (const timer of timersRef.values()) {
        clearTimeout(timer)
      }
      timersRef.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.")
  }
  return context
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icon = toast.variant === "success" ? CircleCheck : toast.variant === "error" ? CircleX : Info

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-lg border bg-card p-4 text-card-foreground shadow-lg",
        toast.variant === "success" && "border-success/25",
        toast.variant === "error" && "border-destructive/25",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            toast.variant === "success" && "text-success",
            toast.variant === "error" && "text-destructive",
            toast.variant === "default" && "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {toast.title && <p className="text-sm font-medium">{toast.title}</p>}
          <p className={cn("text-sm text-muted-foreground", toast.title && "mt-1")}>{toast.description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
