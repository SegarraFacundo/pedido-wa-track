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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          message: string
          sender_type: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          message: string
          sender_type: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          message?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "vendor_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          pending_address: string | null
          pending_products: Json | null
          phone: string
          selected_product: Json | null
          selected_quantity: number | null
          updated_at: string
          vendor_preference: string | null
        }
        Insert: {
          pending_address?: string | null
          pending_products?: Json | null
          phone: string
          selected_product?: Json | null
          selected_quantity?: number | null
          updated_at?: string
          vendor_preference?: string | null
        }
        Update: {
          pending_address?: string | null
          pending_products?: Json | null
          phone?: string
          selected_product?: Json | null
          selected_quantity?: number | null
          updated_at?: string
          vendor_preference?: string | null
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          commission_percentage: number | null
          commission_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          subscription_monthly_fee: number | null
          subscription_orders_included: number | null
          subscription_plan_id: string | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          commission_percentage?: number | null
          commission_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          subscription_monthly_fee?: number | null
          subscription_orders_included?: number | null
          subscription_plan_id?: string | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          commission_percentage?: number | null
          commission_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          subscription_monthly_fee?: number | null
          subscription_orders_included?: number | null
          subscription_plan_id?: string | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string | null
          customer_address: string
          customer_name: string
          customer_phone: string
          id: string
          order_id: string
        }
        Insert: {
          created_at?: string | null
          customer_address: string
          customer_name: string
          customer_phone: string
          id?: string
          order_id: string
        }
        Update: {
          created_at?: string | null
          customer_address?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_messages: {
        Row: {
          created_at: string | null
          customer_phone: string
          id: string
          message: string
          read: boolean | null
        }
        Insert: {
          created_at?: string | null
          customer_phone: string
          id?: string
          message: string
          read?: boolean | null
        }
        Update: {
          created_at?: string | null
          customer_phone?: string
          id?: string
          message?: string
          read?: boolean | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          order_id: string
          sender: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id: string
          sender: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          payment_date: string | null
          payment_method_id: string | null
          payment_method_name: string
          status: string | null
          transaction_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          payment_date?: string | null
          payment_method_id?: string | null
          payment_method_name: string
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          payment_date?: string | null
          payment_method_id?: string | null
          payment_method_name?: string
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string
          created_at: string | null
          id: string
          order_id: string
          reason: string | null
          status: string
        }
        Insert: {
          changed_by: string
          created_at?: string | null
          id?: string
          order_id: string
          reason?: string | null
          status: string
        }
        Update: {
          changed_by?: string
          created_at?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          coordinates: Json | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          delivery_person_name: string | null
          delivery_person_phone: string | null
          estimated_delivery: string | null
          id: string
          items: Json
          notes: string | null
          paid_at: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_receipt_url: string | null
          payment_status: string | null
          status: string | null
          total: number
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          address: string
          coordinates?: Json | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          estimated_delivery?: string | null
          id?: string
          items: Json
          notes?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          status?: string | null
          total: number
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          address?: string
          coordinates?: Json | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          estimated_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          status?: string | null
          total?: number
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          image: string | null
          is_available: boolean | null
          name: string
          price: number
          stock_enabled: boolean | null
          stock_quantity: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_available?: boolean | null
          name: string
          price: number
          stock_enabled?: boolean | null
          stock_quantity?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_available?: boolean | null
          name?: string
          price?: number
          stock_enabled?: boolean | null
          stock_quantity?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          commission_after_limit: number
          created_at: string | null
          id: string
          is_active: boolean | null
          monthly_fee: number
          name: string
          orders_included: number
        }
        Insert: {
          commission_after_limit: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_fee: number
          name: string
          orders_included: number
        }
        Update: {
          commission_after_limit?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_fee?: number
          name?: string
          orders_included?: number
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          assigned_vendor_phone: string | null
          created_at: string | null
          in_vendor_chat: boolean | null
          last_bot_message: string | null
          location_updated_at: string | null
          phone: string
          previous_state: string | null
          updated_at: string | null
          user_latitude: number | null
          user_longitude: number | null
        }
        Insert: {
          assigned_vendor_phone?: string | null
          created_at?: string | null
          in_vendor_chat?: boolean | null
          last_bot_message?: string | null
          location_updated_at?: string | null
          phone: string
          previous_state?: string | null
          updated_at?: string | null
          user_latitude?: number | null
          user_longitude?: number | null
        }
        Update: {
          assigned_vendor_phone?: string | null
          created_at?: string | null
          in_vendor_chat?: boolean | null
          last_bot_message?: string | null
          location_updated_at?: string | null
          phone?: string
          previous_state?: string | null
          updated_at?: string | null
          user_latitude?: number | null
          user_longitude?: number | null
        }
        Relationships: []
      }
      vendor_chats: {
        Row: {
          created_at: string | null
          customer_phone: string
          ended_at: string | null
          id: string
          is_active: boolean | null
          started_at: string | null
          vendor_agent_name: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          customer_phone: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          vendor_agent_name?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          customer_phone?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          vendor_agent_name?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_chats_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_chats_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_chats_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_commissions: {
        Row: {
          commission_amount: number
          commission_percentage: number | null
          commission_type: string
          created_at: string | null
          id: string
          order_id: string
          order_total: number
          paid_at: string | null
          status: string | null
          vendor_id: string
        }
        Insert: {
          commission_amount: number
          commission_percentage?: number | null
          commission_type: string
          created_at?: string | null
          id?: string
          order_id: string
          order_total: number
          paid_at?: string | null
          status?: string | null
          vendor_id: string
        }
        Update: {
          commission_amount?: number
          commission_percentage?: number | null
          commission_type?: string
          created_at?: string | null
          id?: string
          order_id?: string
          order_total?: number
          paid_at?: string | null
          status?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_hours: {
        Row: {
          closing_time: string
          created_at: string | null
          day_of_week: string
          id: string
          is_closed: boolean | null
          is_open_24_hours: boolean | null
          opening_time: string
          slot_number: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          closing_time: string
          created_at?: string | null
          day_of_week: string
          id?: string
          is_closed?: boolean | null
          is_open_24_hours?: boolean | null
          opening_time: string
          slot_number?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          closing_time?: string
          created_at?: string | null
          day_of_week?: string
          id?: string
          is_closed?: boolean | null
          is_open_24_hours?: boolean | null
          opening_time?: string
          slot_number?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_hours_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_hours_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_hours_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          order_id: string
          sent_at: string | null
          status: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          order_id: string
          sent_at?: string | null
          status?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string
          sent_at?: string | null
          status?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_offers: {
        Row: {
          created_at: string | null
          description: string
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          offer_price: number | null
          original_price: number | null
          title: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          offer_price?: number | null
          original_price?: number | null
          title: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          offer_price?: number | null
          original_price?: number | null
          title?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string
          delivery_rating: number | null
          id: string
          order_id: string | null
          product_rating: number | null
          rating: number | null
          service_rating: number | null
          vendor_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone: string
          delivery_rating?: number | null
          id?: string
          order_id?: string | null
          product_rating?: number | null
          rating?: number | null
          service_rating?: number | null
          vendor_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string
          delivery_rating?: number | null
          id?: string
          order_id?: string | null
          product_rating?: number | null
          rating?: number | null
          service_rating?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vendor_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string
          available_products: Json | null
          average_rating: number | null
          category: string
          closing_time: string | null
          created_at: string | null
          days_open: string[] | null
          delivery_radius_km: number | null
          id: string
          image: string | null
          is_active: boolean | null
          joined_at: string | null
          last_payment_date: string | null
          latitude: number | null
          longitude: number | null
          name: string
          next_payment_due: string | null
          opening_time: string | null
          payment_status: string | null
          phone: string
          rating: number | null
          suspended_reason: string | null
          total_orders: number | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address: string
          available_products?: Json | null
          average_rating?: number | null
          category: string
          closing_time?: string | null
          created_at?: string | null
          days_open?: string[] | null
          delivery_radius_km?: number | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          last_payment_date?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          next_payment_due?: string | null
          opening_time?: string | null
          payment_status?: string | null
          phone: string
          rating?: number | null
          suspended_reason?: string | null
          total_orders?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string
          available_products?: Json | null
          average_rating?: number | null
          category?: string
          closing_time?: string | null
          created_at?: string | null
          days_open?: string[] | null
          delivery_radius_km?: number | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          last_payment_date?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          next_payment_due?: string | null
          opening_time?: string | null
          payment_status?: string | null
          phone?: string
          rating?: number | null
          suspended_reason?: string | null
          total_orders?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_vendors: {
        Row: {
          address_area: string | null
          available_products: Json | null
          category: string | null
          closing_time: string | null
          days_open: string[] | null
          has_products: boolean | null
          id: string | null
          image: string | null
          is_active: boolean | null
          joined_at: string | null
          name: string | null
          opening_time: string | null
          rating: number | null
          total_orders: number | null
        }
        Insert: {
          address_area?: never
          available_products?: never
          category?: string | null
          closing_time?: string | null
          days_open?: string[] | null
          has_products?: never
          id?: string | null
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          opening_time?: string | null
          rating?: number | null
          total_orders?: number | null
        }
        Update: {
          address_area?: never
          available_products?: never
          category?: string | null
          closing_time?: string | null
          days_open?: string[] | null
          has_products?: never
          id?: string | null
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          opening_time?: string | null
          rating?: number | null
          total_orders?: number | null
        }
        Relationships: []
      }
      vendor_details: {
        Row: {
          address: string | null
          available_products: Json | null
          average_rating: number | null
          category: string | null
          closing_time: string | null
          created_at: string | null
          days_open: string[] | null
          full_address: string | null
          full_phone: string | null
          full_whatsapp: string | null
          id: string | null
          image: string | null
          is_active: boolean | null
          joined_at: string | null
          name: string | null
          opening_time: string | null
          phone: string | null
          rating: number | null
          total_orders: number | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          available_products?: Json | null
          average_rating?: number | null
          category?: string | null
          closing_time?: string | null
          created_at?: string | null
          days_open?: string[] | null
          full_address?: never
          full_phone?: never
          full_whatsapp?: never
          id?: string | null
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          available_products?: Json | null
          average_rating?: number | null
          category?: string | null
          closing_time?: string | null
          created_at?: string | null
          days_open?: string[] | null
          full_address?: never
          full_phone?: never
          full_whatsapp?: never
          id?: string | null
          image?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      vendor_orders_view: {
        Row: {
          address_simplified: string | null
          coordinates: Json | null
          created_at: string | null
          customer_name_masked: string | null
          customer_phone_masked: string | null
          delivery_person_name: string | null
          delivery_person_phone: string | null
          estimated_delivery: string | null
          id: string | null
          items: Json | null
          notes: string | null
          status: string | null
          total: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          address_simplified?: never
          coordinates?: Json | null
          created_at?: string | null
          customer_name_masked?: never
          customer_phone_masked?: never
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          estimated_delivery?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          address_simplified?: never
          coordinates?: Json | null
          created_at?: string | null
          customer_name_masked?: never
          customer_phone_masked?: never
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          estimated_delivery?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string | null
          rating: number | null
          vendor_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_name?: never
          customer_phone?: never
          id?: string | null
          rating?: number | null
          vendor_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_name?: never
          customer_phone?: never
          id?: string | null
          rating?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      change_order_status: {
        Args: {
          p_changed_by: string
          p_new_status: string
          p_order_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      cleanup_old_sessions: { Args: never; Returns: number }
      get_masked_phone: { Args: { phone: string }; Returns: string }
      get_order_customer_details: {
        Args: { order_id_param: string }
        Returns: {
          customer_address: string
          customer_name: string
          customer_phone: string
        }[]
      }
      get_products_by_category: {
        Args: { category_filter?: string }
        Returns: {
          is_available: boolean
          product_category: string
          product_description: string
          product_id: string
          product_name: string
          product_price: number
          vendor_id: string
          vendor_is_open: boolean
          vendor_name: string
          vendor_rating: number
        }[]
      }
      get_simplified_address: {
        Args: { full_address: string }
        Returns: string
      }
      get_vendors_in_range: {
        Args: { user_lat: number; user_lon: number }
        Returns: {
          delivery_radius_km: number
          distance_km: number
          is_open: boolean
          vendor_id: string
          vendor_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_vendor_to_user: { Args: { vendor_email: string }; Returns: string }
      make_user_admin: { Args: { user_email: string }; Returns: string }
      make_user_soporte: { Args: { user_email: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "vendor" | "customer" | "soporte"
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
      app_role: ["admin", "vendor", "customer", "soporte"],
    },
  },
} as const
