import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * The Radix root (<button role="switch">) is the 44×44 touch target, transparent; the visible
 * 44×24 pill is a span inside it. index.css forces min 44×44 on every button for coarse
 * pointers, which used to inflate the pill into a circle. Track colors go in `trackClassName`
 * (use group-data-[state=…]: selectors); `className` styles the touch target.
 */
const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { trackClassName?: string }
>(({ className, trackClassName, ...props }, ref) => (
    <SwitchPrimitive.Root
        className={cn(
            "group peer inline-grid h-11 w-11 shrink-0 cursor-pointer place-items-center bg-transparent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
        ref={ref}
    >
        <span
            data-kx="switch-track"
            aria-hidden="true"
            className={cn(
                "inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors group-focus-visible:ring-2 group-focus-visible:ring-zinc-950 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-white group-data-[state=checked]:bg-zinc-900 group-data-[state=unchecked]:bg-zinc-200 dark:group-focus-visible:ring-zinc-300 dark:group-focus-visible:ring-offset-zinc-950 dark:group-data-[state=checked]:bg-zinc-50 dark:group-data-[state=unchecked]:bg-zinc-800",
                trackClassName
            )}
        >
            <SwitchPrimitive.Thumb
                className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 dark:bg-zinc-950"
                )}
            />
        </span>
    </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
