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
      ai_usage_events: {
        Row: {
          cost_units: number
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          cost_units?: number
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          cost_units?: number
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_profiles: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          display_name: string
          languages: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          display_name: string
          languages?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          display_name?: string
          languages?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_entitlements: {
        Row: {
          authorised_at: string
          captured_at: string | null
          confirmed_count: number
          created_at: string
          extended_at: string | null
          extension_seen_at: string | null
          fee_task_id: string | null
          id: string
          max_bookings: number
          rc_transaction_id: string | null
          rc_transaction_ids: string[]
          release_reason: string | null
          released_at: string | null
          source: string
          status: string
          stripe_payment_intent_id: string | null
          trip_dates_defaulted: boolean
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          authorised_at?: string
          captured_at?: string | null
          confirmed_count?: number
          created_at?: string
          extended_at?: string | null
          extension_seen_at?: string | null
          fee_task_id?: string | null
          id?: string
          max_bookings?: number
          rc_transaction_id?: string | null
          rc_transaction_ids?: string[]
          release_reason?: string | null
          released_at?: string | null
          source?: string
          status?: string
          stripe_payment_intent_id?: string | null
          trip_dates_defaulted?: boolean
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          authorised_at?: string
          captured_at?: string | null
          confirmed_count?: number
          created_at?: string
          extended_at?: string | null
          extension_seen_at?: string | null
          fee_task_id?: string | null
          id?: string
          max_bookings?: number
          rc_transaction_id?: string | null
          rc_transaction_ids?: string[]
          release_reason?: string | null
          released_at?: string | null
          source?: string
          status?: string
          stripe_payment_intent_id?: string | null
          trip_dates_defaulted?: boolean
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_entitlements_fee_task_id_fkey"
            columns: ["fee_task_id"]
            isOneToOne: true
            referencedRelation: "concierge_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["concierge_message_sender"]
          sender_id: string | null
          task_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["concierge_message_sender"]
          sender_id?: string | null
          task_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["concierge_message_sender"]
          sender_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "concierge_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_tasks: {
        Row: {
          amount_paid_cents: number | null
          assistant_id: string | null
          authorized_at: string | null
          booking_reference: string | null
          capture_method: string | null
          category: Database["public"]["Enums"]["concierge_task_category"]
          charge_amount_cents: number | null
          charge_currency: string | null
          city: string | null
          completed_at: string | null
          created_at: string
          currency: string
          details: string | null
          details_json: Json | null
          entitlement_id: string | null
          fx_rate_used: number | null
          hold_released_at: string | null
          id: string
          paid_at: string | null
          previous_status:
            | Database["public"]["Enums"]["concierge_task_status"]
            | null
          price_cents: number
          quoted_cny_cents: number | null
          quoted_gbp_cents: number | null
          refund_amount_cents: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["concierge_task_status"]
          stripe_env: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          stripe_session_id: string | null
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_cents?: number | null
          assistant_id?: string | null
          authorized_at?: string | null
          booking_reference?: string | null
          capture_method?: string | null
          category?: Database["public"]["Enums"]["concierge_task_category"]
          charge_amount_cents?: number | null
          charge_currency?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          details?: string | null
          details_json?: Json | null
          entitlement_id?: string | null
          fx_rate_used?: number | null
          hold_released_at?: string | null
          id?: string
          paid_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["concierge_task_status"]
            | null
          price_cents?: number
          quoted_cny_cents?: number | null
          quoted_gbp_cents?: number | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["concierge_task_status"]
          stripe_env?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_cents?: number | null
          assistant_id?: string | null
          authorized_at?: string | null
          booking_reference?: string | null
          capture_method?: string | null
          category?: Database["public"]["Enums"]["concierge_task_category"]
          charge_amount_cents?: number | null
          charge_currency?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          details?: string | null
          details_json?: Json | null
          entitlement_id?: string | null
          fx_rate_used?: number | null
          hold_released_at?: string | null
          id?: string
          paid_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["concierge_task_status"]
            | null
          price_cents?: number
          quoted_cny_cents?: number | null
          quoted_gbp_cents?: number | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["concierge_task_status"]
          stripe_env?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_tasks_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "booking_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          event_id: string
          id: string
          last_error: string | null
          provider_message_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          event_id: string
          id?: string
          last_error?: string | null
          provider_message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          last_error?: string | null
          provider_message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          dedupe_key: string
          event_key: string
          from_status: string | null
          id: string
          payload: Json
          processed_at: string | null
          task_id: string
          to_status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          event_key: string
          from_status?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          task_id: string
          to_status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          event_key?: string
          from_status?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          task_id?: string
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "concierge_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          locale: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          locale?: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          locale?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          already_in_china: boolean | null
          annual_active_until: string | null
          arrival_date: string | null
          card_linked: boolean
          created_at: string
          departure_date: string | null
          destination_city: string | null
          dietary_needs: string[]
          dining_budget: string | null
          display_name: string | null
          free_booking_task_id: string | null
          free_booking_used_at: string | null
          full_name: string | null
          hidden_from_home: string[]
          id: string
          interests: string[]
          nationality: string | null
          onboarding_completed: boolean
          phone: string | null
          preferred_currency: string
          pretrip_dismissed: boolean
          pretrip_hidden_until: string | null
          pretrip_tasks_done: string[]
          profile_setup_completed: boolean
          recently_recommended: string[]
          spice_level: number | null
          trip_pass_active_until: string | null
          updated_at: string
          user_id: string
          welcome_completed: boolean
        }
        Insert: {
          already_in_china?: boolean | null
          annual_active_until?: string | null
          arrival_date?: string | null
          card_linked?: boolean
          created_at?: string
          departure_date?: string | null
          destination_city?: string | null
          dietary_needs?: string[]
          dining_budget?: string | null
          display_name?: string | null
          free_booking_task_id?: string | null
          free_booking_used_at?: string | null
          full_name?: string | null
          hidden_from_home?: string[]
          id?: string
          interests?: string[]
          nationality?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          preferred_currency?: string
          pretrip_dismissed?: boolean
          pretrip_hidden_until?: string | null
          pretrip_tasks_done?: string[]
          profile_setup_completed?: boolean
          recently_recommended?: string[]
          spice_level?: number | null
          trip_pass_active_until?: string | null
          updated_at?: string
          user_id: string
          welcome_completed?: boolean
        }
        Update: {
          already_in_china?: boolean | null
          annual_active_until?: string | null
          arrival_date?: string | null
          card_linked?: boolean
          created_at?: string
          departure_date?: string | null
          destination_city?: string | null
          dietary_needs?: string[]
          dining_budget?: string | null
          display_name?: string | null
          free_booking_task_id?: string | null
          free_booking_used_at?: string | null
          full_name?: string | null
          hidden_from_home?: string[]
          id?: string
          interests?: string[]
          nationality?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          preferred_currency?: string
          pretrip_dismissed?: boolean
          pretrip_hidden_until?: string | null
          pretrip_tasks_done?: string[]
          profile_setup_completed?: boolean
          recently_recommended?: string[]
          spice_level?: number | null
          trip_pass_active_until?: string | null
          updated_at?: string
          user_id?: string
          welcome_completed?: boolean
        }
        Relationships: []
      }
      retained_transaction_records: {
        Row: {
          account_deleted_at: string
          amount_cents: number | null
          category: string | null
          created_at: string
          currency: string | null
          former_user_id: string
          id: string
          occurred_at: string | null
          source_id: string | null
          source_table: string
          status: string | null
          stripe_env: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          account_deleted_at?: string
          amount_cents?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          former_user_id: string
          id?: string
          occurred_at?: string | null
          source_id?: string | null
          source_table: string
          status?: string | null
          stripe_env?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          account_deleted_at?: string
          amount_cents?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          former_user_id?: string
          id?: string
          occurred_at?: string | null
          source_id?: string | null
          source_table?: string
          status?: string | null
          stripe_env?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      revenuecat_dead_letters: {
        Row: {
          app_user_id: string | null
          event_type: string | null
          id: string
          raw_event: Json
          reason: string
          received_at: string
          replay_result: string | null
          replayed_at: string | null
          transaction_id: string | null
        }
        Insert: {
          app_user_id?: string | null
          event_type?: string | null
          id?: string
          raw_event: Json
          reason: string
          received_at?: string
          replay_result?: string | null
          replayed_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          app_user_id?: string | null
          event_type?: string | null
          id?: string
          raw_event?: Json
          reason?: string
          received_at?: string
          replay_result?: string | null
          replayed_at?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      saved_plans: {
        Row: {
          city: string | null
          created_at: string
          id: string
          mood: string | null
          plan: Json
          time_budget_hours: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          plan: Json
          time_budget_hours?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          plan?: Json
          time_budget_hours?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trip_passes: {
        Row: {
          amount_paid_usd_cents: number
          charge_amount_cents: number | null
          charge_currency: string | null
          created_at: string
          days_billed: number
          days_total: number
          fx_rate_used: number | null
          id: string
          purchased_at: string
          quoted_gbp_cents: number | null
          rc_app_user_id: string | null
          rc_environment: string | null
          rc_transaction_id: string | null
          source: string | null
          status: string
          stripe_env: string | null
          stripe_payment_id: string | null
          stripe_session_id: string | null
          trip_end_date: string
          trip_start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_usd_cents: number
          charge_amount_cents?: number | null
          charge_currency?: string | null
          created_at?: string
          days_billed: number
          days_total: number
          fx_rate_used?: number | null
          id?: string
          purchased_at?: string
          quoted_gbp_cents?: number | null
          rc_app_user_id?: string | null
          rc_environment?: string | null
          rc_transaction_id?: string | null
          source?: string | null
          status?: string
          stripe_env?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          trip_end_date: string
          trip_start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_usd_cents?: number
          charge_amount_cents?: number | null
          charge_currency?: string | null
          created_at?: string
          days_billed?: number
          days_total?: number
          fx_rate_used?: number | null
          id?: string
          purchased_at?: string
          quoted_gbp_cents?: number | null
          rc_app_user_id?: string | null
          rc_environment?: string | null
          rc_transaction_id?: string | null
          source?: string | null
          status?: string
          stripe_env?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          trip_end_date?: string
          trip_start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      venue_images: {
        Row: {
          created_at: string
          id: string
          path: string
          sort_order: number
          source: string | null
          venue_slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          sort_order: number
          source?: string | null
          venue_slug: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          sort_order?: number
          source?: string | null
          venue_slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_entitlement_extension: { Args: { _id: string }; Returns: undefined }
      ai_rate_check: {
        Args: {
          _cost_units: number
          _daily_unit_cap: number
          _function_name: string
          _hourly_limit: number
          _user_id: string
        }
        Returns: Json
      }
      booking_entitlement_state: {
        Args: { user_uuid: string }
        Returns: {
          authorised_at: string
          captured_at: string
          confirmed_count: number
          extended_at: string
          extension_seen_at: string
          id: string
          max_bookings: number
          rc_transaction_ids: string[]
          source: string
          status: string
          trip_dates_defaulted: boolean
          valid_from: string
          valid_until: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_user_data: { Args: { _user_id: string }; Returns: Json }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_pickup_reminders: { Args: never; Returns: undefined }
      expire_authorised_holds_dispatch: { Args: never; Returns: undefined }
      expire_unpaid_transfers: { Args: never; Returns: undefined }
      has_ai_access: { Args: { user_uuid: string }; Returns: boolean }
      has_booking_allowance: { Args: { user_uuid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      ops_pass_holders: {
        Args: { user_ids: string[] }
        Returns: {
          user_id: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      restaurant_access_state: {
        Args: { user_uuid: string }
        Returns: {
          free_booking_available: boolean
          has_pass: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "concierge_assistant"
      concierge_message_sender: "user" | "assistant" | "system"
      concierge_task_category:
        | "restaurant_reservation"
        | "scenic_tickets"
        | "virtual_queue"
        | "trip_planning"
        | "hospital_booking"
        | "chinese_number_required"
        | "other"
        | "transfer"
      concierge_task_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "confirming"
        | "confirmed"
        | "change_pending"
        | "pay_to_confirm"
        | "unavailable"
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
      app_role: ["admin", "moderator", "user", "concierge_assistant"],
      concierge_message_sender: ["user", "assistant", "system"],
      concierge_task_category: [
        "restaurant_reservation",
        "scenic_tickets",
        "virtual_queue",
        "trip_planning",
        "hospital_booking",
        "chinese_number_required",
        "other",
        "transfer",
      ],
      concierge_task_status: [
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "confirming",
        "confirmed",
        "change_pending",
        "pay_to_confirm",
        "unavailable",
      ],
    },
  },
} as const
