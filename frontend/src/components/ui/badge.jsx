import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Estado de pago
        pendiente: "border-amber-200 bg-amber-50 text-amber-700",
        parcial:   "border-blue-200 bg-blue-50 text-blue-700",
        pagada:    "border-green-200 bg-green-50 text-green-700",
        anulada:   "border-slate-200 bg-slate-50 text-slate-500",
        observada: "border-red-200 bg-red-50 text-red-700",
        // Estado de servicio
        programado:  "border-blue-200 bg-blue-50 text-blue-700",
        enTransito:  "border-amber-200 bg-amber-50 text-amber-700",
        finalizado:  "border-green-200 bg-green-50 text-green-700",
        cancelado:   "border-slate-200 bg-slate-50 text-slate-500",
        // Estado de vehículo / conductor
        activo:        "border-cyan-200 bg-cyan-50 text-cyan-700",
        mantenimiento: "border-amber-200 bg-amber-100 text-amber-800",
        baja:          "border-slate-200 bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
