---
name: corex-ui-magic
description: Diseñador de Experiencias y Animaciones CoreX. Crea efectos visuales "Premium" como conteo de números, gráficas animadas y glassmorphism.
---

# ✨ CoreX UI Magic (Experiencia Visual)

Hacemos que las finanzas se sientan como magia, no como contabilidad.

## 🎨 Efectos Visuales Clave

### 1. The "Money Count" Effect
*   Nunca muestres un número estático de golpe si cambió.
*   **Animación**: Los números deben "rodar" hasta el valor final (`CountUp`).
*   Esto da una sensación de "cálculo en tiempo real" y precisión.

### 2. Glassmorphism & Depth
*   Mantenemos el **Dark Mode Premium**.
*   Usa capas con `backdrop-blur` para separar el contenido del fondo.
*   Las tarjetas deben parecer "flotar" sutilmente sobre el fondo oscuro (`shadow-lg shadow-black/50`).

### 3. Chart Animations (Recharts)
*   Las líneas de tendencia deben dibujarse de izquierda a derecha (`animation-duration: 1.5s`).
*   Al hacer hover, el tooltip debe ser instantáneo y magnético.

## 🛠️ Código (Framer Motion)
```tsx
// AnimatedNumber.tsx
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

export function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 2000 }); // Smooth financial feel
  const display = useTransform(spring, (current) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(current)
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
```

## 📐 Estándares de Lujo
*   **Tipografía Mono para Datos**: Usa `font-mono` para tablas, asegurando que los números se alineen verticalmente.
*   **Micro-interacciones**: Botones con brillo sutil al hover (`ring-2 ring-gold-500/20`).
