import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-kx-amber focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-kx-amber-soft text-kx-amber",
                secondary: "border-kx-line bg-kx-raised text-kx-ink2",
                // Red only for danger/error
                destructive: "border-transparent bg-[color-mix(in_srgb,var(--kx-debt)_15%,transparent)] text-kx-debt",
                outline: "border-kx-line text-kx-ink",
                // Green only for payment progress / paid
                success: "border-transparent bg-[color-mix(in_srgb,var(--kx-paid)_15%,transparent)] text-kx-paid",
                alert: "border-transparent bg-[color-mix(in_srgb,var(--kx-debt)_15%,transparent)] text-kx-debt",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
