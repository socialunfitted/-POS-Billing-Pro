-- ============================================================
-- SUPABASE SUBSCRIPTION & LICENSE MANAGEMENT DATABASE SCHEMA
-- Compatible with PostgreSQL & Supabase Auth
-- ============================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    gstin VARCHAR(32),
    logo_base64 TEXT,
    status VARCHAR(32) DEFAULT 'Trial' CHECK (status IN ('Trial', 'Active', 'Expired', 'Suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthly_price NUMERIC(10, 2) NOT NULL,
    yearly_price NUMERIC(10, 2) NOT NULL,
    trial_days INT DEFAULT 14,
    features JSONB DEFAULT '[]'::jsonb,
    device_limit INT DEFAULT 3,
    display_order INT DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    business_id VARCHAR(64) REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan_id VARCHAR(64) REFERENCES public.plans(id),
    status VARCHAR(32) DEFAULT 'Trial' CHECK (status IN ('Trial', 'Active', 'Expired', 'Suspended', 'Cancelled')),
    billing_cycle VARCHAR(32) DEFAULT 'Monthly' CHECK (billing_cycle IN ('Monthly', 'Yearly')),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    grace_period_days INT DEFAULT 3,
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LICENSES TABLE
CREATE TABLE IF NOT EXISTS public.licenses (
    id VARCHAR(64) PRIMARY KEY,
    business_id VARCHAR(64) REFERENCES public.businesses(id) ON DELETE CASCADE,
    license_key VARCHAR(128) NOT NULL UNIQUE,
    max_devices INT DEFAULT 3,
    active_devices INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'Active' CHECK (status IN ('Active', 'Trial', 'Expired', 'Suspended', 'Revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.devices (
    id VARCHAR(64) PRIMARY KEY,
    business_id VARCHAR(64) REFERENCES public.businesses(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    browser VARCHAR(100),
    platform VARCHAR(100),
    status VARCHAR(32) DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled', 'Revoked')),
    last_login_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id VARCHAR(64) PRIMARY KEY,
    business_id VARCHAR(64) REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan_id VARCHAR(64) REFERENCES public.plans(id),
    invoice_no VARCHAR(64) NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    billing_cycle VARCHAR(32) DEFAULT 'Monthly',
    payment_method VARCHAR(50) DEFAULT 'UPI / QR',
    utr_ref VARCHAR(128),
    status VARCHAR(32) DEFAULT 'Pending Verification' CHECK (status IN ('Pending Verification', 'Verified', 'Rejected', 'Refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

-- 7. RENEWALS LOG TABLE
CREATE TABLE IF NOT EXISTS public.renewals (
    id VARCHAR(64) PRIMARY KEY,
    business_id VARCHAR(64) REFERENCES public.businesses(id) ON DELETE CASCADE,
    payment_id VARCHAR(64) REFERENCES public.payments(id),
    previous_expiry TIMESTAMPTZ,
    new_expiry TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_business VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(64),
    user_agent TEXT
);

-- 9. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'super_admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DEFAULT SUBSCRIPTION PLANS
-- ============================================================
INSERT INTO public.plans (id, name, monthly_price, yearly_price, trial_days, features, device_limit, display_order, active)
VALUES 
    ('plan_starter', 'Starter POS', 99.00, 999.00, 14, '["1 Device Allowed", "Full Offline Billing", "Thermal Receipt Printing", "Basic Inventory", "Sales Reports"]'::jsonb, 1, 1, TRUE),
    ('plan_standard', 'Standard Retail', 199.00, 1999.00, 14, '["3 Devices Allowed", "Dynamic UPI QR Payments", "Inventory Management", "Customer Ledger", "GST Reports"]'::jsonb, 3, 2, TRUE),
    ('plan_premium', 'Premium Supermarket', 399.00, 3999.00, 14, '["10 Devices Allowed", "High-Volume Catalog Support", "Priority Auto-Sync", "Advanced Analytics", "Dedicated Support"]'::jsonb, 10, 3, TRUE),
    ('plan_enterprise', 'Enterprise Custom', 799.00, 7999.00, 30, '["Unlimited Devices", "Custom Store Branding", "Multi-Tenant SaaS Support", "Custom API Integrations", "24/7 Phone Support"]'::jsonb, 99, 4, TRUE)
ON CONFLICT (id) DO UPDATE SET 
    monthly_price = EXCLUDED.monthly_price,
    yearly_price = EXCLUDED.yearly_price,
    features = EXCLUDED.features,
    device_limit = EXCLUDED.device_limit;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_biz ON public.subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_devices_biz ON public.devices(business_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow public read access to plans catalog
CREATE POLICY "Public Plans View" ON public.plans FOR SELECT USING (active = TRUE);

-- Allow authenticated/anon pos applications to register business & query subscription
CREATE POLICY "POS Business Insert" ON public.businesses FOR INSERT WITH CHECK (true);
CREATE POLICY "POS Business Select" ON public.businesses FOR SELECT USING (true);

CREATE POLICY "POS Subscription Select" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "POS Subscription Insert" ON public.subscriptions FOR INSERT WITH CHECK (true);

CREATE POLICY "POS License Select" ON public.licenses FOR SELECT USING (true);
CREATE POLICY "POS Payment Insert" ON public.payments FOR INSERT WITH CHECK (true);
