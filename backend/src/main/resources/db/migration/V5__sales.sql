CREATE TABLE sales (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 branch_id uuid NOT NULL REFERENCES branches(id), user_id uuid NOT NULL REFERENCES app_users(id),
 subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0), tax numeric(12,2) NOT NULL DEFAULT 0 CHECK(tax >= 0),
 total numeric(12,2) NOT NULL CHECK(total >= 0), status text NOT NULL DEFAULT 'COMPLETED'
   CHECK(status IN ('COMPLETED','CANCELLED')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sale_items (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES tenants(id), product_id uuid NOT NULL REFERENCES products(id),
 quantity integer NOT NULL CHECK(quantity > 0), unit_price numeric(12,2) NOT NULL CHECK(unit_price >= 0),
 line_total numeric(12,2) NOT NULL CHECK(line_total >= 0)
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES tenants(id), payment_method text NOT NULL
   CHECK(payment_method IN ('CASH','CARD','TRANSFER','OTHER')), amount numeric(12,2) NOT NULL CHECK(amount > 0)
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY; ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY; ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY; ALTER TABLE sale_items FORCE ROW LEVEL SECURITY; ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY sales_tenant ON sales USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY sale_items_tenant ON sale_items USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY payments_tenant ON payments USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE INDEX sales_tenant_branch_created ON sales(tenant_id,branch_id,created_at DESC);
