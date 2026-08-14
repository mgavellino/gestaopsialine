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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_receivables: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          notes: string | null
          owner_id: string
          paid_at: string | null
          patient_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          error_message: string | null
          id: string
          owner_id: string
          patient_id: string | null
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id: string
          patient_id?: string | null
          reminder_type?: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          patient_id?: string | null
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          custom_kind: string | null
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          owner_id: string
          patient_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_kind?: string | null
          ends_at: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          owner_id: string
          patient_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_kind?: string | null
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          owner_id?: string
          patient_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource: string | null
          resource_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource?: string | null
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource?: string | null
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      books: {
        Row: {
          authors: string | null
          cover_id: number | null
          created_at: string
          first_publish_year: number | null
          id: string
          notes: string | null
          ol_key: string | null
          owner_id: string
          rating: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          authors?: string | null
          cover_id?: number | null
          created_at?: string
          first_publish_year?: number | null
          id?: string
          notes?: string | null
          ol_key?: string | null
          owner_id: string
          rating?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          authors?: string | null
          cover_id?: number | null
          created_at?: string
          first_publish_year?: number | null
          id?: string
          notes?: string | null
          ol_key?: string | null
          owner_id?: string
          rating?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          redemptions_count: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_count?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      depoimentos: {
        Row: {
          comentario: string
          created_at: string
          estrelas: number
          id: string
          nome: string
        }
        Insert: {
          comentario: string
          created_at?: string
          estrelas: number
          id?: string
          nome: string
        }
        Update: {
          comentario?: string
          created_at?: string
          estrelas?: number
          id?: string
          nome?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          owner_id: string
          patient_id: string | null
          record_id: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          owner_id: string
          patient_id?: string | null
          record_id?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          owner_id?: string
          patient_id?: string | null
          record_id?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          owner_id: string
          paid_at: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          owner_id: string
          paid_at?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          owner_id?: string
          paid_at?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_record_versions: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          record_id: string
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          record_id: string
          version: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          record_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "medical_record_versions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          content: Json
          content_text: string | null
          created_at: string
          id: string
          owner_id: string
          patient_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          owner_id: string
          patient_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          patient_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          assessment_date: string | null
          avatar_url: string | null
          billing_type: string
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          father_name: string | null
          father_phone: string | null
          financial_responsible_cpf: string | null
          financial_responsible_name: string | null
          full_name: string
          id: string
          is_active: boolean
          mother_name: string | null
          mother_phone: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          reassessment_date: string | null
          receipt_required: boolean
          session_price: number | null
          therapeutic_plan: Json | null
          therapy_end_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assessment_date?: string | null
          avatar_url?: string | null
          billing_type?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          father_phone?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          mother_name?: string | null
          mother_phone?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          reassessment_date?: string | null
          receipt_required?: boolean
          session_price?: number | null
          therapeutic_plan?: Json | null
          therapy_end_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assessment_date?: string | null
          avatar_url?: string | null
          billing_type?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          father_phone?: string | null
          financial_responsible_cpf?: string | null
          financial_responsible_name?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          mother_name?: string | null
          mother_phone?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          reassessment_date?: string | null
          receipt_required?: boolean
          session_price?: number | null
          therapeutic_plan?: Json | null
          therapy_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          environment: string
          gateway: string
          gateway_payment_id: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_session_id: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          environment?: string
          gateway?: string
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_session_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          environment?: string
          gateway?: string
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_session_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          capabilities: Json
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: Database["public"]["Enums"]["plan_interval"]
          is_active: boolean
          is_featured: boolean
          max_installments: number | null
          max_patients: number | null
          name: string
          price_cents: number
          promo_label: string | null
          promo_price_cents: number | null
          slug: string
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval: Database["public"]["Enums"]["plan_interval"]
          is_active?: boolean
          is_featured?: boolean
          max_installments?: number | null
          max_patients?: number | null
          name: string
          price_cents: number
          promo_label?: string | null
          promo_price_cents?: number | null
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: Database["public"]["Enums"]["plan_interval"]
          is_active?: boolean
          is_featured?: boolean
          max_installments?: number | null
          max_patients?: number | null
          name?: string
          price_cents?: number
          promo_label?: string | null
          promo_price_cents?: number | null
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_commission_pct: number | null
          created_at: string
          crp: string | null
          default_session_price_cents: number
          full_name: string | null
          id: string
          is_blocked: boolean
          monthly_goal_cents: number | null
          onboarding_completed: boolean
          phone: string | null
          specialty: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_commission_pct?: number | null
          created_at?: string
          crp?: string | null
          default_session_price_cents?: number
          full_name?: string | null
          id: string
          is_blocked?: boolean
          monthly_goal_cents?: number | null
          onboarding_completed?: boolean
          phone?: string | null
          specialty?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clinic_commission_pct?: number | null
          created_at?: string
          crp?: string | null
          default_session_price_cents?: number
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          monthly_goal_cents?: number | null
          onboarding_completed?: boolean
          phone?: string | null
          specialty?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      psychoeducation_resources: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      quick_notes: {
        Row: {
          content: string
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          owner_id: string
          priority: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          owner_id: string
          priority?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          owner_id?: string
          priority?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_blocks: {
        Row: {
          color: string | null
          created_at: string
          end_time: string
          id: string
          owner_id: string
          start_time: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          end_time: string
          id?: string
          owner_id: string
          start_time: string
          title: string
          updated_at?: string
          weekday: number
        }
        Update: {
          color?: string | null
          created_at?: string
          end_time?: string
          id?: string
          owner_id?: string
          start_time?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          crp: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crp?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crp?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          expires_at: string | null
          gateway: string | null
          gateway_subscription_id: string | null
          id: string
          plan_id: string | null
          price_id: string | null
          product_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          expires_at?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          price_id?: string | null
          product_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          expires_at?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          price_id?: string | null
          product_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      get_user_plan_limits: { Args: { _uid: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_access: {
        Args: { _env?: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin_master" | "user"
      appointment_kind:
        | "consulta"
        | "reuniao"
        | "supervisao"
        | "pessoal"
        | "outro"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "refunded"
        | "cancelled"
      plan_interval: "monthly" | "quarterly" | "yearly" | "lifetime"
      receivable_status: "pending" | "paid" | "overdue" | "waived"
      reminder_status: "scheduled" | "sent" | "failed" | "cancelled"
      subscription_status:
        | "active"
        | "expired"
        | "cancelled"
        | "trial"
        | "lifetime"
        | "past_due"
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
      app_role: ["admin_master", "user"],
      appointment_kind: [
        "consulta",
        "reuniao",
        "supervisao",
        "pessoal",
        "outro",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "refunded",
        "cancelled",
      ],
      plan_interval: ["monthly", "quarterly", "yearly", "lifetime"],
      receivable_status: ["pending", "paid", "overdue", "waived"],
      reminder_status: ["scheduled", "sent", "failed", "cancelled"],
      subscription_status: [
        "active",
        "expired",
        "cancelled",
        "trial",
        "lifetime",
        "past_due",
      ],
    },
  },
} as const
