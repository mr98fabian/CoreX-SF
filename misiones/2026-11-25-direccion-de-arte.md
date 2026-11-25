# Dirección de arte de KoreX — «Cobre a la vista» (iteración 2)

Estado: **dirección aprobada por Fabian el 2026-11-25** (iteración 2). Nada de esto está construido; quedan abiertas las 3 decisiones de §8.2.
Autor: Fable (diseño). Implementa: Opus, en 1–2 misiones, solo después de la aprobación.
Alcance: las 5 pantallas de la barra + apertura + login. No toca números, rótulos ni lógica.

Cómo leerlo: lo marcado **[medido]** lo calculé o lo leí del código hoy; lo marcado
**[presupuesto]** es un límite que la implementación debe cumplir y que aún no existe.

### Qué cambió en esta iteración (orden de Fabian, 2026-11-25)

- **Tadeo no aparece en la app.** Ni poses, ni guantes en la apertura, ni celebraciones con mascota. La única marca dentro de la app es **la K**.
- **La app es seria.** Los videos son los metafóricos y los de risa; la app no. El cable se queda como **forma visual**, pero la app no lo nombra, no bromea y no hace guiños de dibujo animado.
- Apertura rehecha: el cable se pela solo + iris. Ceremonia de $0 rehecha: cable en cobre + sello PAGADA.
- Consecuencias que saqué yo de esas dos órdenes (dilo si alguna no la quieres): fuera la curva con rebote, fuera Fraunces «blanda» y la cursiva de intertítulo, fuera todo texto con chiste o con la metáfora dicha en palabras.

---

## 1. La idea en 5 líneas

1. KoreX de noche: fondo casi negro y una sola luz ámbar. Sobrio, preciso, cálido.
2. La deuda se dibuja como una línea forrada; lo ya pagado queda en cobre a la vista. **El ámbar de la marca es el cobre**: cuanto más ámbar ves, más has avanzado.
3. Esa línea sustituye a todo lo genérico: es la barra de progreso, el indicador de la pestaña activa, el eje del plan y la animación de apertura. Una sola figura en toda la app.
4. **La metáfora se ve, no se dice.** Ningún texto de la app habla de cables, de pelar ni de enchufes. Quien vio los videos la reconoce; quien no, ve un indicador de progreso claro y distinto.
5. Un número héroe por pantalla, en Fraunces; todo lo demás calla. La única marca es la K.

Lo que hace irreconocible a la app no es un color nuevo ni una mascota: es que **no hay barras de progreso, ni anillos, ni tarjetas con icono-en-círculo**. Hay una línea de cobre que avanza.

---

## 2. Tokens

### 2.1 Qué se conserva tal cual (y por qué)

La base «Noche con luz» de `frontend/src/styles/kx.css` ya es buena y ya está auditada en contraste. Se conserva sin cambios:

| Token | Valor | Papel |
|---|---|---|
| `--kx-bg` | `#020617` | Fondo de todo y de las barras del sistema |
| `--kx-surface` / `-2` / `--kx-raised` | `#111C33` / `#1A2742` / `#22314F` | Niveles 1, 2 y 3 |
| `--kx-ink` / `-2` / `-3` | `#F5F2EC` / `#AEB9CB` / `#8C9AB0` | Texto: hueso, secundario, terciario |
| `--kx-amber` | `#F59E0B` | Rellenos (ahora: **el cobre**) |
| `--kx-amber-text` | `#FBBF24` | Ámbar como texto |
| `--kx-on-amber` | `#1C1206` | Tinta sobre ámbar |
| `--kx-debt` / `--kx-almost` / `--kx-paid` / `--kx-pay` | sin cambios | Semántica de datos, solo sobre datos |
| `--kx-grain` | sin cambios | El grano de fondo |
| Duraciones `120 / 240 / 480 / 700 ms` y `--kx-ease-out` | sin cambios | Ver §4 |
| Radios `20 / 12 / 999 px` | sin cambios | Tarjeta, fila, pastilla |

### 2.2 Qué se añade (4 tokens)

