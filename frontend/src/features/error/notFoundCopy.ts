/** Visible copy of NotFoundPage. Spanish first, English as the fallback (EN→ES sweep). */
export const NOT_FOUND_COPY = {
    es: {
        title: 'Página no encontrada',
        mascotAlt: 'Mapache de KoreX',
        lead: 'El mapache buscó por todas partes, pero esta página no existe.',
        hint: 'Quizá la movieron, la borraron o nunca existió.',
        home: 'Ir al inicio',
        back: 'Volver',
    },
    en: {
        title: 'Page not found',
        mascotAlt: 'KoreX Raccoon',
        lead: "The raccoon searched everywhere, but this page doesn't exist.",
        hint: 'Maybe it was moved, deleted, or never existed in the first place.',
        home: 'Go to Dashboard',
        back: 'Go Back',
    },
} as const;
