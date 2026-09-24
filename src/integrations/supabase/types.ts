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
      accounting_periods: {
        Row: {
          created_at: string
          gstr1_filed_at: string | null
          gstr3b_filed_at: string | null
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period_end: string
          period_start: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          gstr1_filed_at?: string | null
          gstr3b_filed_at?: string | null
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          gstr1_filed_at?: string | null
          gstr3b_filed_at?: string | null
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          tenant_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_audit_runs: {
        Row: {
          alert_error: string | null
          alert_sent: boolean
          id: string
          ran_at: string
          tenant_id: string
          threshold: number
          unlogged_count: number
        }
        Insert: {
          alert_error?: string | null
          alert_sent?: boolean
          id?: string
          ran_at?: string
          tenant_id: string
          threshold: number
          unlogged_count: number
        }
        Update: {
          alert_error?: string | null
          alert_sent?: boolean
          id?: string
          ran_at?: string
          tenant_id?: string
          threshold?: number
          unlogged_count?: number
        }
        Relationships: []
      }
      assignment_audit_settings: {
        Row: {
          alert_emails: string[]
          alert_threshold: number
          alert_throttle_hours: number
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alert_emails?: string[]
          alert_threshold?: number
          alert_throttle_hours?: number
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alert_emails?: string[]
          alert_threshold?: number
          alert_throttle_hours?: number
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_type: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_time: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_time: string | null
          created_at: string
          date: string
          early_departure_minutes: number | null
          id: string
          is_early_departure: boolean | null
          is_late: boolean | null
          late_minutes: number | null
          notes: string | null
          office_id: string | null
          selfie_url: string | null
          status: string | null
          total_hours_worked: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_type?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          early_departure_minutes?: number | null
          id?: string
          is_early_departure?: boolean | null
          is_late?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          office_id?: string | null
          selfie_url?: string | null
          status?: string | null
          total_hours_worked?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_type?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_time?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          early_departure_minutes?: number | null
          id?: string
          is_early_departure?: boolean | null
          is_late?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          office_id?: string | null
          selfie_url?: string | null
          status?: string | null
          total_hours_worked?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          coa_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          ifsc: string | null
          is_active: boolean
          kind: string
          name: string
          opening_balance: number
          opening_date: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          coa_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ifsc?: string | null
          is_active?: boolean
          kind?: string
          name: string
          opening_balance?: number
          opening_date?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          coa_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ifsc?: string | null
          is_active?: boolean
          kind?: string
          name?: string
          opening_balance?: number
          opening_date?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_coa_account_id_fkey"
            columns: ["coa_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bie_work_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          record_id: string
          tenant_id: string | null
          to_status: string | null
          work_type: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          record_id: string
          tenant_id?: string | null
          to_status?: string | null
          work_type: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          record_id?: string
          tenant_id?: string | null
          to_status?: string | null
          work_type?: string
        }
        Relationships: []
      }
      boq_items: {
        Row: {
          boq_id: string
          category: Database["public"]["Enums"]["boq_item_category"]
          created_at: string
          description: string
          estimated_unit_price: number | null
          id: string
          manufacturer: string | null
          model_number: string | null
          product_id: string | null
          quantity: number
          sort_order: number | null
          technical_specs: Json | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          boq_id: string
          category?: Database["public"]["Enums"]["boq_item_category"]
          created_at?: string
          description: string
          estimated_unit_price?: number | null
          id?: string
          manufacturer?: string | null
          model_number?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          technical_specs?: Json | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          boq_id?: string
          category?: Database["public"]["Enums"]["boq_item_category"]
          created_at?: string
          description?: string
          estimated_unit_price?: number | null
          id?: string
          manufacturer?: string | null
          model_number?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          technical_specs?: Json | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boq_items_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      boqs: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          feasibility: Database["public"]["Enums"]["boq_feasibility"] | null
          feasibility_notes: string | null
          handoff_by: string | null
          handoff_to_sales_at: string | null
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["boq_status"]
          technical_notes: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          feasibility?: Database["public"]["Enums"]["boq_feasibility"] | null
          feasibility_notes?: string | null
          handoff_by?: string | null
          handoff_to_sales_at?: string | null
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["boq_status"]
          technical_notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          feasibility?: Database["public"]["Enums"]["boq_feasibility"] | null
          feasibility_notes?: string | null
          handoff_by?: string | null
          handoff_to_sales_at?: string | null
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["boq_status"]
          technical_notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boqs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boqs_handoff_by_fkey"
            columns: ["handoff_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boqs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boqs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_owners: {
        Row: {
          brand: string
          created_at: string
          id: string
          is_primary: boolean
          owner_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_owners_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_owners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_procurement_mapping: {
        Row: {
          brand: string
          created_at: string
          id: string
          procurement_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          procurement_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          procurement_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_procurement_mapping_procurement_user_id_fkey"
            columns: ["procurement_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_procurement_mapping_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      break_records: {
        Row: {
          attendance_id: string
          break_type: string
          created_at: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          notes: string | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_id: string
          break_type: string
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_id?: string
          break_type?: string
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_records_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_order_stages: {
        Row: {
          created_at: string
          decision_id: string
          final_price: number | null
          id: string
          lead_time_days: number | null
          notes: string | null
          stage: Database["public"]["Enums"]["cct_stage"]
          supplier_name: string | null
          tenant_id: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          decision_id: string
          final_price?: number | null
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          stage: Database["public"]["Enums"]["cct_stage"]
          supplier_name?: string | null
          tenant_id?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          decision_id?: string
          final_price?: number | null
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          stage?: Database["public"]["Enums"]["cct_stage"]
          supplier_name?: string | null
          tenant_id?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cct_order_stages_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "cct_sourcing_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_order_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_order_stages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_sourcing_decisions: {
        Row: {
          assigned_team: Database["public"]["Enums"]["cct_assigned_team"] | null
          assigned_to: string | null
          brand: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          lead_id: string | null
          locked: boolean
          notes: string | null
          order_item_id: string | null
          priority: Database["public"]["Enums"]["cct_priority"]
          product_description: string | null
          quantity: number | null
          sales_order_id: string | null
          selling_price: number | null
          sourcing_type: Database["public"]["Enums"]["cct_sourcing_type"]
          status: string
          target_price: number | null
          tenant_id: string | null
          timeline_date: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          assigned_team?:
            | Database["public"]["Enums"]["cct_assigned_team"]
            | null
          assigned_to?: string | null
          brand?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lead_id?: string | null
          locked?: boolean
          notes?: string | null
          order_item_id?: string | null
          priority?: Database["public"]["Enums"]["cct_priority"]
          product_description?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          selling_price?: number | null
          sourcing_type?: Database["public"]["Enums"]["cct_sourcing_type"]
          status?: string
          target_price?: number | null
          tenant_id?: string | null
          timeline_date?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          assigned_team?:
            | Database["public"]["Enums"]["cct_assigned_team"]
            | null
          assigned_to?: string | null
          brand?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lead_id?: string | null
          locked?: boolean
          notes?: string | null
          order_item_id?: string | null
          priority?: Database["public"]["Enums"]["cct_priority"]
          product_description?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          selling_price?: number | null
          sourcing_type?: Database["public"]["Enums"]["cct_sourcing_type"]
          status?: string
          target_price?: number | null
          tenant_id?: string | null
          timeline_date?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cct_sourcing_decisions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_sourcing_decisions_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          notes: string | null
          opening_balance: number
          opening_date: string | null
          parent_id: string | null
          statement_group: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string | null
          parent_id?: string | null
          statement_group?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string | null
          parent_id?: string | null
          statement_group?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          office_id: string | null
          type: Database["public"]["Enums"]["chat_channel_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          office_id?: string | null
          type?: Database["public"]["Enums"]["chat_channel_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          office_id?: string | null
          type?: Database["public"]["Enums"]["chat_channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          channel_id: string
          id: string
          is_admin: boolean | null
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string | null
          currency_code: string
          date_format: string | null
          is_active: boolean | null
          name: string
          phone_code: string | null
          region: string | null
          tax_system: Json | null
        }
        Insert: {
          code: string
          created_at?: string | null
          currency_code: string
          date_format?: string | null
          is_active?: boolean | null
          name: string
          phone_code?: string | null
          region?: string | null
          tax_system?: Json | null
        }
        Update: {
          code?: string
          created_at?: string | null
          currency_code?: string
          date_format?: string | null
          is_active?: boolean | null
          name?: string
          phone_code?: string | null
          region?: string | null
          tax_system?: Json | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applicable_plans: string[] | null
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: string[] | null
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: string[] | null
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      cro_customer_assignments: {
        Row: {
          assigned_at: string
          contacted_count: number | null
          created_at: string
          cro_user_id: string
          customer_id: string
          id: string
          last_contacted_at: string | null
          notes: string | null
          scheduled_callback_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          contacted_count?: number | null
          created_at?: string
          cro_user_id: string
          customer_id: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          scheduled_callback_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          contacted_count?: number | null
          created_at?: string
          cro_user_id?: string
          customer_id?: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          scheduled_callback_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_customer_assignments_cro_user_id_fkey"
            columns: ["cro_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_customer_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_customer_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cro_round_robin_tracker: {
        Row: {
          id: string
          last_assigned_cro_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_assigned_cro_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_assigned_cro_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cro_round_robin_tracker_last_assigned_cro_id_fkey"
            columns: ["last_assigned_cro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cro_round_robin_tracker_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cst_engagements: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          direction: string
          id: string
          next_action_at: string | null
          next_action_type: string | null
          outcome: string | null
          summary: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id: string
          direction?: string
          id?: string
          next_action_at?: string | null
          next_action_type?: string | null
          outcome?: string | null
          summary?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          direction?: string
          id?: string
          next_action_at?: string | null
          next_action_type?: string | null
          outcome?: string | null
          summary?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cst_engagements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cst_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          is_active: boolean | null
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          is_active?: boolean | null
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          is_active?: boolean | null
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      customer_assignment_history: {
        Row: {
          assigned_from: string
          assigned_to: string | null
          assigned_until: string | null
          created_at: string
          customer_id: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          assigned_from?: string
          assigned_to?: string | null
          assigned_until?: string | null
          created_at?: string
          customer_id: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          assigned_from?: string
          assigned_to?: string | null
          assigned_until?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_assignment_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_assignment_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_assignment_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_outreach: {
        Row: {
          campaign_date: string
          created_at: string | null
          customer_id: string
          email_id: string | null
          email_response_at: string | null
          email_sent_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          sent_by_user_id: string | null
          status: string | null
          updated_at: string | null
          whatsapp_response_at: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          campaign_date?: string
          created_at?: string | null
          customer_id: string
          email_id?: string | null
          email_response_at?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_response_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          campaign_date?: string
          created_at?: string | null
          customer_id?: string
          email_id?: string | null
          email_response_at?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_response_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_outreach_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_outreach_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_outreach_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_url: string | null
          received_by: string | null
          sales_order_id: string | null
          transaction_reference: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_url?: string | null
          received_by?: string | null
          sales_order_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_url?: string | null
          received_by?: string | null
          sales_order_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          alternate_phone: string | null
          assigned_sales_id: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          cst_dnc: boolean
          cst_favourite: boolean
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          industry_tag: string | null
          is_b2b: boolean | null
          is_frozen: boolean | null
          is_priority: boolean | null
          notes: string | null
          office_id: string | null
          outreach_opted_out: boolean | null
          owner_locked: boolean
          payment_days: number | null
          phone: string
          pincode: string | null
          segment: Database["public"]["Enums"]["customer_segment"] | null
          segment_locked: boolean | null
          special_discount_pct: number | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          address?: string | null
          alternate_phone?: string | null
          assigned_sales_id?: string | null
          city?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          cst_dnc?: boolean
          cst_favourite?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          industry_tag?: string | null
          is_b2b?: boolean | null
          is_frozen?: boolean | null
          is_priority?: boolean | null
          notes?: string | null
          office_id?: string | null
          outreach_opted_out?: boolean | null
          owner_locked?: boolean
          payment_days?: number | null
          phone: string
          pincode?: string | null
          segment?: Database["public"]["Enums"]["customer_segment"] | null
          segment_locked?: boolean | null
          special_discount_pct?: number | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          address?: string | null
          alternate_phone?: string | null
          assigned_sales_id?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          cst_dnc?: boolean
          cst_favourite?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          industry_tag?: string | null
          is_b2b?: boolean | null
          is_frozen?: boolean | null
          is_priority?: boolean | null
          notes?: string | null
          office_id?: string | null
          outreach_opted_out?: boolean | null
          owner_locked?: boolean
          payment_days?: number | null
          phone?: string
          pincode?: string | null
          segment?: Database["public"]["Enums"]["customer_segment"] | null
          segment_locked?: boolean | null
          special_discount_pct?: number | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_sales_id_fkey"
            columns: ["assigned_sales_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_documents: {
        Row: {
          created_at: string
          dispatch_id: string
          document_type: Database["public"]["Enums"]["dispatch_document_type"]
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          document_type: Database["public"]["Enums"]["dispatch_document_type"]
          file_name: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          document_type?: Database["public"]["Enums"]["dispatch_document_type"]
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_documents_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_items: {
        Row: {
          created_at: string
          description: string
          dispatch_id: string
          height_cm: number | null
          id: string
          length_cm: number | null
          model_number: string | null
          product_id: string | null
          quantity: number
          sort_order: number | null
          unit_weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          created_at?: string
          description: string
          dispatch_id: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          model_number?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          unit_weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          dispatch_id?: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          model_number?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          unit_weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          courier_name: string | null
          created_at: string
          customer_id: string | null
          dispatch_date: string | null
          dispatch_number: string
          dispatched_by: string | null
          eway_bill_date: string | null
          eway_bill_number: string | null
          eway_bill_status: string | null
          eway_bill_valid_until: string | null
          id: string
          lead_id: string | null
          notes: string | null
          quotation_id: string | null
          sales_order_id: string | null
          shipping_address: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          courier_name?: string | null
          created_at?: string
          customer_id?: string | null
          dispatch_date?: string | null
          dispatch_number: string
          dispatched_by?: string | null
          eway_bill_date?: string | null
          eway_bill_number?: string | null
          eway_bill_status?: string | null
          eway_bill_valid_until?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          quotation_id?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          courier_name?: string | null
          created_at?: string
          customer_id?: string | null
          dispatch_date?: string | null
          dispatch_number?: string
          dispatched_by?: string | null
          eway_bill_date?: string | null
          eway_bill_number?: string | null
          eway_bill_status?: string | null
          eway_bill_valid_until?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          quotation_id?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bcc_emails: string[] | null
          bounced_at: string | null
          cc_emails: string[] | null
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          email_id: string
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          po_id: string | null
          quotation_id: string | null
          recipient_email: string
          reply_to: string | null
          sent_at: string
          sent_by: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          bcc_emails?: string[] | null
          bounced_at?: string | null
          cc_emails?: string[] | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_id: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          po_id?: string | null
          quotation_id?: string | null
          recipient_email: string
          reply_to?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          bcc_emails?: string[] | null
          bounced_at?: string | null
          cc_emails?: string[] | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          po_id?: string | null
          quotation_id?: string | null
          recipient_email?: string
          reply_to?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          subject: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          subject: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll: {
        Row: {
          absence_deduction: number | null
          absent_days: number | null
          attendance_bonus: number | null
          base_salary: number
          created_at: string
          escalation_count: number | null
          escalation_penalty: number | null
          gross_salary: number | null
          id: string
          late_days: number | null
          late_deduction: number | null
          leave_count: number | null
          net_salary: number | null
          payroll_run_id: string
          present_days: number | null
          sales_commission: number | null
          total_deductions: number | null
          total_late_minutes: number | null
          updated_at: string
          user_id: string
          working_days: number | null
        }
        Insert: {
          absence_deduction?: number | null
          absent_days?: number | null
          attendance_bonus?: number | null
          base_salary?: number
          created_at?: string
          escalation_count?: number | null
          escalation_penalty?: number | null
          gross_salary?: number | null
          id?: string
          late_days?: number | null
          late_deduction?: number | null
          leave_count?: number | null
          net_salary?: number | null
          payroll_run_id: string
          present_days?: number | null
          sales_commission?: number | null
          total_deductions?: number | null
          total_late_minutes?: number | null
          updated_at?: string
          user_id: string
          working_days?: number | null
        }
        Update: {
          absence_deduction?: number | null
          absent_days?: number | null
          attendance_bonus?: number | null
          base_salary?: number
          created_at?: string
          escalation_count?: number | null
          escalation_penalty?: number | null
          gross_salary?: number | null
          id?: string
          late_days?: number | null
          late_deduction?: number | null
          leave_count?: number | null
          net_salary?: number | null
          payroll_run_id?: string
          present_days?: number | null
          sales_commission?: number | null
          total_deductions?: number | null
          total_late_minutes?: number | null
          updated_at?: string
          user_id?: string
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salaries: {
        Row: {
          base_salary: number
          created_at: string
          effective_from: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          effective_from?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          effective_from?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_item_attachments: {
        Row: {
          created_at: string
          enquiry_item_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          parsed_data: Json | null
          parsing_error: string | null
          parsing_status: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          enquiry_item_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          parsed_data?: Json | null
          parsing_error?: string | null
          parsing_status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          enquiry_item_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          parsed_data?: Json | null
          parsing_error?: string | null
          parsing_status?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_item_attachments_enquiry_item_id_fkey"
            columns: ["enquiry_item_id"]
            isOneToOne: false
            referencedRelation: "enquiry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_item_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_items: {
        Row: {
          assigned_procurement_user_id: string | null
          brand: string | null
          created_at: string
          id: string
          lead_id: string
          matched_product_id: string | null
          notes: string | null
          price_available: boolean | null
          price_flagged_by: string | null
          price_flagged_to_procurement_at: string | null
          price_resolved_at: string | null
          price_resolved_by: string | null
          price_valid_until: string | null
          pricing_status:
            | Database["public"]["Enums"]["enquiry_pricing_status"]
            | null
          procurement_price: number | null
          product_query_text: string
          quantity: number | null
          quotation_id: string | null
          quotation_status: string
          routed_via: string | null
          sort_order: number | null
          supplier_id: string | null
          target_rate: number | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          assigned_procurement_user_id?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          lead_id: string
          matched_product_id?: string | null
          notes?: string | null
          price_available?: boolean | null
          price_flagged_by?: string | null
          price_flagged_to_procurement_at?: string | null
          price_resolved_at?: string | null
          price_resolved_by?: string | null
          price_valid_until?: string | null
          pricing_status?:
            | Database["public"]["Enums"]["enquiry_pricing_status"]
            | null
          procurement_price?: number | null
          product_query_text: string
          quantity?: number | null
          quotation_id?: string | null
          quotation_status?: string
          routed_via?: string | null
          sort_order?: number | null
          supplier_id?: string | null
          target_rate?: number | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          assigned_procurement_user_id?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          matched_product_id?: string | null
          notes?: string | null
          price_available?: boolean | null
          price_flagged_by?: string | null
          price_flagged_to_procurement_at?: string | null
          price_resolved_at?: string | null
          price_resolved_by?: string | null
          price_valid_until?: string | null
          pricing_status?:
            | Database["public"]["Enums"]["enquiry_pricing_status"]
            | null
          procurement_price?: number | null
          product_query_text?: string
          quantity?: number | null
          quotation_id?: string | null
          quotation_status?: string
          routed_via?: string | null
          sort_order?: number | null
          supplier_id?: string | null
          target_rate?: number | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_items_assigned_procurement_user_id_fkey"
            columns: ["assigned_procurement_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_price_flagged_by_fkey"
            columns: ["price_flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_price_resolved_by_fkey"
            columns: ["price_resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_items_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_logs: {
        Row: {
          created_at: string
          escalated_from: Database["public"]["Enums"]["escalation_level"] | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          id: string
          lead_id: string | null
          reason: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          escalated_from?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          id?: string
          lead_id?: string | null
          reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          escalated_from?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          id?: string
          lead_id?: string | null
          reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_actions_log: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          notes: string | null
          performed_by: string
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          performed_by: string
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          performed_by?: string
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          bill_number: string | null
          category: string | null
          cgst_amount: number
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          hsn_code: string | null
          id: string
          igst_amount: number
          is_paid: boolean
          notes: string | null
          paid_from_account_id: string | null
          payment_mode: string
          sgst_amount: number
          supplier_id: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
          vendor_gstin: string | null
          vendor_name: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          bill_number?: string | null
          category?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          is_paid?: boolean
          notes?: string | null
          paid_from_account_id?: string | null
          payment_mode?: string
          sgst_amount?: number
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number
          updated_at?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          bill_number?: string | null
          category?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          is_paid?: boolean
          notes?: string | null
          paid_from_account_id?: string | null
          payment_mode?: string
          sgst_amount?: number
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          asset_category: string | null
          bill_number: string | null
          created_at: string
          created_by: string | null
          depreciation_rate: number
          disposal_value: number | null
          disposed_on: string | null
          gst_amount: number
          id: string
          name: string
          notes: string | null
          paid_from_account_id: string | null
          purchase_date: string
          purchase_value: number
          supplier_id: string | null
          tenant_id: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          asset_category?: string | null
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          depreciation_rate?: number
          disposal_value?: number | null
          disposed_on?: string | null
          gst_amount?: number
          id?: string
          name: string
          notes?: string | null
          paid_from_account_id?: string | null
          purchase_date?: string
          purchase_value?: number
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          asset_category?: string | null
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          depreciation_rate?: number
          disposal_value?: number | null
          disposed_on?: string | null
          gst_amount?: number
          id?: string
          name?: string
          notes?: string | null
          paid_from_account_id?: string | null
          purchase_date?: string
          purchase_value?: number
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          created_at: string | null
          fetched_at: string | null
          from_currency: string
          id: string
          is_locked: boolean | null
          rate: number
          rate_date: string
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string | null
          fetched_at?: string | null
          from_currency: string
          id?: string
          is_locked?: boolean | null
          rate: number
          rate_date: string
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string | null
          fetched_at?: string | null
          from_currency?: string
          id?: string
          is_locked?: boolean | null
          rate?: number
          rate_date?: string
          source?: string | null
          to_currency?: string
        }
        Relationships: []
      }
      goods_receipt_notes: {
        Row: {
          created_at: string
          grn_number: string
          id: string
          notes: string | null
          po_id: string
          qc_at: string | null
          qc_by: string | null
          qc_notes: string | null
          qc_status: string | null
          received_by: string | null
          received_date: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grn_number: string
          id?: string
          notes?: string | null
          po_id: string
          qc_at?: string | null
          qc_by?: string | null
          qc_notes?: string | null
          qc_status?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grn_number?: string
          id?: string
          notes?: string | null
          po_id?: string
          qc_at?: string | null
          qc_by?: string | null
          qc_notes?: string | null
          qc_status?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_qc_by_fkey"
            columns: ["qc_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          accepted_quantity: number
          batch_number: string | null
          created_at: string
          grn_id: string
          id: string
          notes: string | null
          ordered_quantity: number
          po_item_id: string
          product_id: string | null
          received_quantity: number
          rejected_quantity: number
          rejection_reason: string | null
        }
        Insert: {
          accepted_quantity?: number
          batch_number?: string | null
          created_at?: string
          grn_id: string
          id?: string
          notes?: string | null
          ordered_quantity?: number
          po_item_id: string
          product_id?: string | null
          received_quantity?: number
          rejected_quantity?: number
          rejection_reason?: string | null
        }
        Update: {
          accepted_quantity?: number
          batch_number?: string | null
          created_at?: string
          grn_id?: string
          id?: string
          notes?: string | null
          ordered_quantity?: number
          po_item_id?: string
          product_id?: string | null
          received_quantity?: number
          rejected_quantity?: number
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_api_settings: {
        Row: {
          api_password: string | null
          api_username: string | null
          auto_generate_einvoice: boolean | null
          auto_generate_eway_bill: boolean | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          gsp_provider: string
          gstin: string
          id: string
          irp_base_url: string | null
          provider_mode: string | null
          sandbox_mode: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_password?: string | null
          api_username?: string | null
          auto_generate_einvoice?: boolean | null
          auto_generate_eway_bill?: boolean | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          gsp_provider?: string
          gstin: string
          id?: string
          irp_base_url?: string | null
          provider_mode?: string | null
          sandbox_mode?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_password?: string | null
          api_username?: string | null
          auto_generate_einvoice?: boolean | null
          auto_generate_eway_bill?: boolean | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          gsp_provider?: string
          gstin?: string
          id?: string
          irp_base_url?: string | null
          provider_mode?: string | null
          sandbox_mode?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gst_api_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          half_day_type: string | null
          holiday_type: Database["public"]["Enums"]["holiday_type"]
          id: string
          is_half_day: boolean | null
          is_recurring: boolean | null
          name: string
          office_id: string | null
          tenant_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          half_day_type?: string | null
          holiday_type?: Database["public"]["Enums"]["holiday_type"]
          id?: string
          is_half_day?: boolean | null
          is_recurring?: boolean | null
          name: string
          office_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          half_day_type?: string | null
          holiday_type?: Database["public"]["Enums"]["holiday_type"]
          id?: string
          is_half_day?: boolean | null
          is_recurring?: boolean | null
          name?: string
          office_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          import_invoice_id: string
          product_id: string | null
          quantity: number
          sort_order: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          import_invoice_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          import_invoice_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_invoice_items_import_invoice_id_fkey"
            columns: ["import_invoice_id"]
            isOneToOne: false
            referencedRelation: "import_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_invoices: {
        Row: {
          amount_paid: number
          awb_bl_number: string | null
          bill_of_entry_number: string | null
          created_at: string
          created_by: string | null
          currency: string
          customs_duty: number
          due_date: string | null
          exchange_rate: number
          grand_total: number
          grand_total_inr: number
          id: string
          igst_amount: number
          insurance: number
          internal_ref: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          other_charges: number
          po_id: string | null
          shipping_charges: number
          status: string
          subtotal: number
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          awb_bl_number?: string | null
          bill_of_entry_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_duty?: number
          due_date?: string | null
          exchange_rate?: number
          grand_total?: number
          grand_total_inr?: number
          id?: string
          igst_amount?: number
          insurance?: number
          internal_ref: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          other_charges?: number
          po_id?: string | null
          shipping_charges?: number
          status?: string
          subtotal?: number
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          awb_bl_number?: string | null
          bill_of_entry_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_duty?: number
          due_date?: string | null
          exchange_rate?: number
          grand_total?: number
          grand_total_inr?: number
          id?: string
          igst_amount?: number
          insurance?: number
          internal_ref?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          other_charges?: number
          po_id?: string | null
          shipping_charges?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          code: string
          created_at: string | null
          custom_fields: Json | null
          id: string
          is_active: boolean | null
          kpi_config: Json | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          is_active?: boolean | null
          kpi_config?: Json | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          is_active?: boolean | null
          kpi_config?: Json | null
          name?: string
        }
        Relationships: []
      }
      integration_accounts: {
        Row: {
          account_name: string
          account_type: string
          api_key: string
          config: Json | null
          created_at: string | null
          id: string
          integration_setting_id: string | null
          is_enabled: boolean | null
          last_sync_at: string | null
          profile_id: string | null
          tenant_id: string | null
          updated_at: string | null
          userid: string | null
        }
        Insert: {
          account_name: string
          account_type?: string
          api_key: string
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_setting_id?: string | null
          is_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          userid?: string | null
        }
        Update: {
          account_name?: string
          account_type?: string
          api_key?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_setting_id?: string | null
          is_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          userid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_integration_setting_id_fkey"
            columns: ["integration_setting_id"]
            isOneToOne: false
            referencedRelation: "integration_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          leads_synced: number | null
          metadata: Json | null
          status: Database["public"]["Enums"]["integration_sync_status"]
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          leads_synced?: number | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["integration_sync_status"]
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          leads_synced?: number | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["integration_sync_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          api_key: string | null
          api_secret: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_enabled: boolean
          last_sync_at: string | null
          sync_interval_minutes: number | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_enabled?: boolean
          last_sync_at?: string | null
          sync_interval_minutes?: number | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          is_enabled?: boolean
          last_sync_at?: string | null
          sync_interval_minutes?: number | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string
          held_quantity: number
          id: string
          last_restocked_at: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          office_id: string
          product_id: string
          quantity: number
          reorder_quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          held_quantity?: number
          id?: string
          last_restocked_at?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          office_id: string
          product_id: string
          quantity?: number
          reorder_quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          held_quantity?: number
          id?: string
          last_restocked_at?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          office_id?: string
          product_id?: string
          quantity?: number
          reorder_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          discount_amount: number | null
          discount_percent: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rate: number
          sort_order: number | null
          tax_amount: number | null
          tax_percent: number | null
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          discount_amount?: number | null
          discount_percent?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rate?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          discount_amount?: number | null
          discount_percent?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ack_number: string | null
          amount_paid: number | null
          cgst_amount: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          dispatch_id: string | null
          due_date: string | null
          einvoice_status: string | null
          grand_total: number
          id: string
          igst_amount: number | null
          invoice_date: string
          invoice_number: string
          irn: string | null
          irn_date: string | null
          is_igst: boolean | null
          notes: string | null
          office_id: string | null
          place_of_supply: string | null
          qr_code_data: string | null
          quotation_id: string | null
          sales_order_id: string | null
          sent_at: string | null
          sent_by: string | null
          sgst_amount: number | null
          status: string
          subtotal: number | null
          terms_conditions: string | null
          total_discount: number | null
          total_tax: number | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          ack_number?: string | null
          amount_paid?: number | null
          cgst_amount?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          dispatch_id?: string | null
          due_date?: string | null
          einvoice_status?: string | null
          grand_total?: number
          id?: string
          igst_amount?: number | null
          invoice_date?: string
          invoice_number: string
          irn?: string | null
          irn_date?: string | null
          is_igst?: boolean | null
          notes?: string | null
          office_id?: string | null
          place_of_supply?: string | null
          qr_code_data?: string | null
          quotation_id?: string | null
          sales_order_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          ack_number?: string | null
          amount_paid?: number | null
          cgst_amount?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dispatch_id?: string | null
          due_date?: string | null
          einvoice_status?: string | null
          grand_total?: number
          id?: string
          igst_amount?: number | null
          invoice_date?: string
          invoice_number?: string
          irn?: string | null
          irn_date?: string | null
          is_igst?: boolean | null
          notes?: string | null
          office_id?: string | null
          place_of_supply?: string | null
          qr_code_data?: string | null
          quotation_id?: string | null
          sales_order_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string | null
          direction: string | null
          id: string
          is_active: boolean | null
          name: string
          native_name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          direction?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          native_name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          direction?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          native_name?: string
        }
        Relationships: []
      }
      lead_assignment_history: {
        Row: {
          assigned_from: string | null
          assigned_to: string | null
          assignment_source: string | null
          changed_by: string | null
          created_at: string
          id: string
          lead_id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_rules: {
        Row: {
          assigned_office_id: string | null
          assigned_user_id: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_name: string
          state: string | null
          tenant_id: string | null
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          assigned_office_id?: string | null
          assigned_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name: string
          state?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          assigned_office_id?: string | null
          assigned_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name?: string
          state?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_rules_assigned_office_id_fkey"
            columns: ["assigned_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualification: {
        Row: {
          application: string | null
          created_at: string
          decision_reason: string | null
          estimated_quantity: number | null
          estimated_timeline: string | null
          id: string
          is_active: boolean
          lead_id: string
          notes: string | null
          qualification_type: Database["public"]["Enums"]["lead_qualification_type"]
          qualified_at: string
          qualified_by: string
          routed_to: Database["public"]["Enums"]["lead_routing_target"]
          tenant_id: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          application?: string | null
          created_at?: string
          decision_reason?: string | null
          estimated_quantity?: number | null
          estimated_timeline?: string | null
          id?: string
          is_active?: boolean
          lead_id: string
          notes?: string | null
          qualification_type: Database["public"]["Enums"]["lead_qualification_type"]
          qualified_at?: string
          qualified_by: string
          routed_to: Database["public"]["Enums"]["lead_routing_target"]
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          application?: string | null
          created_at?: string
          decision_reason?: string | null
          estimated_quantity?: number | null
          estimated_timeline?: string | null
          id?: string
          is_active?: boolean
          lead_id?: string
          notes?: string | null
          qualification_type?: Database["public"]["Enums"]["lead_qualification_type"]
          qualified_at?: string
          qualified_by?: string
          routed_to?: Database["public"]["Enums"]["lead_routing_target"]
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualification_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_qualification_qualified_by_fkey"
            columns: ["qualified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_qualification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_qualification_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_counters: {
        Row: {
          assigned_count: number
          office_id: string
          rule_id: string
        }
        Insert: {
          assigned_count?: number
          office_id: string
          rule_id: string
        }
        Update: {
          assigned_count?: number
          office_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_counters_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "lead_routing_splits"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_splits: {
        Row: {
          applies_to: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          rule_name: string
          source_filter: string[] | null
          splits: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_name: string
          source_filter?: string[] | null
          splits: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_name?: string
          source_filter?: string[] | null
          splits?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_id: string | null
          customer_query: string | null
          deleted_at: string | null
          deleted_by: string | null
          enquiry_status: Database["public"]["Enums"]["enquiry_status"] | null
          escalated_at: string | null
          escalation_level:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          estimated_value: number | null
          expected_close_date: string | null
          first_response_at: string | null
          first_response_minutes: number | null
          has_enquiry: boolean | null
          id: string
          last_activity_at: string | null
          lost_at: string | null
          lost_reason: string | null
          lost_reason_notes: string | null
          office_id: string | null
          price_matched_at: string | null
          quoted_at: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_reference: string | null
          status: Database["public"]["Enums"]["lead_status"]
          suggested_assignee_id: string | null
          tenant_id: string | null
          title: string
          unquoted_at: string | null
          unquoted_note: string | null
          unquoted_reason: string | null
          updated_at: string
          vertical_id: string | null
          won_at: string | null
          won_reason: string | null
          won_reason_notes: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_query?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enquiry_status?: Database["public"]["Enums"]["enquiry_status"] | null
          escalated_at?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          estimated_value?: number | null
          expected_close_date?: string | null
          first_response_at?: string | null
          first_response_minutes?: number | null
          has_enquiry?: boolean | null
          id?: string
          last_activity_at?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_notes?: string | null
          office_id?: string | null
          price_matched_at?: string | null
          quoted_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          suggested_assignee_id?: string | null
          tenant_id?: string | null
          title: string
          unquoted_at?: string | null
          unquoted_note?: string | null
          unquoted_reason?: string | null
          updated_at?: string
          vertical_id?: string | null
          won_at?: string | null
          won_reason?: string | null
          won_reason_notes?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_query?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enquiry_status?: Database["public"]["Enums"]["enquiry_status"] | null
          escalated_at?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          estimated_value?: number | null
          expected_close_date?: string | null
          first_response_at?: string | null
          first_response_minutes?: number | null
          has_enquiry?: boolean | null
          id?: string
          last_activity_at?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_notes?: string | null
          office_id?: string | null
          price_matched_at?: string | null
          quoted_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          suggested_assignee_id?: string | null
          tenant_id?: string | null
          title?: string
          unquoted_at?: string | null
          unquoted_note?: string | null
          unquoted_reason?: string | null
          updated_at?: string
          vertical_id?: string | null
          won_at?: string | null
          won_reason?: string | null
          won_reason_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_suggested_assignee_id_fkey"
            columns: ["suggested_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          entry_date: string
          id: string
          narration: string | null
          party_id: string | null
          party_type: string | null
          source_id: string | null
          source_ref: string | null
          source_type: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          narration?: string | null
          party_id?: string | null
          party_type?: string | null
          source_id?: string | null
          source_ref?: string | null
          source_type?: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          narration?: string | null
          party_id?: string | null
          party_type?: string | null
          source_id?: string | null
          source_ref?: string | null
          source_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      list_price_uploads: {
        Row: {
          brand: string
          created_at: string
          default_discount_pct: number
          filename: string | null
          id: string
          notes: string | null
          rows_inserted: number
          rows_parsed: number
          rows_skipped: number
          rows_updated: number
          source_label: string
          status: string
          storage_path: string | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          default_discount_pct?: number
          filename?: string | null
          id?: string
          notes?: string | null
          rows_inserted?: number
          rows_parsed?: number
          rows_skipped?: number
          rows_updated?: number
          source_label: string
          status?: string
          storage_path?: string | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          default_discount_pct?: number
          filename?: string | null
          id?: string
          notes?: string | null
          rows_inserted?: number
          rows_parsed?: number
          rows_skipped?: number
          rows_updated?: number
          source_label?: string
          status?: string
          storage_path?: string | null
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_price_uploads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_price_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lqt_round_robin_tracker: {
        Row: {
          last_assigned_lqt_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_assigned_lqt_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_assigned_lqt_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lqt_round_robin_tracker_last_assigned_lqt_id_fkey"
            columns: ["last_assigned_lqt_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqt_round_robin_tracker_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          click_count: number
          content: string | null
          created_at: string
          id: string
          name: string
          open_count: number
          scheduled_at: string | null
          sent_count: number
          status: string
          subject: string | null
          target_segment: string | null
          type: string
        }
        Insert: {
          click_count?: number
          content?: string | null
          created_at?: string
          id?: string
          name: string
          open_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          target_segment?: string | null
          type?: string
        }
        Update: {
          click_count?: number
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          open_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          target_segment?: string | null
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          metadata: Json | null
          title: string
          type: string | null
          user_id: string
          vertical_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title: string
          type?: string | null
          user_id: string
          vertical_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string | null
          user_id?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          closing_time: string | null
          created_at: string
          geofence_radius_meters: number | null
          id: string
          latitude: number | null
          location: Database["public"]["Enums"]["office_location"]
          longitude: number | null
          name: string
          opening_time: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          closing_time?: string | null
          created_at?: string
          geofence_radius_meters?: number | null
          id?: string
          latitude?: number | null
          location: Database["public"]["Enums"]["office_location"]
          longitude?: number | null
          name: string
          opening_time?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          closing_time?: string | null
          created_at?: string
          geofence_radius_meters?: number | null
          id?: string
          latitude?: number | null
          location?: Database["public"]["Enums"]["office_location"]
          longitude?: number | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["order_document_type"]
          file_name: string
          file_url: string
          id: string
          notes: string | null
          sales_order_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["order_document_type"]
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          sales_order_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["order_document_type"]
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          sales_order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          tenant_id: string | null
          updated_at: string | null
          whatsapp_template_name: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_template_name?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          month: number
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          total_deductions: number | null
          total_employees: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          month: number
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          total_deductions?: number | null
          total_employees?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          month?: number
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          total_deductions?: number | null
          total_employees?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_slabs: {
        Row: {
          created_at: string
          deduction_type: string
          deduction_value: number
          id: string
          max_late_minutes: number
          min_late_minutes: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduction_type?: string
          deduction_value?: number
          id?: string
          max_late_minutes: number
          min_late_minutes?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduction_type?: string
          deduction_value?: number
          id?: string
          max_late_minutes?: number
          min_late_minutes?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_slabs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_benchmarks: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          direction: string
          id: string
          is_active: boolean
          metric: string
          notes: string | null
          office_id: string | null
          target_value: number
          tenant_id: string | null
          updated_at: string
          warn_tolerance: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          direction?: string
          id?: string
          is_active?: boolean
          metric: string
          notes?: string | null
          office_id?: string | null
          target_value: number
          tenant_id?: string | null
          updated_at?: string
          warn_tolerance?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          direction?: string
          id?: string
          is_active?: boolean
          metric?: string
          notes?: string | null
          office_id?: string | null
          target_value?: number
          tenant_id?: string | null
          updated_at?: string
          warn_tolerance?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_benchmarks_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_analytics_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      price_request_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          fx_rate: number | null
          id: string
          is_pushed: boolean
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          price_request_id: string
          purchase_price: number
          pushed_at: string | null
          pushed_by: string | null
          round: number
          sale_price: number | null
          supplier_id: string | null
          supplier_name: string | null
          tenant_id: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          fx_rate?: number | null
          id?: string
          is_pushed?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          price_request_id: string
          purchase_price: number
          pushed_at?: string | null
          pushed_by?: string | null
          round?: number
          sale_price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          fx_rate?: number | null
          id?: string
          is_pushed?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          price_request_id?: string
          purchase_price?: number
          pushed_at?: string | null
          pushed_by?: string | null
          round?: number
          sale_price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_request_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_quotes_price_request_id_fkey"
            columns: ["price_request_id"]
            isOneToOne: false
            referencedRelation: "price_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_quotes_pushed_by_fkey"
            columns: ["pushed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_request_rounds: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          outcome: string
          price_request_id: string
          requested_at: string
          requested_by: string | null
          responded_at: string | null
          responder_id: string | null
          revised_price: number | null
          round: number
          sales_decision: string | null
          sales_decision_at: string | null
          sales_decision_by: string | null
          sales_decision_notes: string | null
          target_price: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string
          price_request_id: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responder_id?: string | null
          revised_price?: number | null
          round?: number
          sales_decision?: string | null
          sales_decision_at?: string | null
          sales_decision_by?: string | null
          sales_decision_notes?: string | null
          target_price?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string
          price_request_id?: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responder_id?: string | null
          revised_price?: number | null
          round?: number
          sales_decision?: string | null
          sales_decision_at?: string | null
          sales_decision_by?: string | null
          sales_decision_notes?: string | null
          target_price?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_request_rounds_price_request_id_fkey"
            columns: ["price_request_id"]
            isOneToOne: false
            referencedRelation: "price_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_rounds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_rounds_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_requests: {
        Row: {
          assigned_to: string | null
          created_at: string
          current_round: number
          enquiry_item_id: string | null
          id: string
          last_priced_by: string | null
          lead_id: string
          lead_time_days: number | null
          notes: string | null
          price_valid_until: string | null
          priority: string | null
          purchase_price: number | null
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          resolved_price: number | null
          sales_outcome: string | null
          sales_outcome_at: string | null
          sales_outcome_by: string | null
          sales_outcome_notes: string | null
          seller_name: string | null
          selling_price: number | null
          status: Database["public"]["Enums"]["price_request_status"] | null
          supplier_id: string | null
          target_matched_at: string | null
          target_rate: number | null
          tat_deadline: string | null
          tat_status:
            | Database["public"]["Enums"]["price_request_tat_status"]
            | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          current_round?: number
          enquiry_item_id?: string | null
          id?: string
          last_priced_by?: string | null
          lead_id: string
          lead_time_days?: number | null
          notes?: string | null
          price_valid_until?: string | null
          priority?: string | null
          purchase_price?: number | null
          requested_at?: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_price?: number | null
          sales_outcome?: string | null
          sales_outcome_at?: string | null
          sales_outcome_by?: string | null
          sales_outcome_notes?: string | null
          seller_name?: string | null
          selling_price?: number | null
          status?: Database["public"]["Enums"]["price_request_status"] | null
          supplier_id?: string | null
          target_matched_at?: string | null
          target_rate?: number | null
          tat_deadline?: string | null
          tat_status?:
            | Database["public"]["Enums"]["price_request_tat_status"]
            | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          current_round?: number
          enquiry_item_id?: string | null
          id?: string
          last_priced_by?: string | null
          lead_id?: string
          lead_time_days?: number | null
          notes?: string | null
          price_valid_until?: string | null
          priority?: string | null
          purchase_price?: number | null
          requested_at?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_price?: number | null
          sales_outcome?: string | null
          sales_outcome_at?: string | null
          sales_outcome_by?: string | null
          sales_outcome_notes?: string | null
          seller_name?: string | null
          selling_price?: number | null
          status?: Database["public"]["Enums"]["price_request_status"] | null
          supplier_id?: string | null
          target_matched_at?: string | null
          target_rate?: number | null
          tat_deadline?: string | null
          tat_status?:
            | Database["public"]["Enums"]["price_request_tat_status"]
            | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_enquiry_item_id_fkey"
            columns: ["enquiry_item_id"]
            isOneToOne: false
            referencedRelation: "enquiry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_last_priced_by_fkey"
            columns: ["last_priced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_submission_batches: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          notes: string | null
          raw_paste: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_currency: string
          status: string
          submitted_at: string
          submitted_by: string
          supplier_id: string | null
          supplier_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          notes?: string | null
          raw_paste?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_currency?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          notes?: string | null
          raw_paste?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_currency?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_submission_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_submission_items: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          batch_id: string
          cc_pct: number | null
          cny_unit_price: number
          computed_inr_per_unit: number | null
          computed_inr_total: number | null
          computed_usd_landed: number | null
          created_at: string
          duty_amount: number | null
          duty_pct: number
          expense_amount: number | null
          expense_pct: number
          final_inr_total: number | null
          final_inr_unit: number | null
          freight_flat: number | null
          freight_mode: string
          freight_per_kg: number | null
          freight_total: number | null
          freight_usd_per_kg: number | null
          fx_rate: number | null
          hsn_code: string | null
          id: string
          inr_base: number | null
          insurance_pct: number | null
          item_name: string
          landed_inr: number | null
          line_no: number
          margin_pct: number
          matched_product_id: string | null
          model_number: string | null
          negotiation_pct: number
          product_id: string | null
          qty: number
          raw_text: string | null
          rejection_reason: string | null
          rmb_price: number | null
          rmb_usd_rate: number | null
          source_currency: string
          tenant_id: string
          unit_weight_kg: number | null
          updated_at: string
          usd_inr_rate: number | null
          weight_kg: number | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          batch_id: string
          cc_pct?: number | null
          cny_unit_price?: number
          computed_inr_per_unit?: number | null
          computed_inr_total?: number | null
          computed_usd_landed?: number | null
          created_at?: string
          duty_amount?: number | null
          duty_pct?: number
          expense_amount?: number | null
          expense_pct?: number
          final_inr_total?: number | null
          final_inr_unit?: number | null
          freight_flat?: number | null
          freight_mode?: string
          freight_per_kg?: number | null
          freight_total?: number | null
          freight_usd_per_kg?: number | null
          fx_rate?: number | null
          hsn_code?: string | null
          id?: string
          inr_base?: number | null
          insurance_pct?: number | null
          item_name: string
          landed_inr?: number | null
          line_no?: number
          margin_pct?: number
          matched_product_id?: string | null
          model_number?: string | null
          negotiation_pct?: number
          product_id?: string | null
          qty?: number
          raw_text?: string | null
          rejection_reason?: string | null
          rmb_price?: number | null
          rmb_usd_rate?: number | null
          source_currency?: string
          tenant_id: string
          unit_weight_kg?: number | null
          updated_at?: string
          usd_inr_rate?: number | null
          weight_kg?: number | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string
          cc_pct?: number | null
          cny_unit_price?: number
          computed_inr_per_unit?: number | null
          computed_inr_total?: number | null
          computed_usd_landed?: number | null
          created_at?: string
          duty_amount?: number | null
          duty_pct?: number
          expense_amount?: number | null
          expense_pct?: number
          final_inr_total?: number | null
          final_inr_unit?: number | null
          freight_flat?: number | null
          freight_mode?: string
          freight_per_kg?: number | null
          freight_total?: number | null
          freight_usd_per_kg?: number | null
          fx_rate?: number | null
          hsn_code?: string | null
          id?: string
          inr_base?: number | null
          insurance_pct?: number | null
          item_name?: string
          landed_inr?: number | null
          line_no?: number
          margin_pct?: number
          matched_product_id?: string | null
          model_number?: string | null
          negotiation_pct?: number
          product_id?: string | null
          qty?: number
          raw_text?: string | null
          rejection_reason?: string | null
          rmb_price?: number | null
          rmb_usd_rate?: number | null
          source_currency?: string
          tenant_id?: string
          unit_weight_kg?: number | null
          updated_at?: string
          usd_inr_rate?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_submission_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "price_submission_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_alert_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_alert_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          metric_value: number | null
          product_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          threshold_value: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          metric_value?: number | null
          product_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold_value?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          metric_value?: number | null
          product_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold_value?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_assignment_state: {
        Row: {
          last_assigned_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_assigned_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_assigned_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_assignment_state_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_assignment_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_round_robin_tracker: {
        Row: {
          last_assigned_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_assigned_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_assigned_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_round_robin_tracker_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_round_robin_tracker_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric: Database["public"]["Enums"]["procurement_metric"]
          month: number | null
          quarter: number | null
          target_type: Database["public"]["Enums"]["target_period_type"]
          target_value: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric: Database["public"]["Enums"]["procurement_metric"]
          month?: number | null
          quarter?: number | null
          target_type?: Database["public"]["Enums"]["target_period_type"]
          target_value: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: Database["public"]["Enums"]["procurement_metric"]
          month?: number | null
          quarter?: number | null
          target_type?: Database["public"]["Enums"]["target_period_type"]
          target_value?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          note: string | null
          priority: string
          product_id: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rework_note: string | null
          status: string
          submitted_at: string | null
          task_type: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          priority?: string
          product_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          task_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          priority?: string
          product_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          task_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          error_rows: Json
          filename: string | null
          id: string
          import_type: string
          rows_errored: number
          rows_new: number
          rows_parsed: number
          rows_processed: number
          rows_unchanged: number
          rows_updated: number
          status: string
          storage_path: string | null
          tenant_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          error_rows?: Json
          filename?: string | null
          id?: string
          import_type?: string
          rows_errored?: number
          rows_new?: number
          rows_parsed?: number
          rows_processed?: number
          rows_unchanged?: number
          rows_updated?: number
          status?: string
          storage_path?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          error_rows?: Json
          filename?: string | null
          id?: string
          import_type?: string
          rows_errored?: number
          rows_new?: number
          rows_parsed?: number
          rows_processed?: number
          rows_unchanged?: number
          rows_updated?: number
          status?: string
          storage_path?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      product_merge_log: {
        Row: {
          id: string
          kept_id: string
          merged_at: string
          merged_by: string | null
          old_id: string
          old_row: Json
          tenant_id: string | null
        }
        Insert: {
          id?: string
          kept_id: string
          merged_at?: string
          merged_by?: string | null
          old_id: string
          old_row: Json
          tenant_id?: string | null
        }
        Update: {
          id?: string
          kept_id?: string
          merged_at?: string
          merged_by?: string | null
          old_id?: string
          old_row?: Json
          tenant_id?: string | null
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_rate: number
          old_rate: number | null
          product_id: string
          reference_id: string | null
          source: string | null
          supplier_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_rate: number
          old_rate?: number | null
          product_id: string
          reference_id?: string | null
          source?: string | null
          supplier_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_rate?: number
          old_rate?: number | null
          product_id?: string
          reference_id?: string | null
          source?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          import_run_id: string | null
          new_list_price: number | null
          new_purchase_discount_pct: number | null
          new_purchase_price: number | null
          new_sales_discount_pct: number | null
          new_sales_price: number | null
          old_list_price: number | null
          old_purchase_discount_pct: number | null
          old_purchase_price: number | null
          old_sales_discount_pct: number | null
          old_sales_price: number | null
          product_id: string
          source_label: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          import_run_id?: string | null
          new_list_price?: number | null
          new_purchase_discount_pct?: number | null
          new_purchase_price?: number | null
          new_sales_discount_pct?: number | null
          new_sales_price?: number | null
          old_list_price?: number | null
          old_purchase_discount_pct?: number | null
          old_purchase_price?: number | null
          old_sales_discount_pct?: number | null
          old_sales_price?: number | null
          product_id: string
          source_label?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          import_run_id?: string | null
          new_list_price?: number | null
          new_purchase_discount_pct?: number | null
          new_purchase_price?: number | null
          new_sales_discount_pct?: number | null
          new_sales_price?: number | null
          old_list_price?: number | null
          old_purchase_discount_pct?: number | null
          old_purchase_price?: number | null
          old_sales_discount_pct?: number | null
          old_sales_price?: number | null
          product_id?: string
          source_label?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          brand_key: string | null
          brand_match_key: string | null
          category: string | null
          created_at: string
          created_by: string | null
          default_rate: number | null
          description: string | null
          gross_margin_pct: number | null
          gross_profit: number | null
          height_cm: number | null
          hsn_code: string | null
          id: string
          is_active: boolean | null
          is_frozen: boolean | null
          last_quote_supplier_id: string | null
          lead_time_days: number | null
          length_cm: number | null
          list_price: number | null
          list_price_source: string | null
          list_price_updated_at: string | null
          match_key: string | null
          min_margin_pct: number
          model_key: string | null
          model_number: string | null
          name: string
          normalized_model: string | null
          preferred_supplier_id: string | null
          price_source: string | null
          price_updated_at: string | null
          price_updated_by: string | null
          price_valid_until: string | null
          product_status: Database["public"]["Enums"]["product_status"]
          purchase_discount_pct: number | null
          purchase_price: number | null
          replacement_model_no: string | null
          sales_discount_pct: number | null
          sales_price: number | null
          search_key: string | null
          supplier_dependency_pct: number | null
          tax_rate: number | null
          tenant_id: string | null
          unit: string | null
          updated_at: string
          updated_by: string | null
          vertical_id: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          brand?: string | null
          brand_key?: string | null
          brand_match_key?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_rate?: number | null
          description?: string | null
          gross_margin_pct?: number | null
          gross_profit?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
          last_quote_supplier_id?: string | null
          lead_time_days?: number | null
          length_cm?: number | null
          list_price?: number | null
          list_price_source?: string | null
          list_price_updated_at?: string | null
          match_key?: string | null
          min_margin_pct?: number
          model_key?: string | null
          model_number?: string | null
          name: string
          normalized_model?: string | null
          preferred_supplier_id?: string | null
          price_source?: string | null
          price_updated_at?: string | null
          price_updated_by?: string | null
          price_valid_until?: string | null
          product_status?: Database["public"]["Enums"]["product_status"]
          purchase_discount_pct?: number | null
          purchase_price?: number | null
          replacement_model_no?: string | null
          sales_discount_pct?: number | null
          sales_price?: number | null
          search_key?: string | null
          supplier_dependency_pct?: number | null
          tax_rate?: number | null
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          vertical_id?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          brand?: string | null
          brand_key?: string | null
          brand_match_key?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_rate?: number | null
          description?: string | null
          gross_margin_pct?: number | null
          gross_profit?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
          last_quote_supplier_id?: string | null
          lead_time_days?: number | null
          length_cm?: number | null
          list_price?: number | null
          list_price_source?: string | null
          list_price_updated_at?: string | null
          match_key?: string | null
          min_margin_pct?: number
          model_key?: string | null
          model_number?: string | null
          name?: string
          normalized_model?: string | null
          preferred_supplier_id?: string | null
          price_source?: string | null
          price_updated_at?: string | null
          price_updated_by?: string | null
          price_valid_until?: string | null
          product_status?: Database["public"]["Enums"]["product_status"]
          purchase_discount_pct?: number | null
          purchase_price?: number | null
          replacement_model_no?: string | null
          sales_discount_pct?: number | null
          sales_price?: number | null
          search_key?: string | null
          supplier_dependency_pct?: number | null
          tax_rate?: number | null
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          vertical_id?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_price_updated_by_fkey"
            columns: ["price_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_view_price_comparison: boolean
          created_at: string
          email: string
          employment_status: string
          exit_date: string | null
          exit_reason: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_procurement_approver: boolean
          is_protected_owner: boolean
          lead_assignment_opt_out: boolean | null
          manager_id: string | null
          office_id: string | null
          phone: string | null
          preferred_currency: string | null
          preferred_language: string | null
          round_robin_paused: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_view_price_comparison?: boolean
          created_at?: string
          email: string
          employment_status?: string
          exit_date?: string | null
          exit_reason?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_procurement_approver?: boolean
          is_protected_owner?: boolean
          lead_assignment_opt_out?: boolean | null
          manager_id?: string | null
          office_id?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          round_robin_paused?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_view_price_comparison?: boolean
          created_at?: string
          email?: string
          employment_status?: string
          exit_date?: string | null
          exit_reason?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_procurement_approver?: boolean
          is_protected_owner?: boolean
          lead_assignment_opt_out?: boolean | null
          manager_id?: string | null
          office_id?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          round_robin_paused?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_bill_items: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          description: string
          hsn_code: string | null
          id: string
          product_id: string | null
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          tax_percent: number
          unit: string | null
        }
        Insert: {
          amount?: number
          bill_id: string
          created_at?: string
          description?: string
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_percent?: number
          unit?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          description?: string
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_percent?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_bills: {
        Row: {
          amount_paid: number
          attachment_url: string | null
          bill_date: string
          bill_number: string
          cgst_amount: number
          created_at: string
          created_by: string | null
          due_date: string | null
          grand_total: number
          id: string
          igst_amount: number
          is_igst: boolean
          is_reverse_charge: boolean
          itc_eligible: boolean
          notes: string | null
          other_charges: number
          place_of_supply: string | null
          po_id: string | null
          sgst_amount: number
          status: string
          subtotal: number
          supplier_gstin: string | null
          supplier_id: string | null
          supplier_name: string | null
          tenant_id: string
          total_tax: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          attachment_url?: string | null
          bill_date?: string
          bill_number: string
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          grand_total?: number
          id?: string
          igst_amount?: number
          is_igst?: boolean
          is_reverse_charge?: boolean
          itc_eligible?: boolean
          notes?: string | null
          other_charges?: number
          place_of_supply?: string | null
          po_id?: string | null
          sgst_amount?: number
          status?: string
          subtotal?: number
          supplier_gstin?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id: string
          total_tax?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          attachment_url?: string | null
          bill_date?: string
          bill_number?: string
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          grand_total?: number
          id?: string
          igst_amount?: number
          is_igst?: boolean
          is_reverse_charge?: boolean
          itc_eligible?: boolean
          notes?: string | null
          other_charges?: number
          place_of_supply?: string | null
          po_id?: string | null
          sgst_amount?: number
          status?: string
          subtotal?: number
          supplier_gstin?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bills_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          hsn_code: string | null
          id: string
          po_id: string
          product_id: string | null
          quantity: number
          rate: number
          received_quantity: number | null
          sort_order: number | null
          tax_amount: number | null
          tax_percent: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          hsn_code?: string | null
          id?: string
          po_id: string
          product_id?: string | null
          quantity?: number
          rate?: number
          received_quantity?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          hsn_code?: string | null
          id?: string
          po_id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          received_quantity?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorized_at: string | null
          authorized_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number | null
          expected_delivery: string | null
          grand_total: number | null
          id: string
          lead_id: string | null
          notes: string | null
          order_date: string | null
          po_number: string
          quotation_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          review_requested_at: string | null
          review_requested_by: string | null
          review_suggestions: string | null
          sales_order_id: string | null
          sent_to_supplier_at: string | null
          sent_to_supplier_by: string | null
          status: string
          subtotal: number | null
          supplier_id: string | null
          supplier_quotation_id: string | null
          terms_conditions: string | null
          total_tax: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          vertical_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number | null
          expected_delivery?: string | null
          grand_total?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_date?: string | null
          po_number: string
          quotation_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_suggestions?: string | null
          sales_order_id?: string | null
          sent_to_supplier_at?: string | null
          sent_to_supplier_by?: string | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_quotation_id?: string | null
          terms_conditions?: string | null
          total_tax?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          vertical_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number | null
          expected_delivery?: string | null
          grand_total?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_date?: string | null
          po_number?: string
          quotation_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_suggestions?: string | null
          sales_order_id?: string | null
          sent_to_supplier_at?: string | null
          sent_to_supplier_by?: string | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_quotation_id?: string | null
          terms_conditions?: string | null
          total_tax?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_review_requested_by_fkey"
            columns: ["review_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sent_to_supplier_by_fkey"
            columns: ["sent_to_supplier_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_quotation_id_fkey"
            columns: ["supplier_quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_release_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          office_id: string | null
          product_id: string | null
          quantity: number
          release_id: string
          sales_order_id: string
          source_item_id: string | null
          source_type: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          office_id?: string | null
          product_id?: string | null
          quantity?: number
          release_id: string
          sales_order_id: string
          source_item_id?: string | null
          source_type?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          office_id?: string | null
          product_id?: string | null
          quantity?: number
          release_id?: string
          sales_order_id?: string
          source_item_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_release_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "qc_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_release_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_release_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_releases: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          office_id: string | null
          quotation_id: string | null
          released_at: string
          released_by: string | null
          sales_order_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          office_id?: string | null
          quotation_id?: string | null
          released_at?: string
          released_by?: string | null
          sales_order_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          office_id?: string | null
          quotation_id?: string | null
          released_at?: string
          released_by?: string | null
          sales_order_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_releases_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_releases_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_releases_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_item_negotiations: {
        Row: {
          created_at: string
          final_gap: number | null
          final_rate: number | null
          id: string
          initial_quoted_rate: number
          lead_id: string
          negotiation_status: string
          outcome: string | null
          price_gap: number | null
          product_id: string | null
          product_name: string | null
          quotation_id: string
          quotation_item_id: string | null
          supplier_id: string | null
          target_rate: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          final_gap?: number | null
          final_rate?: number | null
          id?: string
          initial_quoted_rate: number
          lead_id: string
          negotiation_status?: string
          outcome?: string | null
          price_gap?: number | null
          product_id?: string | null
          product_name?: string | null
          quotation_id: string
          quotation_item_id?: string | null
          supplier_id?: string | null
          target_rate?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          final_gap?: number | null
          final_rate?: number | null
          id?: string
          initial_quoted_rate?: number
          lead_id?: string
          negotiation_status?: string
          outcome?: string | null
          price_gap?: number | null
          product_id?: string | null
          product_name?: string | null
          quotation_id?: string
          quotation_item_id?: string | null
          supplier_id?: string | null
          target_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_item_negotiations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_item_negotiations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_item_negotiations_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_item_negotiations_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_item_negotiations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          discount_amount: number | null
          discount_percent: number | null
          enquiry_item_id: string | null
          hsn_code: string | null
          id: string
          lead_time_days: number | null
          model_number: string | null
          price_version_id: string | null
          product_description: string | null
          product_id: string | null
          quantity: number
          quotation_id: string
          rate: number
          snap_gross_margin_pct: number | null
          snap_gross_profit: number | null
          snap_list_price: number | null
          snap_product_status: string | null
          snap_purchase_discount_pct: number | null
          snap_purchase_price: number | null
          snap_sales_discount_pct: number | null
          snap_sales_price: number | null
          sort_order: number | null
          target_rate: number | null
          tax_amount: number | null
          tax_percent: number | null
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          discount_amount?: number | null
          discount_percent?: number | null
          enquiry_item_id?: string | null
          hsn_code?: string | null
          id?: string
          lead_time_days?: number | null
          model_number?: string | null
          price_version_id?: string | null
          product_description?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id: string
          rate?: number
          snap_gross_margin_pct?: number | null
          snap_gross_profit?: number | null
          snap_list_price?: number | null
          snap_product_status?: string | null
          snap_purchase_discount_pct?: number | null
          snap_purchase_price?: number | null
          snap_sales_discount_pct?: number | null
          snap_sales_price?: number | null
          sort_order?: number | null
          target_rate?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          discount_amount?: number | null
          discount_percent?: number | null
          enquiry_item_id?: string | null
          hsn_code?: string | null
          id?: string
          lead_time_days?: number | null
          model_number?: string | null
          price_version_id?: string | null
          product_description?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          rate?: number
          snap_gross_margin_pct?: number | null
          snap_gross_profit?: number | null
          snap_list_price?: number | null
          snap_product_status?: string | null
          snap_purchase_discount_pct?: number | null
          snap_purchase_price?: number | null
          snap_sales_discount_pct?: number | null
          snap_sales_price?: number | null
          sort_order?: number | null
          target_rate?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_enquiry_item_id_fkey"
            columns: ["enquiry_item_id"]
            isOneToOne: false
            referencedRelation: "enquiry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          change_reason: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          exchange_rate: number | null
          grand_total: number | null
          id: string
          items_snapshot: Json
          notes: string | null
          quotation_id: string
          subject: string | null
          subtotal: number | null
          terms_conditions: string | null
          total_discount: number | null
          total_tax: number | null
          valid_until: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          grand_total?: number | null
          id?: string
          items_snapshot: Json
          notes?: string | null
          quotation_id: string
          subject?: string | null
          subtotal?: number | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          valid_until?: string | null
          version_number: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          grand_total?: number | null
          id?: string
          items_snapshot?: Json
          notes?: string | null
          quotation_id?: string
          subject?: string | null
          subtotal?: number | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          advance_amount: number | null
          advance_percent: number | null
          advance_remark: string | null
          balance_amount: number | null
          balance_remark: string | null
          converted_to_order_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          exchange_rate: number | null
          grand_total: number | null
          id: string
          is_converted: boolean | null
          is_price_matched: boolean | null
          lead_id: string | null
          loss_reason: string | null
          notes: string | null
          office_id: string | null
          payment_remark: string | null
          previous_quotation_id: string | null
          price_difference_from_initial: number | null
          price_matched_at: string | null
          quotation_number: string
          revision_number: number | null
          sent_at: string | null
          sent_via: string | null
          status: string
          subject: string | null
          subtotal: number | null
          tenant_id: string | null
          terms_conditions: string | null
          total_discount: number | null
          total_tax: number | null
          updated_at: string
          valid_until: string | null
          vertical_id: string | null
        }
        Insert: {
          advance_amount?: number | null
          advance_percent?: number | null
          advance_remark?: string | null
          balance_amount?: number | null
          balance_remark?: string | null
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          exchange_rate?: number | null
          grand_total?: number | null
          id?: string
          is_converted?: boolean | null
          is_price_matched?: boolean | null
          lead_id?: string | null
          loss_reason?: string | null
          notes?: string | null
          office_id?: string | null
          payment_remark?: string | null
          previous_quotation_id?: string | null
          price_difference_from_initial?: number | null
          price_matched_at?: string | null
          quotation_number: string
          revision_number?: number | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          subject?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
          vertical_id?: string | null
        }
        Update: {
          advance_amount?: number | null
          advance_percent?: number | null
          advance_remark?: string | null
          balance_amount?: number | null
          balance_remark?: string | null
          converted_to_order_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          exchange_rate?: number | null
          grand_total?: number | null
          id?: string
          is_converted?: boolean | null
          is_price_matched?: boolean | null
          lead_id?: string | null
          loss_reason?: string | null
          notes?: string | null
          office_id?: string | null
          payment_remark?: string | null
          previous_quotation_id?: string | null
          price_difference_from_initial?: number | null
          price_matched_at?: string | null
          quotation_number?: string
          revision_number?: number | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          subject?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          terms_conditions?: string | null
          total_discount?: number | null
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders_with_net"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_previous_quotation_id_fkey"
            columns: ["previous_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_at: string
          email_sent: boolean | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          is_completed: boolean | null
          notification_sent: boolean | null
          priority: string | null
          remind_before_minutes: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at: string
          email_sent?: boolean | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          is_completed?: boolean | null
          notification_sent?: boolean | null
          priority?: string | null
          remind_before_minutes?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string
          email_sent?: boolean | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          is_completed?: boolean | null
          notification_sent?: boolean | null
          priority?: string | null
          remind_before_minutes?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_distributions: {
        Row: {
          created_at: string | null
          declined_reason: string | null
          id: string
          response_status: string | null
          rfq_id: string
          sent_at: string | null
          sent_by: string | null
          supplier_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          declined_reason?: string | null
          id?: string
          response_status?: string | null
          rfq_id: string
          sent_at?: string | null
          sent_by?: string | null
          supplier_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          declined_reason?: string | null
          id?: string
          response_status?: string | null
          rfq_id?: string
          sent_at?: string | null
          sent_by?: string | null
          supplier_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_distributions_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_distributions_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_distributions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          product_id: string | null
          quantity: number
          rfq_id: string
          sort_order: number | null
          specifications: Json | null
          target_price: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          product_id?: string | null
          quantity: number
          rfq_id: string
          sort_order?: number | null
          specifications?: Json | null
          target_price?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          rfq_id?: string
          sort_order?: number | null
          specifications?: Json | null
          target_price?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          assigned_manager_id: string | null
          base_currency: string
          category_id: string | null
          client_name: string | null
          closed_at: string | null
          closed_by: string | null
          commercial_terms: string | null
          created_at: string | null
          created_by: string | null
          deadline_date: string
          delivery_timeline_days: number | null
          department: string | null
          description: string | null
          fx_reference_date: string | null
          fx_source: string | null
          id: string
          issue_date: string | null
          notes: string | null
          project_name: string | null
          quantity: number | null
          required_documents: string[] | null
          rfq_number: string
          status: string
          target_delivery_location: string | null
          technical_specifications: Json | null
          title: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_manager_id?: string | null
          base_currency?: string
          category_id?: string | null
          client_name?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commercial_terms?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline_date: string
          delivery_timeline_days?: number | null
          department?: string | null
          description?: string | null
          fx_reference_date?: string | null
          fx_source?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          project_name?: string | null
          quantity?: number | null
          required_documents?: string[] | null
          rfq_number: string
          status?: string
          target_delivery_location?: string | null
          technical_specifications?: Json | null
          title: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_manager_id?: string | null
          base_currency?: string
          category_id?: string | null
          client_name?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commercial_terms?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline_date?: string
          delivery_timeline_days?: number | null
          department?: string | null
          description?: string | null
          fx_reference_date?: string | null
          fx_source?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          project_name?: string | null
          quantity?: number | null
          required_documents?: string[] | null
          rfq_number?: string
          status?: string
          target_delivery_location?: string | null
          technical_specifications?: Json | null
          title?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_tracker: {
        Row: {
          id: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          office_id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          office_id: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          office_id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_tracker_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_tracker_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_tracker_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          assigned_procurement: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          expected_arrival: string | null
          id: string
          is_import: boolean | null
          lead_id: string | null
          notes: string | null
          office_id: string | null
          order_number: string
          order_value: number | null
          payment_amount: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          postponed_until: string | null
          preferred_supplier_id: string | null
          qc_release_notes: string | null
          qc_released_at: string | null
          qc_released_by: string | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_change_reason: string | null
          tenant_id: string | null
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          assigned_procurement?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_arrival?: string | null
          id?: string
          is_import?: boolean | null
          lead_id?: string | null
          notes?: string | null
          office_id?: string | null
          order_number: string
          order_value?: number | null
          payment_amount?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postponed_until?: string | null
          preferred_supplier_id?: string | null
          qc_release_notes?: string | null
          qc_released_at?: string | null
          qc_released_by?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_change_reason?: string | null
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          assigned_procurement?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_arrival?: string | null
          id?: string
          is_import?: boolean | null
          lead_id?: string | null
          notes?: string | null
          office_id?: string | null
          order_number?: string
          order_value?: number | null
          payment_amount?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postponed_until?: string | null
          preferred_supplier_id?: string | null
          qc_release_notes?: string | null
          qc_released_at?: string | null
          qc_released_by?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_change_reason?: string | null
          tenant_id?: string | null
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_assigned_procurement_fkey"
            columns: ["assigned_procurement"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_qc_released_by_fkey"
            columns: ["qc_released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric: string | null
          month: number | null
          office_id: string | null
          quarter: number | null
          target_amount: number
          target_type: string
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string | null
          month?: number | null
          office_id?: string | null
          quarter?: number | null
          target_amount?: number
          target_type: string
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string | null
          month?: number | null
          office_id?: string | null
          quarter?: number | null
          target_amount?: number
          target_type?: string
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          name: string
          next_send_at: string | null
          recipients: string[]
          report_type: string
          schedule: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          name: string
          next_send_at?: string | null
          recipients: string[]
          report_type: string
          schedule: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          name?: string
          next_send_at?: string | null
          recipients?: string[]
          report_type?: string
          schedule?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          box_count: number
          dispatch_id: string
          file_name: string | null
          file_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          label_data: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          box_count?: number
          dispatch_id: string
          file_name?: string | null
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          label_data?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          box_count?: number
          dispatch_id?: string
          file_name?: string | null
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          label_data?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_id: string | null
          movement_type: string
          notes: string | null
          office_id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id?: string | null
          movement_type: string
          notes?: string | null
          office_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id?: string | null
          movement_type?: string
          notes?: string | null
          office_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_category_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          category_id: string
          id: string
          is_rfq_eligible: boolean | null
          supplier_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          category_id: string
          id?: string
          is_rfq_eligible?: boolean | null
          supplier_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          category_id?: string
          id?: string
          is_rfq_eligible?: boolean | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_category_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_category_assignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_communications: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          is_internal_note: boolean | null
          message_type: string | null
          parent_id: string | null
          quotation_id: string | null
          read_at: string | null
          read_by: string | null
          rfq_id: string | null
          sent_by: string | null
          sent_by_supplier: boolean | null
          subject: string | null
          supplier_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          message_type?: string | null
          parent_id?: string | null
          quotation_id?: string | null
          read_at?: string | null
          read_by?: string | null
          rfq_id?: string | null
          sent_by?: string | null
          sent_by_supplier?: boolean | null
          subject?: string | null
          supplier_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          message_type?: string | null
          parent_id?: string | null
          quotation_id?: string | null
          read_at?: string | null
          read_by?: string | null
          rfq_id?: string | null
          sent_by?: string | null
          sent_by_supplier?: boolean | null
          subject?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_communications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "supplier_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_communications_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_communications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_communications_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_communications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_communications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string | null
          document_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_type: string
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          quotation_id: string | null
          rfq_id: string | null
          supplier_id: string
          updated_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          document_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_type: string
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          quotation_id?: string | null
          rfq_id?: string | null
          supplier_id: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          document_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_type?: string
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          quotation_id?: string | null
          rfq_id?: string | null
          supplier_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_notifications: {
        Row: {
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string
          read_at: string | null
          related_quotation_id: string | null
          related_rfq_id: string | null
          supplier_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          read_at?: string | null
          related_quotation_id?: string | null
          related_rfq_id?: string | null
          supplier_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          read_at?: string | null
          related_quotation_id?: string | null
          related_rfq_id?: string | null
          supplier_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_notifications_related_quotation_id_fkey"
            columns: ["related_quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_notifications_related_rfq_id_fkey"
            columns: ["related_rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_notifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          payment_mode: string
          po_id: string | null
          receipt_url: string | null
          supplier_id: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_mode?: string
          po_id?: string | null
          receipt_url?: string | null
          supplier_id: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_mode?: string
          po_id?: string | null
          receipt_url?: string | null
          supplier_id?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotation_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          product_id: string | null
          quantity: number
          quotation_id: string
          rfq_item_id: string | null
          sort_order: number | null
          specifications: Json | null
          total_converted: number | null
          total_original: number
          unit: string | null
          unit_price_converted: number | null
          unit_price_original: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          product_id?: string | null
          quantity: number
          quotation_id: string
          rfq_item_id?: string | null
          sort_order?: number | null
          specifications?: Json | null
          total_converted?: number | null
          total_original: number
          unit?: string | null
          unit_price_converted?: number | null
          unit_price_original: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          rfq_item_id?: string | null
          sort_order?: number | null
          specifications?: Json | null
          total_converted?: number | null
          total_original?: number
          unit?: string | null
          unit_price_converted?: number | null
          unit_price_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_items_rfq_item_id_fkey"
            columns: ["rfq_item_id"]
            isOneToOne: false
            referencedRelation: "rfq_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotations: {
        Row: {
          country_of_origin: string | null
          created_at: string | null
          fx_rate_date: string | null
          fx_rate_to_base: number | null
          hs_code: string | null
          id: string
          internal_remarks: string | null
          is_shortlisted: boolean | null
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          payment_terms: string | null
          quotation_number: string
          quoted_currency: string
          rejection_reason: string | null
          rfq_distribution_id: string | null
          rfq_id: string
          shortlisted_at: string | null
          shortlisted_by: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          supplier_id: string
          total_converted: number | null
          total_original: number
          updated_at: string | null
          validity_days: number | null
          version: number | null
        }
        Insert: {
          country_of_origin?: string | null
          created_at?: string | null
          fx_rate_date?: string | null
          fx_rate_to_base?: number | null
          hs_code?: string | null
          id?: string
          internal_remarks?: string | null
          is_shortlisted?: boolean | null
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          payment_terms?: string | null
          quotation_number: string
          quoted_currency: string
          rejection_reason?: string | null
          rfq_distribution_id?: string | null
          rfq_id: string
          shortlisted_at?: string | null
          shortlisted_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_id: string
          total_converted?: number | null
          total_original: number
          updated_at?: string | null
          validity_days?: number | null
          version?: number | null
        }
        Update: {
          country_of_origin?: string | null
          created_at?: string | null
          fx_rate_date?: string | null
          fx_rate_to_base?: number | null
          hs_code?: string | null
          id?: string
          internal_remarks?: string | null
          is_shortlisted?: boolean | null
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          payment_terms?: string | null
          quotation_number?: string
          quoted_currency?: string
          rejection_reason?: string | null
          rfq_distribution_id?: string | null
          rfq_id?: string
          shortlisted_at?: string | null
          shortlisted_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_id?: string
          total_converted?: number | null
          total_original?: number
          updated_at?: string | null
          validity_days?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotations_rfq_distribution_id_fkey"
            columns: ["rfq_distribution_id"]
            isOneToOne: false
            referencedRelation: "rfq_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_shortlisted_by_fkey"
            columns: ["shortlisted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_ratings: {
        Row: {
          comments: string | null
          created_at: string
          delivery_rating: number | null
          grn_id: string | null
          id: string
          overall_rating: number | null
          po_id: string | null
          price_rating: number | null
          quality_rating: number | null
          rated_at: string
          rated_by: string | null
          supplier_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          grn_id?: string | null
          id?: string
          overall_rating?: number | null
          po_id?: string | null
          price_rating?: number | null
          quality_rating?: number | null
          rated_at?: string
          rated_by?: string | null
          supplier_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          grn_id?: string | null
          id?: string
          overall_rating?: number | null
          po_id?: string | null
          price_rating?: number | null
          quality_rating?: number | null
          rated_at?: string
          rated_by?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ratings_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ratings_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ratings_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ratings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_status: string
          notes: string | null
          previous_status: string | null
          reason: string | null
          supplier_id: string
          user_agent: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_status: string
          notes?: string | null
          previous_status?: string | null
          reason?: string | null
          supplier_id: string
          user_agent?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_status?: string
          notes?: string | null
          previous_status?: string | null
          reason?: string | null
          supplier_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_status_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          application_status: string | null
          assigned_manager_id: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          brand_authorization_url: string | null
          cancelled_cheque_url: string | null
          category: string | null
          city: string | null
          coi_url: string | null
          commercial_review_at: string | null
          commercial_reviewed_by: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          default_landed_cost_config: Json
          email: string | null
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          internal_rating: number | null
          is_active: boolean | null
          is_authorized_dealer: boolean | null
          manufacturing_type: string | null
          msme_certificate_url: string | null
          name: string
          nda_accepted_at: string | null
          pan_card_url: string | null
          pan_number: string | null
          payment_terms: string | null
          phone: string | null
          pincode: string | null
          preferred_currency: string | null
          preferred_flag: boolean | null
          registration_source: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flag: string | null
          state: string | null
          status: string | null
          suspended_at: string | null
          suspension_reason: string | null
          technical_review_at: string | null
          technical_reviewed_by: string | null
          updated_at: string
          website: string | null
          years_in_operation: number | null
        }
        Insert: {
          address?: string | null
          application_status?: string | null
          assigned_manager_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          brand_authorization_url?: string | null
          cancelled_cheque_url?: string | null
          category?: string | null
          city?: string | null
          coi_url?: string | null
          commercial_review_at?: string | null
          commercial_reviewed_by?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_landed_cost_config?: Json
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          internal_rating?: number | null
          is_active?: boolean | null
          is_authorized_dealer?: boolean | null
          manufacturing_type?: string | null
          msme_certificate_url?: string | null
          name: string
          nda_accepted_at?: string | null
          pan_card_url?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          preferred_currency?: string | null
          preferred_flag?: boolean | null
          registration_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flag?: string | null
          state?: string | null
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          technical_review_at?: string | null
          technical_reviewed_by?: string | null
          updated_at?: string
          website?: string | null
          years_in_operation?: number | null
        }
        Update: {
          address?: string | null
          application_status?: string | null
          assigned_manager_id?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          brand_authorization_url?: string | null
          cancelled_cheque_url?: string | null
          category?: string | null
          city?: string | null
          coi_url?: string | null
          commercial_review_at?: string | null
          commercial_reviewed_by?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_landed_cost_config?: Json
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          internal_rating?: number | null
          is_active?: boolean | null
          is_authorized_dealer?: boolean | null
          manufacturing_type?: string | null
          msme_certificate_url?: string | null
          name?: string
          nda_accepted_at?: string | null
          pan_card_url?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          preferred_currency?: string | null
          preferred_flag?: boolean | null
          registration_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flag?: string | null
          state?: string | null
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          technical_review_at?: string | null
          technical_reviewed_by?: string | null
          updated_at?: string
          website?: string | null
          years_in_operation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_commercial_reviewed_by_fkey"
            columns: ["commercial_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_technical_reviewed_by_fkey"
            columns: ["technical_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          escalated_at: string | null
          escalation_level:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          escalated_at?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          escalated_at?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          coupon_code: string | null
          created_at: string
          discount_amount: number | null
          end_date: string | null
          id: string
          payment_status: Database["public"]["Enums"]["subscription_payment_status"]
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_user: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          start_date: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
          user_count: number
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["subscription_payment_status"]
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_user: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          start_date?: string | null
          tenant_id: string
          total_amount: number
          updated_at?: string
          user_count?: number
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["subscription_payment_status"]
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_user?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          start_date?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          company_name: string
          country: string | null
          country_code: string | null
          created_at: string
          default_currency: string | null
          default_language: string | null
          email: string | null
          gst_number: string | null
          id: string
          industry: string | null
          logo_url: string | null
          max_users: number
          phone: string | null
          pincode: string | null
          state: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          tax_system: Json | null
          trial_end_date: string
          trial_start_date: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string | null
          default_language?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_users?: number
          phone?: string | null
          pincode?: string | null
          state?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          tax_system?: Json | null
          trial_end_date?: string
          trial_start_date?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string | null
          default_language?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_users?: number
          phone?: string | null
          pincode?: string | null
          state?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          tax_system?: Json | null
          trial_end_date?: string
          trial_start_date?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      tender_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          notes: string | null
          tenant_id: string
          tender_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          notes?: string | null
          tenant_id: string
          tender_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          tenant_id?: string
          tender_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_documents_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          assigned_by: string
          assigned_to: string
          award_reference: string | null
          awarded_date: string | null
          awarded_to: string | null
          awarded_value: number | null
          bid_opening_date: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          emd_amount: number | null
          emd_status: string | null
          estimated_value: number | null
          id: string
          issuing_authority: string
          notes: string | null
          portal_name: string | null
          pre_bid_date: string | null
          priority: Database["public"]["Enums"]["bie_priority"]
          published_date: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rework_note: string | null
          status: string
          submission_deadline: string | null
          submitted_at: string | null
          tenant_id: string
          tender_fee: number | null
          tender_number: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          award_reference?: string | null
          awarded_date?: string | null
          awarded_to?: string | null
          awarded_value?: number | null
          bid_opening_date?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          emd_amount?: number | null
          emd_status?: string | null
          estimated_value?: number | null
          id?: string
          issuing_authority: string
          notes?: string | null
          portal_name?: string | null
          pre_bid_date?: string | null
          priority?: Database["public"]["Enums"]["bie_priority"]
          published_date?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submission_deadline?: string | null
          submitted_at?: string | null
          tenant_id: string
          tender_fee?: number | null
          tender_number: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          award_reference?: string | null
          awarded_date?: string | null
          awarded_to?: string | null
          awarded_value?: number | null
          bid_opening_date?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          emd_amount?: number | null
          emd_status?: string | null
          estimated_value?: number | null
          id?: string
          issuing_authority?: string
          notes?: string | null
          portal_name?: string | null
          pre_bid_date?: string | null
          priority?: Database["public"]["Enums"]["bie_priority"]
          published_date?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submission_deadline?: string | null
          submitted_at?: string | null
          tenant_id?: string
          tender_fee?: number | null
          tender_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenders_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          reply_by: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          reply_by?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          reply_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string | null
          id: string
          language_code: string
          translation_key: string
          translation_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          language_code: string
          translation_key: string
          translation_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          language_code?: string
          translation_key?: string
          translation_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
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
      vendor_evaluations: {
        Row: {
          compliance_notes: string | null
          compliance_score: number | null
          created_at: string
          delivery_score: number | null
          evaluated_by: string | null
          id: string
          is_selected: boolean | null
          performance_score: number | null
          price_score: number | null
          quotation_id: string | null
          rfq_id: string
          supplier_id: string
          weighted_total: number | null
        }
        Insert: {
          compliance_notes?: string | null
          compliance_score?: number | null
          created_at?: string
          delivery_score?: number | null
          evaluated_by?: string | null
          id?: string
          is_selected?: boolean | null
          performance_score?: number | null
          price_score?: number | null
          quotation_id?: string | null
          rfq_id: string
          supplier_id: string
          weighted_total?: number | null
        }
        Update: {
          compliance_notes?: string | null
          compliance_score?: number | null
          created_at?: string
          delivery_score?: number | null
          evaluated_by?: string | null
          id?: string
          is_selected?: boolean | null
          performance_score?: number | null
          price_score?: number | null
          quotation_id?: string | null
          rfq_id?: string
          supplier_id?: string
          weighted_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_evaluations_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_evaluations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_evaluations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_registrations: {
        Row: {
          assigned_by: string
          assigned_to: string
          company_name: string
          completed_at: string | null
          created_at: string
          credential_reference: string | null
          due_date: string | null
          id: string
          notes: string | null
          portal_name: string
          priority: Database["public"]["Enums"]["bie_priority"]
          registration_reference: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rework_note: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          company_name: string
          completed_at?: string | null
          created_at?: string
          credential_reference?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          portal_name: string
          priority?: Database["public"]["Enums"]["bie_priority"]
          registration_reference?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          company_name?: string
          completed_at?: string | null
          created_at?: string
          credential_reference?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          portal_name?: string
          priority?: Database["public"]["Enums"]["bie_priority"]
          registration_reference?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_registrations_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_registrations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_doc_counters: {
        Row: {
          doc_type: string
          last_seq: number
          updated_at: string
          vertical_id: string
          year_part: string
        }
        Insert: {
          doc_type: string
          last_seq?: number
          updated_at?: string
          vertical_id: string
          year_part: string
        }
        Update: {
          doc_type?: string
          last_seq?: number
          updated_at?: string
          vertical_id?: string
          year_part?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_doc_counters_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: string
          user_id: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          user_id: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          user_id?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_users_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      verticals: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          currency: string | null
          doc_prefix: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          is_default: boolean
          letterhead_url: string | null
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          currency?: string | null
          doc_prefix: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          letterhead_url?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          doc_prefix?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          letterhead_url?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verticals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          payload: Json | null
          processing_result: string
          source: string
          source_reference: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          processing_result?: string
          source: string
          source_reference?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          processing_result?: string
          source?: string
          source_reference?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_listings: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          listed_date: string | null
          listing_reference: string | null
          listing_title: string
          listing_url: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["bie_priority"]
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rework_note: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          website_name: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          listed_date?: string | null
          listing_reference?: string | null
          listing_title: string
          listing_url?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["bie_priority"]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          website_name: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          listed_date?: string | null
          listing_reference?: string | null
          listing_title?: string
          listing_url?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["bie_priority"]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rework_note?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          website_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_listings_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_listings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          campaign_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          template_params: Json | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          template_params?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          template_params?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      sales_orders_with_net: {
        Row: {
          assigned_procurement: string | null
          cancellation_reason: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          expected_arrival: string | null
          id: string | null
          is_import: boolean | null
          lead_id: string | null
          net_value: number | null
          notes: string | null
          office_id: string | null
          order_number: string | null
          order_value: number | null
          payment_amount: number | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          postponed_until: string | null
          preferred_supplier_id: string | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          status_change_reason: string | null
          tenant_id: string | null
          updated_at: string | null
          vertical_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_assigned_procurement_fkey"
            columns: ["assigned_procurement"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_price_item: { Args: { _item_id: string }; Returns: string }
      assign_lead_to_spt: { Args: { p_lead_id: string }; Returns: string }
      assign_procurement_owner: {
        Args: { _price_request_id: string }
        Returns: string
      }
      auto_segment_customers:
        | { Args: never; Returns: undefined }
        | { Args: { p_tenant_id: string }; Returns: Json }
      backpost_accounting: { Args: { _tenant: string }; Returns: Json }
      bootstrap_tenant_onboarding: {
        Args: {
          p_address?: string
          p_admin_phone?: string
          p_city?: string
          p_company_name: string
          p_country?: string
          p_email?: string
          p_gst_number?: string
          p_industry?: string
          p_logo_url?: string
          p_phone?: string
          p_state?: string
          p_website?: string
        }
        Returns: string
      }
      branch_guard: { Args: { _office_id: string }; Returns: boolean }
      branch_write_guard: { Args: { _office_id: string }; Returns: boolean }
      can_view_supplier_quotes: { Args: { _user_id: string }; Returns: boolean }
      check_pricing_alerts: { Args: never; Returns: undefined }
      coa_ensure: {
        Args: {
          _code: string
          _group: string
          _name: string
          _tenant: string
          _type: string
        }
        Returns: string
      }
      count_unlogged_leads_24h: {
        Args: { _tenant_id: string }
        Returns: number
      }
      create_customer_safe: {
        Args: {
          p_address?: string
          p_assigned_sales_id?: string
          p_city?: string
          p_company_name: string
          p_contact_person?: string
          p_email?: string
          p_gst_number?: string
          p_industry_tag?: string
          p_is_b2b?: boolean
          p_notes?: string
          p_office_id?: string
          p_phone: string
          p_pincode?: string
          p_state?: string
        }
        Returns: {
          address: string | null
          alternate_phone: string | null
          assigned_sales_id: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          cst_dnc: boolean
          cst_favourite: boolean
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          industry_tag: string | null
          is_b2b: boolean | null
          is_frozen: boolean | null
          is_priority: boolean | null
          notes: string | null
          office_id: string | null
          outreach_opted_out: boolean | null
          owner_locked: boolean
          payment_days: number | null
          phone: string
          pincode: string | null
          segment: Database["public"]["Enums"]["customer_segment"] | null
          segment_locked: boolean | null
          special_discount_pct: number | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          vertical_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_lead_secure: { Args: { payload: Json }; Returns: string }
      current_user_office_id: { Args: never; Returns: string }
      customer_in_my_tenant: {
        Args: { _customer_id: string }
        Returns: boolean
      }
      delegate_employee_work: {
        Args: { p_from_user_id: string; p_to_user_id: string }
        Returns: Json
      }
      delegate_employee_work_multi: {
        Args: { p_from_user_id: string; p_to_user_ids: string[] }
        Returns: Json
      }
      delegate_role_work: {
        Args: {
          p_from_user_id: string
          p_notes?: string
          p_roles_removed: Database["public"]["Enums"]["app_role"][]
          p_to_user_id: string
        }
        Returns: Json
      }
      delete_sales_order_cascade: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      detect_enquiry_brand: {
        Args: {
          _matched_product_id: string
          _query_text: string
          _tenant_id: string
        }
        Returns: string
      }
      distribute_customers_to_cros: {
        Args: { p_stale_days?: number; p_tenant_id: string }
        Returns: Json
      }
      empty_all_trash: { Args: never; Returns: undefined }
      find_ownership_mismatches: {
        Args: {
          p_days?: number
          p_min_worker_actions?: number
          p_require_owner_zero?: boolean
          p_tenant: string
        }
        Returns: {
          customer_id: string
          customer_name: string
          last_activity_at: string
          lead_created_at: string
          lead_id: string
          lead_source: string
          lead_status: Database["public"]["Enums"]["lead_status"]
          lead_title: string
          owner_activity_count: number
          owner_id: string
          owner_name: string
          worker_activity_count: number
          worker_id: string
          worker_name: string
        }[]
      }
      find_potential_duplicate_customer: {
        Args: {
          p_city?: string
          p_company_name?: string
          p_email?: string
          p_exclude_id?: string
          p_gst_number?: string
          p_phone: string
          p_state?: string
        }
        Returns: {
          assigned_sales_id: string
          assigned_sales_name: string
          city: string
          company_name: string
          customer_id: string
          email: string
          gst_number: string
          match_reasons: string[]
          match_score: number
          phone: string
          state: string
        }[]
      }
      get_cro_assignment_stats: {
        Args: { p_cro_ids: string[] }
        Returns: {
          contacted: number
          cro_user_id: string
          enquiries: number
          last_activity: string
          no_response: number
          pending: number
          total_assigned: number
        }[]
      }
      get_delhi_office_id: { Args: never; Returns: string }
      get_lead_detail: {
        Args: { p_include_deleted?: boolean; p_lead_id: string }
        Returns: Json
      }
      get_loyal_owner: { Args: { p_customer_id: string }; Returns: string }
      get_lqt_inbox: {
        Args: {
          p_from?: string
          p_limit?: number
          p_tab: string
          p_to?: string
          p_vertical_id?: string
        }
        Returns: Json
      }
      get_lqt_stats: { Args: { p_from?: string; p_to?: string }; Returns: Json }
      get_lucknow_office_id: { Args: never; Returns: string }
      get_model_key_duplicates: {
        Args: never
        Returns: {
          brand_match_key: string
          match_key: string
          product_count: number
          products: Json
        }[]
      }
      get_procurement_head: { Args: { _tenant_id: string }; Returns: string }
      get_procurement_scorecard: {
        Args: { _from: string; _to: string; _user?: string }
        Returns: Json
      }
      get_procurement_team_board: {
        Args: { _from: string; _to: string }
        Returns: {
          assigned_count: number
          avg_resolution_hours: number
          breached_open: number
          no_price_count: number
          open_count: number
          po_count: number
          po_value: number
          quotes_captured: number
          resolved_count: number
          target_matched: number
          tat_met: number
          tat_missed: number
          user_id: string
          user_name: string
        }[]
      }
      get_role_work_summary: {
        Args: {
          p_roles_removed: Database["public"]["Enums"]["app_role"][]
          p_user_id: string
        }
        Returns: Json
      }
      get_segment_analytics: {
        Args: {
          p_from?: string
          p_is_scoped?: boolean
          p_to?: string
          p_user_id?: string
          p_vertical_id?: string
        }
        Returns: Json
      }
      get_segment_drilldown_customers: {
        Args: {
          p_from?: string
          p_is_scoped?: boolean
          p_limit?: number
          p_metric: string
          p_offset?: number
          p_search?: string
          p_segment: string
          p_to?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_spt_inbox: {
        Args: never
        Returns: {
          assigned_to: string
          created_at: string
          customer_company: string
          customer_contact: string
          customer_email: string
          customer_id: string
          customer_phone: string
          customer_query: string
          customer_segment: string
          enquiry_status: string
          estimated_value: number
          handoff_at: string
          has_enquiry: boolean
          id: string
          item_count: number
          latest_quotation_created_at: string
          latest_quotation_grand_total: number
          latest_quotation_id: string
          latest_quotation_sent_at: string
          latest_quotation_status: string
          lead_status: string
          lost_at: string
          owner_name: string
          pending_pricing: number
          pricing_mode: string
          qualification_type: string
          qualified_at: string
          qualifier_name: string
          routed_to: string
          source: string
          stage: string
          title: string
          total_qty: number
          updated_pricing: number
          verified_auto: number
          won_at: string
        }[]
      }
      get_subordinate_ids: { Args: { _manager_id: string }; Returns: string[] }
      get_supplier_quote_stats: {
        Args: { _from?: string; _to?: string }
        Returns: {
          avg_gap_vs_lowest_pct: number
          avg_lead_time: number
          avg_price: number
          last_quoted_at: string
          pushed_count: number
          quotes_count: number
          supplier_id: string
          supplier_name: string
          target_met_count: number
          win_rate: number
        }[]
      }
      get_target_match_scorecard: {
        Args: {
          _department?: string
          _from: string
          _office?: string
          _to: string
        }
        Returns: Json
      }
      get_unlogged_leads_last_24h: {
        Args: never
        Returns: {
          assigned_to: string
          assignee_name: string
          company_name: string
          created_at: string
          customer_id: string
          lead_id: string
          source: string
          title: string
        }[]
      }
      get_user_cro_customer_ids: { Args: { _uid: string }; Returns: string[] }
      get_user_default_vertical: { Args: { _user_id: string }; Returns: string }
      get_user_qualified_lead_ids: { Args: { _uid: string }; Returns: string[] }
      get_user_quotation_lead_ids: { Args: { _uid: string }; Returns: string[] }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_variance_drilldown: {
        Args: {
          _department?: string
          _from: string
          _limit?: number
          _metric: string
          _office?: string
          _to: string
        }
        Returns: Json
      }
      hard_delete_customer: {
        Args: { customer_id: string }
        Returns: undefined
      }
      hard_delete_lead: { Args: { lead_id: string }; Returns: undefined }
      hard_delete_quotation: {
        Args: { quotation_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_bie_manager: { Args: { _user_id: string }; Returns: boolean }
      is_bie_member: { Args: { _user_id: string }; Returns: boolean }
      is_branch_manager: { Args: { _user_id: string }; Returns: boolean }
      is_branch_scoped_role: { Args: { _user_id: string }; Returns: boolean }
      is_bulk_price_approver: { Args: { _user_id: string }; Returns: boolean }
      is_cct: { Args: { _user_id: string }; Returns: boolean }
      is_chat_admin: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_hr_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_lucknow_user: { Args: { _user_id: string }; Returns: boolean }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_my_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      is_procurement_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_same_tenant: { Args: { _target_user_id: string }; Returns: boolean }
      is_same_tenant_any: { Args: { _user_ids: string[] }; Returns: boolean }
      is_tenant_owner_or_admin: { Args: { _user_id: string }; Returns: boolean }
      next_vertical_doc_seq: {
        Args: { _doc_type: string; _vertical: string; _year: string }
        Returns: number
      }
      pick_next_lqt_user:
        | { Args: { p_tenant_id: string }; Returns: string }
        | {
            Args: { p_tenant_id: string; p_vertical_id?: string }
            Returns: string
          }
      pick_next_lqt_user_in_office: {
        Args: { p_office_id: string; p_tenant_id: string }
        Returns: string
      }
      pick_next_procurement_user: {
        Args: { _tenant_id: string }
        Returns: string
      }
      post_ledger: {
        Args: {
          _date: string
          _lines: Json
          _ref: string
          _source_id: string
          _source_type: string
          _tenant: string
        }
        Returns: undefined
      }
      preview_user_book: { Args: { p_user_id: string }; Returns: Json }
      redistribute_user_book: {
        Args: {
          p_entities: string[]
          p_from_user_id: string
          p_include_order_authorship?: boolean
          p_include_quotation_authorship?: boolean
          p_recipient_role?: string
          p_to_user_ids: string[]
        }
        Returns: Json
      }
      restore_customer: { Args: { customer_id: string }; Returns: undefined }
      restore_lead: { Args: { lead_id: string }; Returns: undefined }
      restore_quotation: { Args: { quotation_id: string }; Returns: undefined }
      route_new_lead_to_office: {
        Args: { p_source: string; p_tenant_id: string }
        Returns: {
          office_id: string
          rule_id: string
        }[]
      }
      schedule_cro_distribution: {
        Args: { cron_expression: string }
        Returns: undefined
      }
      schedule_indiamart_sync: {
        Args: { cron_expression: string }
        Returns: undefined
      }
      schedule_tradeindia_sync: {
        Args: { cron_expression: string }
        Returns: undefined
      }
      seed_chart_of_accounts: { Args: { _tenant: string }; Returns: undefined }
      soft_delete_customer: {
        Args: { customer_id: string }
        Returns: undefined
      }
      soft_delete_lead: { Args: { lead_id: string }; Returns: undefined }
      soft_delete_quotation: {
        Args: { quotation_id: string }
        Returns: undefined
      }
      unschedule_cro_distribution: { Args: never; Returns: undefined }
      unschedule_indiamart_sync: { Args: never; Returns: undefined }
      unschedule_tradeindia_sync: { Args: never; Returns: undefined }
      user_has_vertical: {
        Args: { _user_id: string; _vertical_id: string }
        Returns: boolean
      }
      was_recent_lead_assignee: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "coo"
        | "manager"
        | "sales"
        | "procurement"
        | "accounts"
        | "warehouse"
        | "hr"
        | "platform_admin"
        | "cro"
        | "tst"
        | "cst"
        | "procurement_manager"
        | "cct"
        | "import_procurement"
        | "bie"
        | "bie_manager"
        | "qc"
      bie_priority: "low" | "normal" | "high" | "urgent"
      boq_feasibility: "feasible" | "not_feasible" | "needs_clarification"
      boq_item_category:
        | "vfd"
        | "plc"
        | "hmi"
        | "sensor"
        | "motor"
        | "panel"
        | "cable"
        | "accessory"
        | "other"
      boq_status:
        | "draft"
        | "in_progress"
        | "ready_for_sales"
        | "handed_off"
        | "on_hold"
      cct_assigned_team: "domestic_procurement" | "import_procurement"
      cct_priority: "low" | "normal" | "high" | "urgent"
      cct_sourcing_type: "domestic" | "import" | "hybrid"
      cct_stage:
        | "assigned"
        | "in_sourcing"
        | "price_finalized"
        | "order_placed"
        | "in_transit"
        | "delivered"
      chat_channel_type: "dm" | "branch" | "group" | "announcement"
      customer_segment: "platinum" | "gold" | "silver" | "bronze" | "inactive"
      dispatch_document_type:
        | "invoice"
        | "eway_bill"
        | "awb"
        | "packing_list"
        | "other"
      enquiry_pricing_status: "verified_auto" | "pending" | "updated"
      enquiry_status:
        | "no_enquiry"
        | "pending_prices"
        | "partial_prices"
        | "ready_to_quote"
        | "quoted"
        | "price_matched"
        | "negotiating"
        | "closed"
      escalation_level: "none" | "alert" | "manager" | "coo" | "ceo"
      holiday_type: "national" | "company" | "regional" | "optional"
      integration_sync_status: "success" | "error" | "pending"
      integration_type:
        | "indiamart"
        | "whatsapp"
        | "justdial"
        | "tradeindia"
        | "email"
        | "lead_config"
      lead_qualification_type: "simple" | "technical" | "invalid"
      lead_routing_target: "spt" | "tst" | "discard" | "nurture"
      lead_source:
        | "indiamart"
        | "justdial"
        | "website"
        | "whatsapp"
        | "email"
        | "referral"
        | "manual"
        | "tradeindia"
        | "cro_followup"
      lead_status:
        | "new"
        | "engaged"
        | "quoted"
        | "negotiation"
        | "won"
        | "lost"
        | "contacted"
        | "qualified"
        | "proposal"
        | "enquiry"
        | "no_enquiry"
      office_location: "delhi" | "lucknow"
      order_document_type:
        | "customer_po"
        | "payment_receipt"
        | "other"
        | "tax_invoice"
        | "eway_bill"
        | "awb"
        | "product_image"
      order_status:
        | "pending_documents"
        | "ready_for_procurement"
        | "in_procurement"
        | "partially_fulfilled"
        | "fulfilled"
        | "ready_to_dispatch"
        | "cancelled"
        | "postponed"
      payment_mode:
        | "cash"
        | "neft"
        | "rtgs"
        | "cheque"
        | "upi"
        | "card"
        | "other"
      payment_status: "pending" | "partial" | "received"
      price_request_status: "pending" | "in_progress" | "resolved" | "no_price"
      price_request_tat_status:
        | "on_track"
        | "reminder_sent"
        | "escalated"
        | "critical"
      procurement_metric:
        | "price_resolutions"
        | "products_added"
        | "po_count"
        | "resolution_time_hours"
        | "po_value"
      product_status: "active" | "discontinued" | "obsolete"
      subscription_payment_status:
        | "active"
        | "expired"
        | "cancelled"
        | "pending"
      subscription_plan_type: "monthly" | "half_yearly" | "annual"
      subscription_status: "trial" | "active" | "expired" | "cancelled"
      target_period_type: "monthly" | "quarterly"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      tenant_user_role: "owner" | "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "coo",
        "manager",
        "sales",
        "procurement",
        "accounts",
        "warehouse",
        "hr",
        "platform_admin",
        "cro",
        "tst",
        "cst",
        "procurement_manager",
        "cct",
        "import_procurement",
        "bie",
        "bie_manager",
        "qc",
      ],
      bie_priority: ["low", "normal", "high", "urgent"],
      boq_feasibility: ["feasible", "not_feasible", "needs_clarification"],
      boq_item_category: [
        "vfd",
        "plc",
        "hmi",
        "sensor",
        "motor",
        "panel",
        "cable",
        "accessory",
        "other",
      ],
      boq_status: [
        "draft",
        "in_progress",
        "ready_for_sales",
        "handed_off",
        "on_hold",
      ],
      cct_assigned_team: ["domestic_procurement", "import_procurement"],
      cct_priority: ["low", "normal", "high", "urgent"],
      cct_sourcing_type: ["domestic", "import", "hybrid"],
      cct_stage: [
        "assigned",
        "in_sourcing",
        "price_finalized",
        "order_placed",
        "in_transit",
        "delivered",
      ],
      chat_channel_type: ["dm", "branch", "group", "announcement"],
      customer_segment: ["platinum", "gold", "silver", "bronze", "inactive"],
      dispatch_document_type: [
        "invoice",
        "eway_bill",
        "awb",
        "packing_list",
        "other",
      ],
      enquiry_pricing_status: ["verified_auto", "pending", "updated"],
      enquiry_status: [
        "no_enquiry",
        "pending_prices",
        "partial_prices",
        "ready_to_quote",
        "quoted",
        "price_matched",
        "negotiating",
        "closed",
      ],
      escalation_level: ["none", "alert", "manager", "coo", "ceo"],
      holiday_type: ["national", "company", "regional", "optional"],
      integration_sync_status: ["success", "error", "pending"],
      integration_type: [
        "indiamart",
        "whatsapp",
        "justdial",
        "tradeindia",
        "email",
        "lead_config",
      ],
      lead_qualification_type: ["simple", "technical", "invalid"],
      lead_routing_target: ["spt", "tst", "discard", "nurture"],
      lead_source: [
        "indiamart",
        "justdial",
        "website",
        "whatsapp",
        "email",
        "referral",
        "manual",
        "tradeindia",
        "cro_followup",
      ],
      lead_status: [
        "new",
        "engaged",
        "quoted",
        "negotiation",
        "won",
        "lost",
        "contacted",
        "qualified",
        "proposal",
        "enquiry",
        "no_enquiry",
      ],
      office_location: ["delhi", "lucknow"],
      order_document_type: [
        "customer_po",
        "payment_receipt",
        "other",
        "tax_invoice",
        "eway_bill",
        "awb",
        "product_image",
      ],
      order_status: [
        "pending_documents",
        "ready_for_procurement",
        "in_procurement",
        "partially_fulfilled",
        "fulfilled",
        "ready_to_dispatch",
        "cancelled",
        "postponed",
      ],
      payment_mode: ["cash", "neft", "rtgs", "cheque", "upi", "card", "other"],
      payment_status: ["pending", "partial", "received"],
      price_request_status: ["pending", "in_progress", "resolved", "no_price"],
      price_request_tat_status: [
        "on_track",
        "reminder_sent",
        "escalated",
        "critical",
      ],
      procurement_metric: [
        "price_resolutions",
        "products_added",
        "po_count",
        "resolution_time_hours",
        "po_value",
      ],
      product_status: ["active", "discontinued", "obsolete"],
      subscription_payment_status: [
        "active",
        "expired",
        "cancelled",
        "pending",
      ],
      subscription_plan_type: ["monthly", "half_yearly", "annual"],
      subscription_status: ["trial", "active", "expired", "cancelled"],
      target_period_type: ["monthly", "quarterly"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      tenant_user_role: ["owner", "admin", "member"],
    },
  },
} as const