| Token nuevo | Valor | Papel |
|---|---|---|
| `--kx-funda` | `#7482A0` | El forro de la línea: lo que aún se debe |
| `--kx-funda-sombra` | `#4A5670` | Cara inferior del forro (volumen, 1 px) |
| `--kx-cobre` | alias de `--kx-stripe` (el degradado ámbar que ya existe) | La línea al descubierto. Único degradado de la app, y comunica dato |
| `--kx-foco` | `radial-gradient(60% 50% at 50% 38%, rgba(255,247,230,.09), transparent)` | Una sola luz por pantalla, detrás del número héroe |

Salen respecto a la iteración 1: `--kx-tinta` (era el negro de Tadeo) y `--kx-goma` (la curva con rebote).

Contraste **[medido]** (WCAG, calculado hoy):

| Par | Sobre `#020617` | Sobre `#111C33` | Sobre `#1A2742` | Sobre `#22314F` |
|---|---|---|---|---|
| Funda `#7482A0` (objeto gráfico, mínimo 3:1) | 5.23 | 4.40 | 3.85 | 3.36 |
| Cobre `#F59E0B` (objeto gráfico) | 9.39 | 7.90 | 6.92 | 6.03 |
| Ámbar texto `#FBBF24` (texto, mínimo 4.5:1) | 12.08 | 10.16 | 8.90 | 7.76 |
| Hueso `#F5F2EC` | 18.05 | 15.18 | 13.30 | 11.60 |
| `--kx-ink-3` `#8C9AB0` | 7.07 | 5.95 | 5.21 | 4.55 |

Tinta `#1C1206` sobre cobre: 8.59.
Funda contra cobre, pegados uno a otro: menos de 3:1 (2.01 con un gris algo más oscuro). **Por eso la frontera entre funda y cobre nunca depende del color**: lleva siempre el corte (§4.3) y una cifra en texto al lado.

### 2.3 Tipografía

Tres familias dentro de la app, ni una más: **Fraunces** (héroe), **Inter** (interfaz), **IBM Plex Mono** (datos técnicos). Ya están cargadas; **no cambia ninguna petición de fuentes**.

| Rol | Fuente | Tamaño / peso | Regla |
|---|---|---|---|
| Número héroe | Fraunces, cifras tabulares | 56 px en móvil (44 px si pasa de 9 caracteres), peso 480 | Uno por pantalla. Nunca dos |
| Título de pantalla | Fraunces recta | 22 px, peso 400 | Máximo 4 palabras. Sin cursiva |
| Texto de interfaz | Inter | 15 px cuerpo, 13 px secundario, mínimo 12 px | Frase normal, sin mayúsculas sostenidas |
| Cifras en filas y fechas | IBM Plex Mono, tabulares | 15 px | Los dígitos no bailan al actualizarse |

Oportunidad fuera de alcance: `index.html` carga hoy 7 familias **[medido]** (Montserrat, Rajdhani, Space Grotesk y JetBrains Mono vienen del sistema anterior). No las quito aquí porque siguen en pantallas fuera de la barra.

### 2.4 Línea, sombra y textura

- **Trazo**: todo lo dibujado (iconos, línea de cobre, sello) usa extremos y uniones redondos.
- **Sombras**: las tres elevaciones `--kx-elev-1/2/3` actuales, sin cambios. Prohibido el brillo de color permanente; el cobre solo destella 240 ms cuando acaba de descubrirse.
- **Una luz por pantalla**: `--kx-foco` detrás del número héroe. Las tarjetas no llevan luz propia.
- **Tarjetas más calladas**: superficie plana + 1 px de `--kx-line`. Sin icono-en-círculo en la cabecera, sin franja de color lateral.

---

## 3. Iconografía — «trazo de cable»

### 3.1 El estilo

