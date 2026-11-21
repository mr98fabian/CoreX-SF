/**
 * /eliminar-cuenta — public (no session): how to delete a KoreX account and its data. This is the
 * URL declared in Play Console (Data safety → account deletion). The button signs the user in and
 * lands them on Ajustes → Mi Cuenta, at the danger zone.
 */
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { rememberReturnTo } from '@/lib/returnTo';

export const DELETE_TARGET = '/dashboard/settings/cuenta#eliminar';

export default function DeleteAccountInfoPage() {
    const { t } = useLanguage();
    usePageTitle(t('deleteInfo.title'));
    const { user } = useAuth();
    const navigate = useNavigate();

    const go = () => {
        if (user) return navigate(DELETE_TARGET);
        rememberReturnTo(DELETE_TARGET);
        navigate('/login');
    };

    const steps = [t('deleteInfo.step1'), t('deleteInfo.step2'), t('deleteInfo.step3')];
    return (
        <div className="kx-scope min-h-screen bg-kx-bg px-5 py-10">
            <div className="mx-auto max-w-md space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-semibold text-kx-ink">{t('deleteInfo.title')}</h1>
                    <p className="text-[14.5px] text-kx-ink2">{t('deleteInfo.lead')}</p>
                </div>
                <ol data-testid="delete-info-steps" className="space-y-3">
                    {steps.map((text, i) => (
                        <li key={i} className="flex items-center gap-3 rounded-[20px] border border-kx-line bg-kx-surface p-[16px]">
                            <span className="kx-num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-kx-amber text-sm font-bold text-kx-on-amber">{i + 1}</span>
                            <p className="text-[15px] font-semibold text-kx-ink">{text}</p>
                        </li>
                    ))}
                </ol>
                <p className="text-[14px] text-kx-ink">{t('deleteInfo.what')}</p>
                <p className="text-[13.5px] text-kx-ink2">{t('deleteInfo.store')}</p>
                <button type="button" data-testid="delete-info-go" onClick={go}
                    className="kx-press w-full rounded-xl bg-kx-amber py-3.5 text-sm font-bold text-kx-on-amber">
                    {t('deleteInfo.button')}
                </button>
            </div>
        </div>
    );
}
