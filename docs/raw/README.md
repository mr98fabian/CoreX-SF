# raw/ — volcado sin procesar

Cajón de sastre. Aquí se tira información **sin ordenar**: notas de voz transcritas, ideas sueltas,
feedback de usuarios, capturas de conversaciones, research a medias, decisiones tomadas en el móvil.

## La única regla: no ordenar al entrar

Si intentas estructurarlo antes de guardarlo, no lo vas a guardar. Tira el archivo y sigue.
Un `.md` con cuatro frases mal escritas vale más que la nota perfecta que nunca escribiste.

Nombra los archivos `YYYY-MM-DD-tema.md` para que se ordenen solos.

## Cómo se procesa

No lo ordenas tú. Se lo pides a Claude:

```
Lee docs/raw/ y dime qué patrones ves, qué se repite, y qué decisiones
pendientes hay ahí que no estén ya en CLAUDE.md o en memoria.
```

Lo que resulte valioso y estable sube de nivel:
- **Hecho permanente del proyecto** → `CLAUDE.md` (raíz)
- **Procedimiento repetible** → un skill en `.claude/skills/`
- **Contexto que debe sobrevivir entre sesiones** → memoria del proyecto
- **Análisis o informe** → `docs/`

Una vez que algo subió de nivel, el archivo de `raw/` puede borrarse. Esto es un buffer, no un archivo histórico.

## Qué NO va aquí

- **Secretos**: claves de API, tokens, credenciales, `.env`. Esto se versiona en git.
- Datos financieros reales de usuarios.
- Lo que ya está en el código o en el historial de git — eso ya está documentado por sí mismo.
