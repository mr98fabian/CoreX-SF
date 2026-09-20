import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
    /** Section title shown in the header row */
    title: string;
    /** Short subtitle describing the contents (shown next to the title) */
    hint?: string;
    /** localStorage key used to persist the open/collapsed state */
    storageKey: string;
    /** Initial state when no preference has been stored (default: collapsed) */
    defaultOpen?: boolean;
    children: ReactNode;
}

/**
 * CollapsibleSection — progressive disclosure container (Fase 2 · CR-3).
 * Groups secondary dashboard widgets behind a discreet header so the
 * primary view stays focused. The user's preference is persisted.
 *
 * Designed to sit inside the dashboard's 12-column grid: the section
 * spans all 12 columns and re-opens an inner grid for its children.
 */
export function CollapsibleSection({
    title,
    hint,
    storageKey,
    defaultOpen = false,
    children,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(() => {
        const stored = localStorage.getItem(storageKey);
        return stored === null ? defaultOpen : stored === 'true';
    });

    const toggle = () => {
        setOpen((prev) => {
            localStorage.setItem(storageKey, String(!prev));
            return !prev;
        });
    };

    return (
        <section className="col-span-12">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="group flex w-full items-center gap-2 px-1 py-1.5 text-left"
            >
                <ChevronDown
                    size={16}
                    className={cn(
                        'text-muted-foreground transition-transform duration-300',
                        !open && '-rotate-90'
                    )}
                />
                <span className="text-sm font-semibold text-foreground">{title}</span>
                {hint && (
                    <span className="text-[11px] text-muted-foreground">{hint}</span>
                )}
                <span className="ml-2 flex-1 border-t border-border/60" />
            </button>
            {open && (
                <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </section>
    );
}