| Parámetro | Valor |
|---|---|
| Retícula | 24 × 24 px, área viva 20 × 20 |
| Grosor | 2 px, único en toda la app |
| Extremos y uniones | Redondos |
| Radio mínimo de esquina | 2 px (no hay ángulos vivos) |
| Relleno | Ninguno. Solo línea |
| **Gesto distintivo** | El trazo queda **abierto en un punto** y ese extremo termina en una **punta de cobre** de 3 px |
| Color | Línea en `currentColor`; la punta en `--kx-amber` |
| Estados | Inactivo: línea en `--kx-ink-3`, punta apagada. Activo: línea en `--kx-ink`, punta en cobre |

La punta de cobre es la firma: se reconoce a 24 px y es sobria (un detalle de 3 px, no una ilustración). Regla dura: **una sola punta por icono**, siempre en el extremo abierto.

Construcción: cada icono son 2 trazos SVG (línea + punta). **[presupuesto]** los 18 juntos, 12 KB o menos sin comprimir; componentes locales, sin librería nueva.

### 3.2 Los 18 iconos

| # | Icono | Dónde | Dibujo |
|---|---|---|---|
| 1 | Inicio | Barra | Casa de un solo trazo: el contorno no cierra abajo a la derecha; ahí queda la punta |
| 2 | Calendario | Barra | Hoja con dos anillas; el borde inferior se alarga y sale por la derecha con la punta |
| 3 | Plan | Barra | Línea en S de arriba a abajo; el tercio inferior es la punta larga (6 px): el tramo ya recorrido |
| 4 | Cuentas | Barra | Tarjeta de esquinas redondas; la banda sale por la izquierda como línea |
| 5 | Suscripciones | Barra | Clavija de dos patas con su cable en bucle; la punta en el extremo del bucle |
| 6 | Objetivo de hoy | Tarjeta de misión | Pelacables abierto mordiendo una línea |
| 7 | Reserva / escudo | Misión, ajustes | Escudo de un trazo abierto arriba |
| 8 | Corte de tarjeta | Calendario, avisos | Tijera cruzando una línea |
| 9 | Vencimiento | Calendario | Reloj con una marca a las 12; la corona es la punta |
| 10 | Día de pago (nómina) | Calendario | Flecha que baja hacia una bandeja |
| 11 | Interés | Línea de interés diario | Línea con tres rayitas saliendo de una grieta: la fuga |
| 12 | El banco | Cuentas | Frontón con tres columnas; la base se alarga hacia la derecha |
| 13 | Deuda pagada | Cuentas, plan | Marca de verificación; la cola larga es la punta |
| 14 | Día libre | Plan | Clavija separada de su enchufe por 3 px de aire |
| 15 | Añadir | Cuentas, suscripciones | Cruz de dos trazos; el brazo derecho termina en punta |
| 16 | Ajustes | Cabecera | Perilla (círculo + marca), no engranaje |
| 17 | Aviso | Cabecera | Campana |
| 18 | Explicación | «¿Por qué?» | Bombilla de filamento; el filamento es la punta, encendida |

Se mantienen los 18. Ajusté el dibujo de tres (9, 10 y 17) para quitarles el aire de época; el resto queda igual.

Utilitarios (atrás, cerrar, desplegar, editar, borrar, candado, recargar): mismo grosor y extremos redondos, **sin punta**. Mientras tanto se quedan los de lucide con `strokeWidth` 2, que ya casan.

---

## 4. Lenguaje de movimiento

### 4.1 Principio

Solo se mueven dos cosas: **la línea de cobre** (cuando cambia un dato) y **el número** (cuando cambia su valor). Lo demás aparece y ya. Ningún movimiento rebota: una app seria frena, no bota. La única excepción es el sello PAGADA, que ya existe.

### 4.2 Curvas y duraciones

Todo sale de lo que ya hay en `lib/motion.ts` y `kx.css` **[medido]**. No se añade ninguna curva.

| Nombre | Valor | Para qué |
|---|---|---|
| Tirón (`--kx-ease-out`) | `cubic-bezier(0.16, 1, 0.3, 1)` | Todo: entra rápido, frena suave, sin rebasar |
| Sello (`STAMP_SPRING`) | el muelle actual | Solo el sello PAGADA |
| Rápida | 120 ms | Pulsar, soltar, encender una punta |
| Base | 240 ms | Cambio de pestaña, aparecer contenido, destello del cobre |
| Lenta | 480 ms | Descubrir un tramo de línea |
| Ceremonia | 700 ms | Deuda en $0 |
| Conteo | 560 ms | Números (el valor actual de `COUNT_MS`) |

