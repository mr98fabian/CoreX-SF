export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            accounts: {
                Row: {
                    balance: number | null
                    closing_day: number | null
                    due_day: number | null
                    id: number
                    interest_rate: number | null
                    is_velocity_target: boolean | null
                    min_payment: number | null
                    name: string
                    payment_frequency: string | null
                    plaid_account_id: string | null
                    type: string
                }
                Insert: {
                    balance?: number | null
                    closing_day?: number | null
                    due_day?: number | null
                    id?: number
                    interest_rate?: number | null
                    is_velocity_target?: boolean | null
                    min_payment?: number | null
                    name: string
                    payment_frequency?: string | null
                    plaid_account_id?: string | null
                    type: string
                }
                Update: {
                    balance?: number | null
                    closing_day?: number | null
                    due_day?: number | null
                    id?: number
                    interest_rate?: number | null
                    is_velocity_target?: boolean | null
                    min_payment?: number | null
                    name?: string
                    payment_frequency?: string | null
                    plaid_account_id?: string | null
                    type?: string
                }
                Relationships: []
            }
            cashflow_items: {
                Row: {
                    amount: number | null
                    category: string
                    date_specific_1: number | null
                    date_specific_2: number | null
                    day_of_month: number | null
                    day_of_week: number | null
                    frequency: string | null
                    id: number
                    is_variable: boolean | null
                    month_of_year: number | null
                    name: string
                }
                Insert: {
                    amount?: number | null
                    category: string
                    date_specific_1?: number | null
                    date_specific_2?: number | null
                    day_of_month?: number | null
                    day_of_week?: number | null
                    frequency?: string | null
                    id?: number
                    is_variable?: boolean | null
                    month_of_year?: number | null
                    name: string
                }
                Update: {
                    amount?: number | null
                    category?: string
                    date_specific_1?: number | null
                    date_specific_2?: number | null
                    day_of_month?: number | null
                    day_of_week?: number | null
                    frequency?: string | null
                    id?: number
                    is_variable?: boolean | null
                    month_of_year?: number | null
                    name?: string
                }
                Relationships: []
            }
            movement_log: {
                Row: {
                    amount: number
                    date_executed: string
                    date_planned: string
                    id: number
                    movement_key: string
                    status: string | null
                    title: string
                    verified_transaction_id: number | null
                }
                Insert: {
                    amount: number
                    date_executed: string
                    date_planned: string
                    id?: number
                    movement_key: string
                    status?: string | null
                    title: string
                    verified_transaction_id?: number | null
                }
                Update: {
                    amount?: number
                    date_executed?: string
                    date_planned?: string
                    id?: number
                    movement_key?: string
                    status?: string | null
                    title?: string
                    verified_transaction_id?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "movement_log_verified_transaction_id_fkey"
                        columns: ["verified_transaction_id"]
                        isOneToOne: false
                        referencedRelation: "transactions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            transactions: {
                Row: {
                    account_id: number | null
                    amount: number | null
                    category: string
                    date: string
                    description: string
                    id: number
                    plaid_transaction_id: string | null
                }
                Insert: {
                    account_id?: number | null
                    amount?: number | null
                    category: string
                    date: string
                    description: string
                    id?: number
                    plaid_transaction_id?: string | null
                }
                Update: {
                    account_id?: number | null
                    amount?: number | null
                    category?: string
                    date?: string
                    description?: string
                    id?: number
                    plaid_transaction_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "transactions_account_id_fkey"
                        columns: ["account_id"]
                        isOneToOne: false
                        referencedRelation: "accounts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            users: {
                Row: {
                    email: string
                    id: number
                    name: string
                    shield_target: number | null
                }
                Insert: {
                    email: string
                    id?: number
                    name: string
                    shield_target?: number | null
                }
                Update: {
                    email?: string
                    id?: number
                    name?: string
                    shield_target?: number | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never
