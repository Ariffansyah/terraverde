// Mirrors supabase/migrations. Regenerate with:
// supabase gen types typescript --project-id <id> > lib/database.types.ts

export type OrderStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
  category: string;
  co2_savings_kg: number;
  sdg_target: string[];
  created_at: string;
};

type OrderRow = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  total_co2_saved: number;
  status: OrderStatus;
  shipping_address: string;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
};

type PaymentRow = {
  id: string;
  order_id: string;
  paymentku_reference: string | null;
  payment_method: string | null;
  status: string;
  checkout_url: string | null;
  created_at: string;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: Optional<ProductRow, "id" | "description" | "stock" | "image_url" | "co2_savings_kg" | "sdg_target" | "created_at">;
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Optional<OrderRow, "id" | "user_id" | "total_co2_saved" | "status" | "created_at">;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: Optional<OrderItemRow, "id">;
        Update: Partial<OrderItemRow>;
        Relationships: [
          { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: PaymentRow;
        Insert: Optional<PaymentRow, "id" | "paymentku_reference" | "payment_method" | "status" | "checkout_url" | "created_at">;
        Update: Partial<PaymentRow>;
        Relationships: [
          { foreignKeyName: "payments_order_id_fkey"; columns: ["order_id"]; isOneToOne: true; referencedRelation: "orders"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_order: {
        Args: {
          p_user_id: string | null;
          p_customer_name: string;
          p_customer_email: string;
          p_shipping_address: string;
          p_items: { product_id: string; quantity: number }[];
        };
        Returns: OrderRow;
      };
      settle_order: {
        Args: { p_order_id: string; p_status: Exclude<OrderStatus, "PENDING">; p_reference: string | null; p_payment_method: string | null };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Product = ProductRow;
