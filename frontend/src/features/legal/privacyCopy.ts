/**
 * Privacy Policy copy. `en` is the original text, unchanged; `es` is a FAITHFUL translation
 * (EN→ES sweep, 2026-11-13): no clause changes meaning. Proper names of services, laws and
 * technologies stay as written. `**bold**` markers are rendered by the page.
 */
export interface LegalSection { id: string; title: string; content: string }
export interface LegalCopy {
    pageTitle: string;
    back: string;
    effective: string;
    effectiveDate: string;
    intro?: string;
    toc: string;
    footer: (year: number) => string;
    otherDoc: string;
    sections: LegalSection[];
}

const en: LegalCopy = {
    pageTitle: 'Privacy Policy',
    back: 'Back to Login',
    effective: 'Effective Date:',
    effectiveDate: 'November 14, 2026',
    intro: 'Your privacy is important to us. This Privacy Policy explains what information KoreX System collects, how we use it, and your rights regarding your data. We are committed to protecting your financial information.',
    toc: 'Table of Contents',
    footer: (year) => `KoreX Financial System — © ${year} All rights reserved.`,
    otherDoc: 'Terms of Service',
    sections: [
        {
            id: 'info-collect',
            title: '1. Information We Collect',
            content: `We collect the following types of information when you use KoreX System:\n\n**Account Information**\n• Name and email address (provided during registration or via Google OAuth).\n• Authentication tokens managed by Supabase Auth.\n\n**Financial Data**\n• Account balances, interest rates, minimum payments, and closing dates that you manually enter.\n• Income and expense transactions you log.\n• Cashflow projections generated from your data.\n\n**Usage Data**\n• Pages visited, features used, and session duration.\n• Browser type and device information (collected automatically via standard web protocols).\n\nWe do NOT collect:\n• Bank login credentials.\n• Social Security numbers.\n• Credit card numbers (unless you voluntarily enter them as account data).`,
        },
        {
            id: 'how-we-use',
            title: '2. How We Use Your Data',
            content: `Your data is used exclusively to:\n• Perform financial calculations and generate projections.\n• Display your personalized dashboard and strategy recommendations.\n• Authenticate your identity and maintain your session.\n• Improve the Service's functionality and user experience.\n\nWe do NOT use your data for:\n• Advertising or marketing to third parties.\n• Selling to data brokers.\n• Training AI models on your personal financial information.\n• Any purpose unrelated to providing the Service.`,
        },
        {
            id: 'storage',
            title: '3. Data Storage & Security',
            content: `Your data is stored securely using:\n• **Supabase** (PostgreSQL) — hosted on AWS infrastructure with encryption at rest and in transit.\n• **Row-Level Security (RLS)** — direct public access to the database is denied: Row-Level Security is enabled with no access policies, and table permissions are revoked for the public roles. Only our backend reaches the database, and it separates each user's data so you can only access your own.\n• **JWT Authentication** — session tokens are cryptographically signed and validated on every request.\n• **HTTPS** — all data transmitted between your browser and our servers is encrypted via TLS.\n\nWhile we implement industry-standard security measures, no system is 100% secure. We cannot guarantee absolute security of your data.`,
        },
        {
            id: 'sharing',
            title: '4. Third-Party Data Sharing',
            content: `We do NOT sell, rent, or trade your personal information.\n\nYour data may be shared with the following third-party services solely for the purpose of providing the Service:\n\n• **Supabase** — database hosting and authentication infrastructure.\n• **Google** — OAuth authentication (only your public profile info: name, email, avatar).\n• **Vercel** — application hosting (no direct access to user data).\n• **Railway** — backend hosting (the API server that processes your data to provide the Service).\n• **Lemon Squeezy** — subscription payment processing (receives your account identifier, and your name and email when you subscribe; card details are entered in Lemon Squeezy's checkout, never in KoreX).\n• **Google Play** — subscription payment processing in the Android app (receives your account identifier and verifies your purchase with Google; payment is processed by Google Play and your card details never reach KoreX).\n\nWe may also disclose information if required by law, court order, or government regulation.`,
        },
        {
            id: 'cookies',
            title: '5. Cookies & Local Storage',
            content: `KoreX System uses minimal cookies and browser storage:\n\n• **Authentication cookies** — to maintain your login session (essential, cannot be disabled).\n• **Local storage** — to store non-sensitive UI preferences.\n\nWe do NOT use:\n• Tracking cookies.\n• Analytics cookies from third parties.\n• Advertising pixels or beacons.`,
        },
        {
            id: 'retention',
            title: '6. Data Retention',
            content: `We retain your data for as long as your account is active. Upon account deletion:\n• All personal data (name, email) is permanently deleted.\n• All financial data (accounts, transactions, projections) is permanently deleted.\n• Authentication records are removed from Supabase Auth.\n\nDeletion is irreversible. We recommend exporting your data before requesting account deletion.`,
        },
        {
            id: 'rights',
            title: '7. Your Rights',
            content: `You have the right to:\n• **Access** — request a copy of all data we hold about you.\n• **Rectification** — correct any inaccurate information.\n• **Deletion** — request permanent deletion of your account and all associated data.\n• **Portability** — export your financial data in a standard format.\n• **Restriction** — request that we limit processing of your data.\n\nTo exercise any of these rights, contact us through the Service's support channels. We will respond within 30 days.`,
        },
        {
            id: 'security-measures',
            title: '8. Security Measures',
            content: `We implement the following security measures:\n• Encrypted database connections (SSL/TLS).\n• Row-Level Security enabled on all tables with no access policies, and table permissions revoked for the public roles; isolation between users is enforced by our backend.\n• Secure password hashing via Supabase Auth (bcrypt).\n• JWT token-based authentication with expiration.\n• CORS restrictions to prevent unauthorized API access.\n• Regular security reviews and dependency updates.`,
        },
        {
            id: 'children',
            title: "9. Children's Privacy",
            content: `KoreX System is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a user is under 18, we will take steps to delete their account and associated data immediately.`,
        },
        {
            id: 'international',
            title: '10. International Users',
            content: `KoreX System is hosted in the United States. If you access the Service from outside the US, your data may be transferred to and processed in the United States. By using the Service, you consent to this transfer.\n\nFor users in the European Economic Area (EEA), we comply with applicable data protection regulations including GDPR where applicable.`,
        },
        {
            id: 'changes',
            title: '11. Changes to This Policy',
            content: `We may update this Privacy Policy from time to time. Material changes will be communicated via:\n• A notice within the Service.\n• An email to the address associated with your account.\n\nYour continued use of the Service after changes are posted constitutes acceptance of the updated Privacy Policy.`,
        },
        {
            id: 'contact',
            title: '12. Contact',
            content: `If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us through the Service's support channels or at the email provided in your account settings.`,
        },
    ],
};

