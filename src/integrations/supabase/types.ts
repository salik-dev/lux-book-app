export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          base_price: number
          booking_number: string
          car_id: string | null
          contract_file_path: string | null
          contract_signed_at: string | null
          created_at: string
          customer_id: string | null
          delivery_distance_km: number | null
          delivery_fee: number | null
          delivery_location: string | null
          end_datetime: string
          extra_km_price: number | null
          id: string
          notes: string | null
          pickup_location: string
          start_datetime: string
          status: Database["public"]["Enums"]["booking_status"] | null
          total_price: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          base_price: number
          booking_number: string
          car_id?: string | null
          contract_file_path?: string | null
          contract_signed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_distance_km?: number | null
          delivery_fee?: number | null
          delivery_location?: string | null
          end_datetime: string
          extra_km_price?: number | null
          id?: string
          notes?: string | null
          pickup_location: string
          start_datetime: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_price: number
          updated_at?: string
          vat_amount: number
        }
        Update: {
          base_price?: number
          booking_number?: string
          car_id?: string | null
          contract_file_path?: string | null
          contract_signed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_distance_km?: number | null
          delivery_fee?: number | null
          delivery_location?: string | null
          end_datetime?: string
          extra_km_price?: number | null
          id?: string
          notes?: string | null
          pickup_location?: string
          start_datetime?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_price?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          base_price_per_day: number
          base_price_per_hour: number
          brand: string
          created_at: string
          description: string | null
          extra_km_rate: number | null
          id: string
          image_url: string | null
          included_km_per_day: number | null
          is_available: boolean | null
          model: string
          name: string
          updated_at: string
          year: number
        }
        Insert: {
          base_price_per_day: number
          base_price_per_hour: number
          brand: string
          created_at?: string
          description?: string | null
          extra_km_rate?: number | null
          id?: string
          image_url?: string | null
          included_km_per_day?: number | null
          is_available?: boolean | null
          model: string
          name: string
          updated_at?: string
          year: number
        }
        Update: {
          base_price_per_day?: number
          base_price_per_hour?: number
          brand?: string
          created_at?: string
          description?: string | null
          extra_km_rate?: number | null
          id?: string
          image_url?: string | null
          included_km_per_day?: number | null
          is_available?: boolean | null
          model?: string
          name?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          city: string
          created_at: string
          date_of_birth: string | null
          driver_license_file_path: string | null
          driver_license_number: string | null
          email: string
          full_name: string
          id: string
          phone: string
          postal_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          date_of_birth?: string | null
          driver_license_file_path?: string | null
          driver_license_number?: string | null
          email: string
          full_name: string
          id?: string
          phone: string
          postal_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          date_of_birth?: string | null
          driver_license_file_path?: string | null
          driver_license_number?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string
          postal_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          refund_amount: number | null
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          transaction_id: string | null
          updated_at: string
          vipps_order_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          vipps_order_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          vipps_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          created_at: string
          flat_fee: number | null
          id: string
          is_active: boolean | null
          max_distance_km: number | null
          min_distance_km: number | null
          name: string
          price_per_km: number | null
          rule_type: string
          updated_at: string
          zone_name: string | null
        }
        Insert: {
          created_at?: string
          flat_fee?: number | null
          id?: string
          is_active?: boolean | null
          max_distance_km?: number | null
          min_distance_km?: number | null
          name: string
          price_per_km?: number | null
          rule_type: string
          updated_at?: string
          zone_name?: string | null
        }
        Update: {
          created_at?: string
          flat_fee?: number | null
          id?: string
          is_active?: boolean | null
          max_distance_km?: number | null
          min_distance_km?: number | null
          name?: string
          price_per_km?: number | null
          rule_type?: string
          updated_at?: string
          zone_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_booking_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "active"
        | "completed"
        | "cancelled"
      payment_method: "stripe" | "vipps"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      user_role: "admin" | "operations" | "accountant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled",
      ],
      payment_method: ["stripe", "vipps"],
      payment_status: ["pending", "paid", "refunded", "failed"],
      user_role: ["admin", "operations", "accountant"],
    },
  },
} as const