`lib/motion.ts` fija hoy un tope de 700 ms por animación (`MAX_MS`) **[medido]**. Se respeta en todo salvo en la apertura, que es una secuencia de 1000 ms: necesita una excepción explícita y con test propio.

### 4.3 La línea de cobre (la pieza que más se repite)

Anatomía: funda `--kx-funda` de 10 px de alto con 1 px inferior de `--kx-funda-sombra`; debajo, cobre `--kx-cobre` de 6 px, centrado. La frontera entre ambos es **el corte**: la funda termina en un borde recto con un labio de 2 px que sobresale por arriba y por abajo. Es lo que marca «hasta aquí» sin depender del color.

Construcción barata: el cobre es una pista fija; la funda es una capa encima que se encoge con `transform: scaleX()` desde su borde. Solo `transform`, nada de anchos.

| Momento | Qué pasa | Duración |
|---|---|---|
| Aparecer en pantalla | Nada. La línea ya está en su estado. **No se anima al entrar ni al hacer scroll** | 0 |
| Baja la deuda | La funda se retira hasta la nueva posición y el cobre nuevo destella una vez | 480 + 240 ms |
| Sube la deuda (interés, cargo) | La funda avanza, sin destello | 240 ms |
| Deuda en $0 | Ver §4.6 | 700 ms |

Regla de datos: **la posición del corte la da el servidor**, nunca una resta en pantalla (ver §8, decisión 1).

### 4.4 La apertura, segundo a segundo

Sin personajes: la K, la línea y un iris.

Fotograma 0 = la pantalla de arranque nativa: fondo `#020617`, **la K** centrada (64 px) y, 40 px por debajo, una línea forrada horizontal que cruza el 70 % del ancho. Así no hay salto entre el arranque de Android y la app.

| Tiempo | Qué se ve | Técnica |
|---|---|---|
| 0–120 ms | La K y la línea quietas. Nada se mueve: el ojo se sitúa | — |
| 120–480 ms | La funda se abre **sola desde el centro** hacia los dos lados y deja 120 px de cobre a la vista, justo bajo la K | `scaleX` en dos mitades de funda, tirón |
| 480–600 ms | El cobre destella: un barrido de luz lo recorre una vez. Vibración de 10 ms si está permitida | `opacity` + `translateX` sobre un brillo |
| 600–920 ms | **Iris**: un círculo se abre desde el centro del cobre hasta cubrir la pantalla y deja ver Inicio, que ya estaba pintado debajo. La K se desvanece con el borde del iris | `clip-path: circle()` de 0 a 150 %, tirón |
| 920–1000 ms | El número héroe de Inicio termina su conteo; la punta del icono Inicio se enciende | Conteo + 120 ms |

Reglas, todas medibles:

- **Dura 1000 ms** y ni uno más. Si los datos no llegaron, el iris se abre igual sobre el esqueleto de carga: la apertura nunca espera a la red.
- **Tocar la salta**: cualquier toque lleva al estado final en 120 ms.
- Solo en arranque en frío, **una vez por sesión**. Volver de segundo plano no la repite.
- La app se monta debajo desde el milisegundo 0: la apertura es una capa encima, no una pantalla previa.
- Con «reducir movimiento»: fundido de 150 ms, sin línea que se abre ni iris.
- **[presupuesto]** la capa de apertura (SVG + CSS en línea), 3 KB o menos; cero imágenes de mapa de bits; cero JavaScript bloqueante.
- **[presupuesto]** en un Android de gama media, ningún fotograma por encima de 32 ms. Se mide, no se supone.

### 4.5 Micro-animaciones