const es: LegalCopy = {
    pageTitle: 'Política de Privacidad',
    back: 'Volver al inicio de sesión',
    effective: 'Fecha de entrada en vigor:',
    effectiveDate: '14 de noviembre de 2026',
    intro: 'Tu privacidad es importante para nosotros. Esta Política de Privacidad explica qué información recopila KoreX System, cómo la usamos y cuáles son tus derechos sobre tus datos. Estamos comprometidos con proteger tu información financiera.',
    toc: 'Índice',
    footer: (year) => `KoreX Financial System — © ${year} Todos los derechos reservados.`,
    otherDoc: 'Términos del Servicio',
    sections: [
        {
            id: 'info-collect',
            title: '1. Información que recopilamos',
            content: `Recopilamos los siguientes tipos de información cuando usas KoreX System:\n\n**Información de la cuenta**\n• Nombre y dirección de correo electrónico (proporcionados durante el registro o mediante Google OAuth).\n• Tokens de autenticación gestionados por Supabase Auth.\n\n**Datos financieros**\n• Saldos de cuentas, tasas de interés, pagos mínimos y fechas de corte que ingresas manualmente.\n• Transacciones de ingresos y gastos que registras.\n• Proyecciones de flujo de caja generadas a partir de tus datos.\n\n**Datos de uso**\n• Páginas visitadas, funciones utilizadas y duración de la sesión.\n• Tipo de navegador e información del dispositivo (recopilada automáticamente mediante protocolos web estándar).\n\nNO recopilamos:\n• Credenciales de acceso a tu banco.\n• Números de Seguro Social.\n• Números de tarjetas de crédito (salvo que los ingreses voluntariamente como datos de una cuenta).`,
        },
        {
            id: 'how-we-use',
            title: '2. Cómo usamos tus datos',
            content: `Tus datos se usan exclusivamente para:\n• Realizar cálculos financieros y generar proyecciones.\n• Mostrar tu panel personalizado y tus recomendaciones de estrategia.\n• Autenticar tu identidad y mantener tu sesión.\n• Mejorar la funcionalidad y la experiencia de uso del Servicio.\n\nNO usamos tus datos para:\n• Publicidad o marketing a terceros.\n• Venderlos a intermediarios de datos (data brokers).\n• Entrenar modelos de IA con tu información financiera personal.\n• Ningún fin ajeno a la prestación del Servicio.`,
        },
        {
            id: 'storage',
            title: '3. Almacenamiento y seguridad de los datos',
            content: `Tus datos se almacenan de forma segura mediante:\n• **Supabase** (PostgreSQL) — alojado en infraestructura de AWS con cifrado en reposo y en tránsito.\n• **Row-Level Security (RLS)** — el acceso público directo a la base de datos está denegado: Row-Level Security está activado sin políticas de acceso y los permisos sobre las tablas están revocados para los roles públicos. Solo nuestro backend accede a la base de datos, y es el que separa los datos de cada usuario para que solo puedas acceder a los tuyos.\n• **Autenticación JWT** — los tokens de sesión están firmados criptográficamente y se validan en cada solicitud.\n• **HTTPS** — todos los datos transmitidos entre tu navegador y nuestros servidores se cifran mediante TLS.\n\nAunque aplicamos medidas de seguridad estándar de la industria, ningún sistema es 100 % seguro. No podemos garantizar la seguridad absoluta de tus datos.`,
        },
        {
            id: 'sharing',
            title: '4. Datos compartidos con terceros',
            content: `NO vendemos, alquilamos ni intercambiamos tu información personal.\n\nTus datos pueden compartirse con los siguientes servicios de terceros únicamente con el fin de prestar el Servicio:\n\n• **Supabase** — alojamiento de la base de datos e infraestructura de autenticación.\n• **Google** — autenticación OAuth (solo la información pública de tu perfil: nombre, correo electrónico y avatar).\n• **Vercel** — alojamiento de la aplicación (sin acceso directo a los datos de los usuarios).\n• **Railway** — alojamiento del backend (el servidor de la API que procesa tus datos para prestar el Servicio).\n• **Lemon Squeezy** — procesamiento de los pagos de suscripción (recibe el identificador de tu cuenta y, cuando te suscribes, tu nombre y correo electrónico; los datos de tu tarjeta se ingresan en el checkout de Lemon Squeezy, nunca en KoreX).\n• **Google Play** — procesamiento de los pagos de suscripción en la app de Android (recibe el identificador de tu cuenta y verifica tu compra con Google; el pago lo procesa Google Play y los datos de tu tarjeta nunca llegan a KoreX).\n\nTambién podemos divulgar información si así lo exige la ley, una orden judicial o una regulación gubernamental.`,
        },
        {
            id: 'cookies',
            title: '5. Cookies y almacenamiento local',
            content: `KoreX System usa un mínimo de cookies y de almacenamiento del navegador:\n\n• **Cookies de autenticación** — para mantener tu sesión iniciada (esenciales, no se pueden desactivar).\n• **Almacenamiento local** — para guardar preferencias de la interfaz que no son sensibles.\n\nNO usamos:\n• Cookies de rastreo.\n• Cookies de analítica de terceros.\n• Píxeles o balizas publicitarias.`,
        },
        {
            id: 'retention',
            title: '6. Conservación de los datos',
            content: `Conservamos tus datos mientras tu cuenta esté activa. Al eliminarse la cuenta:\n• Todos los datos personales (nombre, correo electrónico) se eliminan de forma permanente.\n• Todos los datos financieros (cuentas, transacciones, proyecciones) se eliminan de forma permanente.\n• Los registros de autenticación se eliminan de Supabase Auth.\n\nLa eliminación es irreversible. Te recomendamos exportar tus datos antes de solicitar la eliminación de tu cuenta.`,
        },
        {
            id: 'rights',
            title: '7. Tus derechos',
            content: `Tienes derecho a:\n• **Acceso** — solicitar una copia de todos los datos que tenemos sobre ti.\n• **Rectificación** — corregir cualquier información inexacta.\n• **Eliminación** — solicitar la eliminación permanente de tu cuenta y de todos los datos asociados.\n• **Portabilidad** — exportar tus datos financieros en un formato estándar.\n• **Limitación** — solicitar que limitemos el tratamiento de tus datos.\n\nPara ejercer cualquiera de estos derechos, contáctanos a través de los canales de soporte del Servicio. Responderemos en un plazo de 30 días.`,
        },
        {
            id: 'security-measures',
            title: '8. Medidas de seguridad',
            content: `Aplicamos las siguientes medidas de seguridad:\n• Conexiones cifradas a la base de datos (SSL/TLS).\n• Row-Level Security activado en todas las tablas sin políticas de acceso, y permisos sobre las tablas revocados para los roles públicos; el aislamiento entre usuarios lo aplica nuestro backend.\n• Hash seguro de contraseñas mediante Supabase Auth (bcrypt).\n• Autenticación basada en tokens JWT con caducidad.\n• Restricciones CORS para impedir el acceso no autorizado a la API.\n• Revisiones de seguridad y actualizaciones de dependencias periódicas.`,
        },
        {
            id: 'children',
            title: '9. Privacidad de menores',
            content: `KoreX System no está dirigido a personas menores de 18 años. No recopilamos a sabiendas información personal de menores. Si llegamos a saber que un usuario es menor de 18 años, tomaremos medidas para eliminar de inmediato su cuenta y los datos asociados.`,
        },
        {
            id: 'international',
            title: '10. Usuarios internacionales',
            content: `KoreX System está alojado en los Estados Unidos. Si accedes al Servicio desde fuera de los EE. UU., tus datos pueden transferirse a los Estados Unidos y tratarse allí. Al usar el Servicio, consientes esta transferencia.\n\nPara los usuarios del Espacio Económico Europeo (EEE), cumplimos la normativa de protección de datos aplicable, incluido el RGPD (GDPR) cuando corresponda.`,
        },
        {
            id: 'changes',
            title: '11. Cambios en esta Política',
            content: `Podemos actualizar esta Política de Privacidad periódicamente. Los cambios sustanciales se comunicarán mediante:\n• Un aviso dentro del Servicio.\n• Un correo electrónico a la dirección asociada a tu cuenta.\n\nSi sigues usando el Servicio después de publicados los cambios, se entenderá que aceptas la Política de Privacidad actualizada.`,
        },
        {
            id: 'contact',
            title: '12. Contacto',
            content: `Si tienes preguntas sobre esta Política de Privacidad o deseas ejercer tus derechos sobre tus datos, contáctanos a través de los canales de soporte del Servicio o en el correo electrónico indicado en la configuración de tu cuenta.`,
        },
    ],
};

export const PRIVACY_COPY = { es, en };
