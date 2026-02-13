---
name: corex-tech-stack
description: Arquitecto Técnico Senior para CoreX. Define los estándares para el stack React + FastAPI + Supabase. Úsalo para configurar librerías, estructura de carpetas y optimización.
---

# 🏗️ CoreX Tech Stack (Arquitecto Técnico)

Este agente garantiza la excelencia técnica de CoreX. Asegura que el código sea escalable, seguro y de alto rendimiento, siguiendo la arquitectura "Clean Architecture" adaptada a nuestro stack.

## 🚀 Stack Tecnológico Oficial

### Frontend (User Interface)
*   **Core**: React 18+ (Vite).
*   **Lenguaje**: TypeScript (Strict Mode).
*   **Estilos**: Tailwind CSS (Utility-first) + Shadcn/ui.
*   **Estado Global**: Zustand (Store ligero y rápido).
*   **Data Fetching**: TanStack Query (React Query) para caché y estado del servidor.
*   **Visualización**: Recharts (Gráficos financieros precisos).
*   **Iconos**: Lucide React.

### Backend (Logic & Calculation)
*   **Framework**: FastAPI (Python 3.11+).
*   **Validación**: Pydantic v2 (Strict schemas).
*   **Cálculos**: `decimal` module para precisión financiera (NUNCA float).
*   **Análisis**: Pandas (para proyecciones complejas).

### Database & Infra
*   **DB**: Supabase (PostgreSQL).
*   **Auth**: Supabase Auth via RLS Policies.
*   **Integraciones**: Plaid API (Banking), Google Sheets API (Reports).

---

## 🛠️ Estándares de Código

### 1. Estructura de Directorios

#### Frontend (`/frontend/src`)
```
/src
  /components
    /ui           # Shadcn (Botones, Cards, Inputs)
    /shared       # Componentes reutilizables propios
  /features       # Lógica por dominio (Auth, Dashboard, Strategy)
    /api          # Hooks de React Query
    /components   # UI específica del feature
    /store        # Store de Zustand del feature
  /lib            # Utilidades (formateadores de moneda, fechas)
  /routes         # Definición de rutas (React Router)
```

#### Backend (`/backend/app`)
```
/app
  /api            # Endpoints (Routers)
  /core           # Config, Security, Logging
  /models         # Pydantic Schemas (DTOs)
  /services       # Lógica de negocio e integraciones (PlaidService)
  /db             # Conexión y sesiones
```

### 2. Principios de Desarrollo
*   **Money Handling**:
    *   **Frontend**: Usa enteros (centavos) o librerías. NUNCA operes con floats en JS.
    *   **Backend**: Usa `Decimal` siempre.
*   **Type Safety**: No uses `any`. Define interfaces para todo.
*   **Component Composition**: Prefiere componentes pequeños y compuestos a monolitos.

### 3. Tailwind CSS & Design System
*   Usa las variables de color definidas en `corex-brand-guardian` (`bg-slate-950`, `text-gold-500`).
*   Mantén el modo oscuro como predeterminado.
*   Usa `clsx` y `tailwind-merge` para clases condicionales.

## 🧪 Validación Técnica
Antes de aprobar un PR:
1.  ¿Están los secretos protegidos (env vars)?
2.  ¿Se manejan los errores de API gracefulmente en el frontend?
3.  ¿La precisión decimal es correcta en los cálculos de interés?
