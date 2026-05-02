-- ============================================
-- RENTAL MANAGER — SUPABASE SCHEMA
-- Run this in Supabase > SQL Editor
-- ============================================

-- Properties table
create table properties (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  address text not null,
  tenant text,
  phone text,
  rent numeric not null default 0,
  pay_day integer not null default 1,
  services text[] default '{}',
  created_at timestamptz default now()
);

-- Charges table
create table charges (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id) on delete cascade,
  month text not null,
  year integer not null,
  rent numeric not null default 0,
  services jsonb default '{}',
  total numeric not null default 0,
  status text not null default 'pending', -- pending | paid | overdue
  note text,
  receipt_url text,
  wa_sent boolean default false,
  paid_on timestamptz,
  created_at timestamptz default now(),
  unique(property_id, month, year)
);

-- Notes table
create table notes (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- Storage bucket for receipts (run in Supabase > Storage)
-- Create a bucket called: receipts
-- Set it to PUBLIC

-- Enable RLS (Row Level Security) — simple open policy for single-user app
alter table properties enable row level security;
alter table charges enable row level security;
alter table notes enable row level security;

create policy "Allow all" on properties for all using (true) with check (true);
create policy "Allow all" on charges for all using (true) with check (true);
create policy "Allow all" on notes for all using (true) with check (true);
