-- SQL Script to create a Read-Only user for your SQL Chatbot in Supabase
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create the dedicated user
-- Replace 'YOUR_SAFE_PASSWORD' with a strong password
CREATE USER chatbot_readonly WITH PASSWORD 'YOUR_SAFE_PASSWORD';

-- 2. Grant access to the public schema
GRANT USAGE ON SCHEMA public TO chatbot_readonly;

-- 3. Grant SELECT (read-only) access to all current tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO chatbot_readonly;

-- 4. Ensure future tables also grant SELECT access to this user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO chatbot_readonly;

-- 5. (Optional) If you have other schemas like 'analytics', repeat for them:
-- GRANT USAGE ON SCHEMA analytics TO chatbot_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO chatbot_readonly;

-- NOTE: After running this, update your backend/.env:
-- SUPABASE_DATABASE_URL=postgresql://chatbot_readonly:YOUR_SAFE_PASSWORD@your-db-host:5432/postgres?sslmode=require