| Qué | Cómo | Duración | Cuándo NO |
|---|---|---|---|
| Números que cuentan | El `CountUp` actual. Del valor anterior al nuevo | 560 ms | Al volver a una pestaña ya vista; mientras el usuario escribe una cifra |
| Cambio de pestaña | El contenido entra con fundido + 8 px hacia arriba. En la barra, un tramo de cobre de 24 px se desliza bajo el icono activo y su punta se enciende | 240 ms | Sin deslizamiento lateral de página: en gama media da tirones y pelea con el gesto de atrás |
| Icono de pestaña al activarse | La línea se redibuja de principio a fin | 240 ms | Solo el que se activa, nunca los cinco |
| Pulsar un botón | El estado `kx-press` que ya existe | 120 ms | — |
| Filas de una lista | Entrada escalonada actual (`kx-row-in`), solo las 6 primeras y solo la primera vez | 240 ms | Nunca al hacer scroll, nunca al refrescar |
| Misión cumplida | La marca se dibuja (ya existe), el botón pasa a cobre y el número héroe cuenta hacia abajo | 240 + 560 ms | Si la misión del día es $0 no hay nada que marcar |
| Corte cercano | Aparece el aviso con su icono, quieto | 240 ms | No parpadea, no se repite |

### 4.6 Deuda en $0 (la ceremonia)

El único momento lento a propósito. Todo ocurre **dentro de la fila de esa deuda**; nada invade la pantalla.

1. 0–480 ms: la funda que quedaba se retira entera; la línea es cobre de punta a punta.
2. 480–700 ms: un destello recorre el cobre; vibración de 20 ms.
3. 700 ms: cae el sello **PAGADA** con su muelle y su sombra (lo que ya existe; no se toca).
4. El saldo de la fila cuenta hasta $0 y el número héroe de la pantalla se actualiza con su conteo.

Total 1.3 s, **no bloquea**: se puede seguir tocando y desplazando desde el primer milisegundo. Sin confeti, sin mascota, sin sonido. La fila queda así para siempre: el cobre entero y el sello son el premio, y siguen ahí mañana.

### 4.7 Lo que NUNCA se anima

- Nada en bucle. Sin excepciones.
- Nada mientras el usuario escribe, y nunca un campo de dinero que esté editando.
- Nada al hacer scroll: ni paralaje, ni filas que entran, ni cabeceras que se encogen.
- Nada que retrase un toque: ninguna animación bloquea la interacción, dure lo que dure.
- Ningún diálogo de confirmar dinero, borrar o pagar: aparecen en 120 ms y ya.
- Las malas noticias (deuda que sube, faltante, pago vencido): cambio seco de 240 ms, sin destello.
- Nada al volver de segundo plano.
- Nada rebota, salvo el sello PAGADA.

Solo se animan `transform`, `opacity` y, en la apertura, `clip-path`. Prohibido animar anchos, altos, márgenes, sombras o desenfoques.

### 4.8 «Reducir movimiento»

Con la preferencia del sistema activa: todo se pinta en su estado final. Los números saltan al valor, la línea aparece ya en su posición, el sello aparece ya puesto, la apertura es un fundido de 150 ms. La app tiene que entenderse igual; si algo solo se entiende moviéndose, está mal diseñado.

---

## 5. La marca dentro de la app: solo la K

Tadeo vive en los videos. En la app no hay mascota, ni ilustraciones de personaje, ni humor.

| Dónde aparece la K | Tamaño | Regla |
|---|---|---|
| Apertura | 64 px, centrada | §4.4 |
| Login | 48 px, arriba | Con el nombre KoreX al lado, una sola vez |
| Cabecera de Inicio | 24 px, arriba a la izquierda | Quieta. No es un botón |
| Pantalla sin conexión y errores de carga | 32 px, en gris `--kx-ink-3` | Para que el error siga pareciendo KoreX |

Dónde **no**: en las demás pestañas, como marca de agua, dentro de tarjetas, ni animada fuera de la apertura.

### 5.1 Los estados que antes llevaba Tadeo

