---
name: copy-bilingue
description: Reglas para añadir o cambiar cualquier texto visible al usuario en KoreX, que es bilingüe ES/EN. Úsalo SIEMPRE que se escriba o edite una cadena en un componente .tsx, se toque `frontend/src/contexts/LanguageContext.tsx`, se cambie copy de precio, pagos, push, correos o páginas legales, o Fabian diga "esto sale en inglés", "falta traducir", "sale la clave en vez del texto" o "cambia el texto de…".
---

# Copy bilingüe

`LanguageContext.tsx` es el archivo más tocado del repo (45 commits): casi cada feature
añade copy. El mecanismo explica los fallos que se repiten.

## Mecanismo (`frontend/src/contexts/LanguageContext.tsx`)

- Un solo diccionario: `translations["grupo.clave"] = { en: "…", es: "…" }`.
- `const { t, language } = useLanguage()` y luego `t("grupo.clave")`.
- `t` devuelve `entry[language] || entry.en || key`. Consecuencias:
  - **Clave inexistente → se pinta la clave cruda** (`settings.title`) en pantalla. Ni
    TypeScript ni el build lo detectan, porque la clave es `string`.
  - **`es` vacío → cae a inglés en silencio.** La app arranca en español por defecto, así que
    un `es` olvidado lo ve casi todo el mundo.
- `t` no interpola: los huecos son literales como `{v}` y los sustituye quien llama.

## Reglas

1. **Ninguna cadena visible escrita a mano en un componente.** Toda pasa por `t()`, con `en`
   y `es` añadidos en el mismo commit.
2. **Escribir primero el español**, no traducirlo del inglés: es el idioma por defecto. De tú,
   nunca de usted. El inglés es el respaldo.
3. Clave en `grupo.nombreCamelCase`, dentro del bloque de su sección. Buscar antes si ya
   existe una equivalente (`grep -n "Texto" LanguageContext.tsx`).
4. Mismos huecos `{x}` en ambos idiomas.
5. **Dinero nunca dentro de la cadena:** `<MoneyAmount>` o `useFormatMoney`. Toda cifra
   proyectada lleva su etiqueta de estimación en los dos idiomas (ver `legal-expert-usa`).
6. **El copy sigue al idioma en todos los canales.** Si el texto también sale por push o por
   correo, se cambia allí también: `setLanguage` sincroniza `lib/push` y `lib/noticeProfile`.
7. Vocabulario de la casa: «tu IA / tu asistente», nunca un asistente con nombre; sin
   comparaciones con competidores.

## Copy que promete algo (precio, prueba gratis, impuestos)

Lo que dice la pantalla tiene que ser lo que cobra el checkout. Cuando el mismo dato aparece
en varias superficies (landing, modal de upgrade, tarjetas de plan), se centraliza en un
módulo (`lib/pricing.ts`) y se protege con un **test de barrido** que recorre todas, como
`lib/priceTax.test.tsx`. Web (Stripe) y Android (Google Play) tienen copy distinto a
propósito: cambiar una ruta no autoriza a tocar la otra.

## Comprobación antes del commit

- [ ] Cada `t("…")` nuevo tiene su entrada, con `en` y `es` no vacíos.
- [ ] Probado con la app en español **y** en inglés.
- [ ] Sin clave cruda visible ni texto que se corte en móvil con la versión más larga.
- [ ] Si es legal, precio o un claim: revisado con `legal-expert-usa`.
