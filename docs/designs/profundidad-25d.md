# MISIÓN — Profundidad 2.5D + movimiento visible (sistema, todas las secciones)

Estado: diseño en revisión (2026-11-08). No implementado.

Pedido: la app "se ve muy plana, todo en 2D". Dirección: 2.5D, NO 3D — profundidad por LUZ y CAPAS (Apple Card/Revolut), cero WebGL, cero blobs. Más animación que la 6.1 (quedó demasiado sutil): subir la visibilidad UN escalón, manteniendo la elegancia bancaria y las reglas de Pulido (una sola curva kx, el movimiento nace de los datos, reduced-motion manda).

## Sistema (tokens primero, las pantallas heredan)

- Elevación kx: 3 niveles de superficie con sombra y borde de luz consistentes (`kx-elev-1/2/3`): fondo (el campo), tarjetas (nivel 1), héroes y sheets (nivel 2/3). Una sola dirección de luz (desde arriba) en todo el sistema.
- Luz: degradado de luz sutil sobre el campo del calendario y el héroe de Inicio (viñeta superior), con parallax ligado al scroll que ya existe (6–10 px máximo).
- Relieve: barras de etapa y del termómetro con brillo interior superior (inset highlight) — metal cepillado, no plástico.
- La estampa PAGADA cae con sombra que crece al acercarse (scale + shadow, la misma curva).
- Sheets suben desde abajo con el fondo desenfocado (backdrop blur SOLO con la hoja abierta, tope Android: blur ≤ 12px) y sombra de capa real.
- Movimiento visible: transiciones entre secciones con desplazamiento de capas (el fondo se asienta 4 px más lento que el contenido), números que reaccionan al cambiar, micro-respuesta táctil en filas (la fila se hunde 1 nivel al tocarla, 120 ms).
- Guardarraíles: solo `transform` y `opacity` en animaciones, ≤700 ms, `prefers-reduced-motion` apaga parallax, conteos largos y el ascenso de hojas. Cero WebGL, cero librerías nuevas.

## Textura y tinta

- Grano de papel: textura de ruido SVG casi invisible sobre el fondo pizarra (opacidad muy baja, estática, sin animación).
- Tinta cálida: el texto principal gana un toque cálido (token de tinta ajustado, sin cambiar la paleta de etapas).
- Imprenta fina: fecha en formato editorial ("viernes, 7 de noviembre") en los encabezados donde hoy va técnica, y números tabulares verificados en todos los héroes.

## Alcance

Inicio, Calendario (campo + DaySheet), Cuentas, Plan de Ataque, Suscripciones, Actividad y Ajustes — la consistencia ES el entregable.

## Tests

Tokens/clases presentes en pantallas clave, reduced-motion anula parallax y hojas animadas, vitest + eslint + build verdes, backend sin cambios. Reporte con nota de rendimiento (qué se anima y con qué propiedad).