| Estado | Ahora |
|---|---|
| Pantalla vacía | Icono de la sección a 40 px en `--kx-ink-3`, una línea de texto y un botón. Ej.: «Aún no has añadido cuentas.» + **Añadir cuenta** |
| Error | Icono 17 (aviso), una línea que dice qué pasó y un botón **Reintentar**. Sin disculpas largas ni bromas |
| Corte cercano | Aviso con el icono 8 y la fecha: «Tu tarjeta corta el jueves 27.» |
| Misión cumplida | §4.5: la marca, el botón en cobre y el número que baja |
| Deuda en $0 | §4.6: cobre entero + sello PAGADA |
| Todas en $0 | La pantalla de Plan con la línea entera en cobre y el título «Sin deudas.» Sin pantalla especial |

### 5.2 Tono de los textos

- Español claro, frases cortas, de usted a tú: directo y respetuoso.
- **Ningún texto usa la metáfora**: no «cables», no «pelar», no «desenchufar», no «el banco pierde». Se dice «deuda», «pago», «cancelar», «pagada».
- Sin chistes, sin signos de exclamación, sin emojis.
- La resistencia frente al banco se expresa con hechos («Hoy pagas ≈ $X menos de interés»), no con actitud.

---

## 6. Las pantallas, una a una

Regla común: arriba el título de pantalla en Fraunces; debajo, **un** número héroe con su luz; luego el contenido. Toda cifra sigue llevando «≈» o su rótulo de estimación como hoy. Objetivos táctiles de 44 × 44 px como mínimo; la barra inferior, 56 px de alto más el margen seguro.

Los rótulos y las cifras que cito («Disponible para tu plan», «Efectivo en cuentas», «bajas desde hoy», «Te cobran este mes (fechado)») son los que dejó la misión 17 y **no se tocan**. Cambia cómo se ven, no qué dicen ni de dónde salen.

### 6.1 Apertura y login

- Apertura: §4.4.
- Login, hoy: formulario centrado sobre fondo oscuro, como cualquiera.
- Login, nuevo: la K con el nombre arriba; debajo, la línea de la apertura ya abierta en cobre, como horizonte. Luego una frase en Fraunces, sobria: «Tu plan para salir de deudas.» Y dos botones: **Entrar** (cobre, 52 px de alto) y **Probar demo** (contorno).
- Número héroe: ninguno. Es la única pantalla sin número.
- Por qué: hoy la primera impresión no tiene nada propio. La línea de cobre presenta desde el segundo cero la forma que el usuario va a ver en todas las pantallas.

### 6.2 Inicio

- Hoy: tarjetas apiladas (resumen, misión, interés diario, comparación), todas con el mismo peso.
- Héroe: **«Debes ≈»**, 56 px, con la luz detrás.
- Del número sale una línea vertical hacia abajo (10 px) que **termina en la tarjeta de la misión**. La misión deja de ser una tarjeta más: es donde llega la línea. Su botón principal es la única superficie de cobre de la pantalla.
- «Disponible para tu plan» y «Efectivo en cuentas» van en una sola línea de dos datos bajo el héroe, en Plex Mono, sin tarjeta.
- El interés diario lleva el icono 11 y nada más: una línea de texto, no una tarjeta.
- Comparación, casa y liga: debajo, plegadas por defecto.
- Por qué: hoy el ojo no sabe dónde ir. Ahora hay un recorrido: número → línea → acción.

### 6.3 Calendario

- Hoy: rejilla de mes con puntos de colores y totales arriba.
- Héroe: el **«Debes ≈» del cierre del mes mostrado**, con «bajas desde hoy» como dato secundario al lado.
- La rejilla se conserva (cualquiera entiende un calendario). Cambia lo que la recorre: **una línea pasa por debajo de cada semana**. Los días ya pasados la tienen en cobre; los que faltan, forrada. Hoy es donde está el corte.
- Sobre la línea, los eventos son marcas con icono: un punto de cobre el día que pagas, el icono 8 el día de corte, el icono 10 el día de nómina en `--kx-pay`. Máximo 2 marcas por día; si hay más, «+2».
- Tocar un día abre la hoja del día actual (`DaySheet`), sin cambios de contenido.
- Por qué: los puntos de colores obligan a aprenderse una leyenda. Los iconos se leen sin leyenda.

