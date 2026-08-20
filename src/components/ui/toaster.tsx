import React from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { cn } from '../../lib/utils'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast'

const VARIANT_CONFIG = {
  default: {
    Icon: CheckCircle2,
    iconColor: 'text-green-700',
    titleColor: 'text-green-700',
    barColor: 'bg-green-700',
  },
  destructive: {
    Icon: XCircle,
    iconColor: 'text-red-500',
    titleColor: 'text-red-600',
    barColor: 'bg-red-500',
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-600',
    barColor: 'bg-amber-500',
  },
  info: {
    Icon: Info,
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-600',
    barColor: 'bg-blue-500',
  },
} as const

const TOAST_DURATION = 4000

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const config =
          VARIANT_CONFIG[(variant as keyof typeof VARIANT_CONFIG) ?? 'default'] ??
          VARIANT_CONFIG.default
        const { Icon } = config

        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconColor)} />
            <div className="grid flex-1 min-w-0 gap-0.5">
              {title && <ToastTitle className={config.titleColor}>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
            <span
              className={cn(
                'lux-toast-progress-bar absolute inset-x-0 bottom-0 h-1 origin-left',
                config.barColor,
              )}
              style={{ animationDuration: `${TOAST_DURATION}ms` }}
            />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
