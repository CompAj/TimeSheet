"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 transition-opacity duration-150",
          )}
        />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={cn(
              "w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-lg outline-none",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0",
              "transition-all duration-150",
            )}
          >
            <AlertDialog.Title className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Close
                render={
                  <Button type="button" variant="outline" disabled={loading}>
                    {cancelLabel}
                  </Button>
                }
              />
              <Button type="button" variant="destructive" disabled={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
