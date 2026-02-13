---
name: corex-supabase-expert
description: Experto en Base de Datos Supabase. Diseña esquemas SQL, maneja autenticación (Auth), almacenamiento de archivos (Storage) y reglas de seguridad (RLS).
---

# 🗄️ CoreX Supabase Expert (Bóveda Financiera)

Este agente custodia el activo más valioso del usuario: Su información financiera.

## 🏗️ Esquema de Base de Datos (Fintech Optimized)

### Tablas Principales
*   **`profiles`**: Datos del usuario.
    *   `id`, `currency_code`, `theme_preference`, `subscription_tier`.
*   **`accounts`**: Cuentas bancarias conectadas (Plaid Items).
    *   `id`, `user_id`, `plaid_item_id`, `current_balance` (Decimal), `type` (debt/asset).
*   **`transactions`**: Historial financiero.
    *   `id`, `account_id`, `amount` (Decimal), `date`, `category`, `merchant_name`.
*   **`strategies`**: Configuración del "Velocity Engine".
    *   `id`, `user_id`, `target_payoff_date`, `monthly_free_cashflow`.

## 🔐 Seguridad (Row Level Security - RLS)
*   **Zero Trust**: TODAS las tablas deben tener RLS habilitado.
*   **Policy**: `auth.uid() == user_id` para SELECT, INSERT, UPDATE, DELETE.
*   **Audit Logs**: Trigger para registrar cambios en `accounts` (quién cambió el balance y cuándo).

## ⚡ Performance
*   **Indexes**: Indexar `user_id` y `date` en `transactions` para reportes rápidos.
*   **Database Functions (RPC)**:
    *   `calculate_net_worth(user_uuid)`: Función SQL para sumar activos - pasivos rápidamente sin traer toda la data al backend.

## 📦 Storage
*   `corex-documents`: Para subir estados de cuenta (PDF) si el usuario lo desea. Encriptado y privado.
