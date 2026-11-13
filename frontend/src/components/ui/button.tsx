import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-amber focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                // KoreX system (kx tokens). Amber = the primary action; slate for the rest.
                default: "bg-kx-amber text-kx-on-amber hover:brightness-105 font-semibold",
                // Red only means danger/error (destructive actions)
                destructive: "bg-kx-debt text-kx-on-amber hover:brightness-105 font-semibold",
                outline: "border border-kx-line bg-transparent text-kx-ink hover:bg-kx-raised",
                secondary: "border border-kx-line bg-kx-raised text-kx-ink hover:bg-kx-surface",
                ghost: "text-kx-ink hover:bg-kx-raised",
                link: "text-kx-ink underline-offset-4 hover:underline",
                // Legacy alias of the primary
                premium: "bg-kx-amber text-kx-on-amber hover:brightness-105 font-semibold",
                // Green only for payment progress / paid
                glow: "bg-kx-paid text-kx-on-amber hover:brightness-105 font-semibold",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
