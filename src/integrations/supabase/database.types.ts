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
      vendors: {
        Row: {
          id: string
          name: string
          category: 'restaurant' | 'pharmacy' | 'market' | 'other'
          phone: string
          address: string
          is_active: boolean
          rating: number
          total_orders: number
          joined_at: string
          image: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: 'restaurant' | 'pharmacy' | 'market' | 'other'
          phone: string
          address: string
          is_active?: boolean
          rating?: number
          total_orders?: number
          joined_at?: string
          image?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: 'restaurant' | 'pharmacy' | 'market' | 'other'
          phone?: string
          address?: string
          is_active?: boolean
          rating?: number
          total_orders?: number
          joined_at?: string
          image?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_name: string
          customer_phone: string
          vendor_id: string
          items: Json
          total: number
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'
          address: string
          coordinates: Json | null
          estimated_delivery: string | null
          notes: string | null
          delivery_person_name: string | null
          delivery_person_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_name: string
          customer_phone: string
          vendor_id: string
          items: Json
          total: number
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'
          address: string
          coordinates?: Json | null
          estimated_delivery?: string | null
          notes?: string | null
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_name?: string
          customer_phone?: string
          vendor_id?: string
          items?: Json
          total?: number
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'
          address?: string
          coordinates?: Json | null
          estimated_delivery?: string | null
          notes?: string | null
          delivery_person_name?: string | null
          delivery_person_phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          order_id: string
          sender: 'customer' | 'vendor' | 'system'
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          sender: 'customer' | 'vendor' | 'system'
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          sender?: 'customer' | 'vendor' | 'system'
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: 'admin' | 'vendor' | 'customer'
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: 'admin' | 'vendor' | 'customer'
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: 'admin' | 'vendor' | 'customer'
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
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