### 6.4 Plan

- Hoy: lista de tarjetas con los pasos.
- Héroe: **la fecha libre** («abril de 2027»), en Fraunces. Es el único héroe que no es dinero.
- La pantalla es **una línea vertical** a la izquierda (16 px desde el borde), de arriba (hoy) abajo (fecha libre). Cada mes es un tramo; cada deuda que se termina es una marca con su nombre a la derecha y el mes en Plex Mono.
- Lo ya recorrido está en cobre; lo que falta, forrado. Abajo del todo, el icono 14.
- Al entrar por primera vez tras bajar la deuda, la funda se retira hasta la posición nueva (480 ms). Las demás veces está quieta.
- Los pasos del plan actuales pasan a ser las etiquetas de las marcas; el detalle se abre al tocar.
- Por qué: una lista de pasos no dice cuánto falta. Una línea con principio y final sí, de un vistazo.

### 6.5 Cuentas

- Hoy: filas con barra de progreso y colores por etapa.
- Héroe: **«Efectivo en cuentas»**. La deuda total ya es el héroe de Inicio.
- Cada deuda es **una fila con su línea**: nombre a la izquierda, saldo en Plex Mono a la derecha, y debajo la línea a todo el ancho con su corte. La barra de progreso desaparece: la línea *es* la barra.
- Las etapas actuales (debe / casi / pagada) conservan sus colores, pero solo en la pastilla de estado, no en la fila entera.
- Orden: el objetivo del ataque arriba, con el icono 6 a su lado. Es el único icono de marca en la lista.
- Las pagadas van al final, cobre entero, con el sello PAGADA actual. Se pliegan si son más de 3.
- El icono 12 encabeza la sección de deudas; el dinero propio va aparte y sin línea.
- Por qué: la lista con barritas es la pantalla más genérica de cualquier app de finanzas. Con la línea de cobre es la más propia, y se lee igual de rápido.

### 6.6 Suscripciones

- Hoy: lista de cargos con importe y fecha.
- Héroe: **lo que te cobran al mes ≈**, el total de las activas.
- Cada fila: icono 5 en miniatura, nombre, importe y próxima fecha.
- Cancelar: el botón dice **«Cancelar suscripción»**. Al confirmar, la fila baja al grupo «Canceladas» (240 ms) y el héroe cuenta hacia abajo.
- Las detectadas como duplicadas o dudosas llevan una nota de texto, sin color de alarma.
- Por qué: el cambio aquí es de jerarquía, no de adorno: un total grande arriba y filas calladas debajo.

### 6.7 La barra inferior

- 5 pestañas, 56 px, iconos 1–5 con su rótulo siempre visible debajo (11 px).
- El indicador de pestaña activa es un tramo de cobre de 24 × 3 px sobre el borde superior de la barra, que se desliza de una a otra.
- Sin botón flotante central, sin pastilla de fondo en la activa.

---

## 7. Lo que queda FUERA a propósito

| Fuera | Por qué |
|---|---|
| **Tadeo y cualquier personaje o ilustración** | Orden de Fabian: vive en los videos. La app es seria |
| **Humor y metáfora dicha en palabras** | La metáfora se ve en la forma; los textos son literales |
| Rebotes y curvas elásticas | No casan con una app de dinero. Solo el sello PAGADA conserva su muelle |
| Modo claro | Existe en `kx.css` y no lo rompo, pero no lo rediseño: la app se usa de noche |
| Motores 3D, Lottie, Rive, video, sprites | Peso y batería. Todo es SVG + CSS; no se añade ninguna librería |
| Sonido | De noche y con sueño molesta. Solo vibración corta, y opcional |
| Confeti, partículas, fuegos | La ceremonia es la línea entera en cobre y el sello |
| Pantallas fuera de la barra (ajustes, ranking, juez, reloj de dinero, landing, precios) | Segunda pasada, con los mismos tokens |
| Icono de la app y logotipo | No los toco. La K sigue siendo la K |
| Cualquier número, rótulo o cálculo | Lo decidió la misión 17. Este documento solo cambia la piel |
| Gestos nuevos (deslizar para pagar, mantener pulsado) | Un usuario no técnico no los descubre |
| Temas y personalización de colores | Diluyen la identidad justo cuando se está fijando |

