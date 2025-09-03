# Configuración de Supabase para DeliveryHub

## Pasos para configurar la base de datos:

1. **Abre el SQL Editor de Supabase** en tu proyecto

2. **Copia y ejecuta este SQL:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'vendor', 'customer')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendors table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('restaurant', 'pharmacy', 'market', 'other')),
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    rating DECIMAL(3,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    image TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    items JSONB NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')),
    address TEXT NOT NULL,
    coordinates JSONB,
    estimated_delivery TIMESTAMPTZ,
    notes TEXT,
    delivery_person_name TEXT,
    delivery_person_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'vendor', 'system')),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_vendors_user_id ON vendors(user_id);
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_messages_order_id ON messages(order_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for vendors
CREATE POLICY "Anyone can view active vendors" ON vendors
    FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can update their own data" ON vendors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all vendors" ON vendors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for orders
CREATE POLICY "Vendors can view their orders" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = orders.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can update their orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = orders.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create orders" ON orders
    FOR INSERT WITH CHECK (true);

-- RLS Policies for messages
CREATE POLICY "Users can view messages for their orders" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            JOIN vendors ON vendors.id = orders.vendor_id
            WHERE orders.id = messages.order_id 
            AND vendors.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can send messages" ON messages
    FOR INSERT WITH CHECK (true);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

## Estructura de las tablas:

- **profiles**: Información de usuarios (clientes, vendedores, admins)
- **vendors**: Datos de los vendedores/comercios
- **orders**: Pedidos con estados y tracking
- **messages**: Chat entre clientes y vendedores

## Políticas de seguridad (RLS):

- Los usuarios solo pueden ver y editar su propio perfil
- Los vendedores pueden gestionar sus propios pedidos
- Los administradores tienen acceso completo
- Cualquiera puede ver vendedores activos y crear pedidos

## Próximos pasos:

1. Ejecuta el SQL en Supabase
2. Las credenciales de Supabase ya deberían estar configuradas automáticamente
3. El sistema está listo para autenticación y gestión de datos en tiempo real