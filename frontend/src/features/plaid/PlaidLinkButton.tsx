/**
 * PlaidLink Component
 * Enables users to connect their bank accounts via Plaid Link.
 */
import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlaidLinkButtonProps {
    onSuccess?: () => void;
}

const API_BASE = '';

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch Link Token on mount
    useEffect(() => {
        const fetchLinkToken = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/plaid/create_link_token`);
                const data = await response.json();

                if (data.error) {
                    setError(data.message);
                    console.warn('Plaid configuration issue:', data.message);
                } else {
                    setLinkToken(data.link_token);
                }
            } catch (err) {
                setError('Failed to connect to backend. Make sure the server is running.');
                console.error('Error fetching link token:', err);
            }
        };
        fetchLinkToken();
    }, []);

    // 2. Handle successful link
    const handleOnSuccess = useCallback(async (publicToken: string) => {
        setLoading(true);
        try {
            // Exchange public token
            await fetch(`${API_BASE}/api/plaid/exchange_public_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_token: publicToken }),
            });

            // Import accounts into CoreX
            setImporting(true);
            const importRes = await fetch(`${API_BASE}/api/plaid/import_accounts`, {
                method: 'POST',
            });
            const importData = await importRes.json();

            console.log('Imported accounts:', importData);
            setSuccess(true);

            // Callback to refresh parent
            if (onSuccess) {
                setTimeout(onSuccess, 1000);
            }
        } catch (err) {
            console.error('Error during Plaid flow:', err);
        } finally {
            setLoading(false);
            setImporting(false);
        }
    }, [onSuccess]);

    // 3. Plaid Link hook
    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: handleOnSuccess,
        onExit: () => console.log('User exited Plaid Link'),
    });

    // Render error state
    if (error) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            className="bg-amber-950/30 border-amber-900/50 text-amber-400 cursor-help"
                            disabled
                        >
                            <AlertTriangle size={18} className="mr-2" />
                            Setup Required
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-slate-200">
                        <p className="text-sm">{error}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Render success state
    if (success) {
        return (
            <Button variant="outline" className="bg-emerald-950/30 border-emerald-900/50 text-emerald-400" disabled>
                <CheckCircle2 size={18} className="mr-2" />
                Bank Connected!
            </Button>
        );
    }

    // Render loading state
    if (loading || importing) {
        return (
            <Button variant="outline" className="bg-zinc-800 border-zinc-700" disabled>
                <Loader2 size={18} className="mr-2 animate-spin" />
                {importing ? 'Importing Accounts...' : 'Connecting...'}
            </Button>
        );
    }

    return (
        <Button
            onClick={() => open()}
            disabled={!ready}
            variant="outline"
            className="bg-gradient-to-r from-blue-600 to-cyan-600 border-none text-white hover:from-blue-700 hover:to-cyan-700"
        >
            <Building2 size={18} className="mr-2" />
            Connect Bank Account
        </Button>
    );
}

export default PlaidLinkButton;