---

## 8. Lo intocable, lo que hay que decidir y cómo se reparte

### 8.1 Intocable (y por qué)

1. **La paleta base y sus contrastes.** Ya está afinada canal a canal (hay un comentario en `kx.css` que sube un gris 2 puntos para llegar a 4.55:1). La identidad viene de la línea de cobre, no de otro azul.
2. **El sello PAGADA con su caída y su sombra.** Ya tiene carácter propio; ahora es el centro de la ceremonia.
3. **Los rótulos honestos de la misión 17** («≈», «desde hoy», «fechado», efectivo nunca como «Disponible»). Son requisito legal y de confianza.
4. **`<MoneyAmount>` y las cifras tabulares.**
5. **El respeto actual a «reducir movimiento»** en `kx.css` y `lib/motion.ts`. Se amplía, no se rehace.

### 8.2 Decisiones que necesito de Fabian

1. **La posición del corte en cada línea.** Para mostrar una deuda «al X %» hace falta saber desde cuánto empezó. Si el servidor no da ya ese dato, hay dos caminos: (a) un campo nuevo de solo lectura en el motor, que es tocar backend; o (b) líneas medidas en tiempo (meses recorridos del plan), que sale de lo que ya hay. No lo he comprobado en el motor; **recomiendo (b) para la primera misión**.
2. **El héroe de Inicio.** Propongo «Debes ≈». La alternativa es el importe de la misión de hoy, pero muchos días es $0.
3. **Vibración**: ¿activada por defecto o apagada?

Ya no hay bloqueo de dibujo: sin Tadeo, todo lo de este documento lo puede construir Opus sin material externo.

### 8.3 Reparto sugerido en 2 misiones

| Misión | Contenido | Hecho cuando |
|---|---|---|
| A — Cimientos | Tokens nuevos, componente de línea de cobre, los 18 iconos, barra inferior, apertura, pantalla de arranque nativa a juego | Las 5 pantallas usan línea e iconos propios; apertura de 1000 ms que se salta al tocar; presupuestos de peso cumplidos |
| B — Composición | Inicio, Plan, Calendario, Cuentas y Suscripciones con la composición de §6; ceremonia de $0; login; estados vacíos y de error | Cada pantalla tiene un solo héroe; la ceremonia dura 1.3 s y no bloquea; ningún texto usa la metáfora |

### 8.4 Criterios de aceptación medibles

- Contraste AA en todo texto (4.5:1) y 3:1 en todo objeto gráfico con significado; los pares de §2.2 ya lo cumplen **[medido]**.
- Objetivos táctiles de 44 × 44 px o más en todo lo que se pulsa.
- Apertura: 1000 ms exactos; se salta en 120 ms o menos al tocar; una vez por sesión.
- Ninguna animación fuera de la apertura dura más de 700 ms; ninguna bloquea un toque; ninguna en bucle.
- Peso añadido al paquete inicial: 20 KB comprimidos o menos (tokens, línea, iconos, apertura). Cero imágenes nuevas.
- Desplazar una lista de 30 cuentas no dispara ninguna animación.
- Con «reducir movimiento», cero animaciones salvo fundidos de 150 ms o menos.
- Búsqueda en los textos de la app: cero apariciones de «cable», «pelar», «enchuf» y «Tadeo» en lo que ve el usuario.
- Prueba del papá: se le enseña la pantalla de Cuentas 5 segundos; debe poder decir cuál deuda va más avanzada sin leer cifras.
- Prueba de identidad: una captura con el logo tapado, puesta junto a capturas de otras 3 apps de finanzas, se distingue como «la de la línea de cobre».
