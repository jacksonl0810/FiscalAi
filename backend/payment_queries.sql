-- ============================================
-- PAYMENT-RELATED DATABASE QUERIES
-- ============================================
-- Use these queries to inspect all payment-related fields across the database

-- ============================================
-- 1. PAYMENT TABLE (Main Transaction Records)
-- ============================================
-- Shows all payment transactions with subscription details

SELECT 
    p.id,
    p.subscription_id,
    p.pagar_me_transaction_id,
    p.amount,
    p.status AS payment_status,
    p.payment_method,
    p.paid_at,
    p.failed_at,
    p.nfse_id,
    p.created_at,
    p.updated_at,
    -- Subscription details
    s.user_id,
    s.plan_id,
    s.status AS subscription_status,
    s.billing_cycle,
    s.current_period_start,
    s.current_period_end,
    -- User details
    u.email,
    u.name AS user_name
FROM payments p
LEFT JOIN subscriptions s ON p.subscription_id = s.id
LEFT JOIN users u ON s.user_id = u.id
ORDER BY p.created_at DESC;

-- Count payments by status
SELECT 
    status,
    COUNT(*) AS count,
    SUM(amount) AS total_amount
FROM payments
GROUP BY status
ORDER BY count DESC;

-- Recent payments (last 30 days)
SELECT 
    p.id,
    p.pagar_me_transaction_id,
    p.amount,
    p.status,
    p.payment_method,
    p.paid_at,
    u.email,
    s.plan_id,
    s.status AS subscription_status
FROM payments p
LEFT JOIN subscriptions s ON p.subscription_id = s.id
LEFT JOIN users u ON s.user_id = u.id
WHERE p.created_at >= NOW() - INTERVAL '30 days'
ORDER BY p.created_at DESC;

-- Failed payments
SELECT 
    p.id,
    p.pagar_me_transaction_id,
    p.amount,
    p.failed_at,
    u.email,
    s.plan_id,
    s.status AS subscription_status
FROM payments p
LEFT JOIN subscriptions s ON p.subscription_id = s.id
LEFT JOIN users u ON s.user_id = u.id
WHERE p.status = 'failed'
ORDER BY p.failed_at DESC;

-- ============================================
-- 2. SUBSCRIPTION TABLE (Subscription State)
-- ============================================
-- Shows all subscriptions with payment summary

SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.pagar_me_subscription_id,
    s.pagar_me_plan_id,
    s.status,
    s.billing_cycle,
    s.annual_discount_applied,
    s.current_period_start,
    s.current_period_end,
    s.canceled_at,
    s.trial_ends_at,
    s.created_at,
    s.updated_at,
    -- User details
    u.email,
    u.name AS user_name,
    u.pagar_me_customer_id,
    u.has_used_trial,
    u.trial_started_at,
    u.trial_ended_at,
    -- Payment summary
    COUNT(p.id) AS total_payments,
    COUNT(CASE WHEN p.status = 'paid' THEN 1 END) AS successful_payments,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) AS failed_payments,
    SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) AS total_paid_amount
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN payments p ON p.subscription_id = s.id
GROUP BY s.id, u.id
ORDER BY s.created_at DESC;

-- Subscriptions by status
SELECT 
    status,
    COUNT(*) AS count,
    COUNT(CASE WHEN billing_cycle = 'monthly' THEN 1 END) AS monthly_count,
    COUNT(CASE WHEN billing_cycle = 'annual' THEN 1 END) AS annual_count
FROM subscriptions
GROUP BY status
ORDER BY count DESC;

-- Active subscriptions with payment info
SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.status,
    s.billing_cycle,
    s.current_period_start,
    s.current_period_end,
    u.email,
    u.name,
    -- Last payment
    MAX(p.paid_at) AS last_payment_date,
    MAX(p.amount) AS last_payment_amount
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN payments p ON p.subscription_id = s.id AND p.status = 'paid'
WHERE s.status = 'ativo'
GROUP BY s.id, u.id
ORDER BY s.current_period_end DESC;

-- Expiring subscriptions (next 7 days)
SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.status,
    s.current_period_end,
    u.email,
    u.name,
    (s.current_period_end - NOW())::interval AS days_remaining
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.status = 'ativo'
  AND s.current_period_end IS NOT NULL
  AND s.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY s.current_period_end ASC;

-- ============================================
-- 3. INVOICE_USAGE TABLE (Pay-Per-Use Transactions)
-- ============================================
-- Shows pay-per-use invoice charges

SELECT 
    iu.id,
    iu.user_id,
    iu.company_id,
    iu.invoice_id,
    iu.plan_id,
    iu.period_year,
    iu.period_month,
    iu.amount,
    iu.status,
    iu.payment_order_id,
    iu.created_at,
    -- User details
    u.email,
    u.name AS user_name,
    -- Company details
    c.razao_social,
    c.cnpj,
    -- Invoice details
    inv.numero AS invoice_number,
    inv.valor AS invoice_value
FROM invoice_usage iu
LEFT JOIN users u ON iu.user_id = u.id
LEFT JOIN companies c ON iu.company_id = c.id
LEFT JOIN invoices inv ON iu.invoice_id = inv.id
ORDER BY iu.created_at DESC;

-- Pay-per-use summary by status
SELECT 
    status,
    COUNT(*) AS count,
    SUM(amount) AS total_amount_cents,
    SUM(amount) / 100.0 AS total_amount_reais
FROM invoice_usage
GROUP BY status
ORDER BY count DESC;

-- Pay-per-use by period
SELECT 
    period_year,
    period_month,
    COUNT(*) AS invoice_count,
    SUM(amount) AS total_amount_cents,
    SUM(amount) / 100.0 AS total_amount_reais,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
    COUNT(CASE WHEN status = 'pending_payment' THEN 1 END) AS pending_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count
FROM invoice_usage
GROUP BY period_year, period_month
ORDER BY period_year DESC, period_month DESC;

-- ============================================
-- 4. USER TABLE (Payment-Related Fields)
-- ============================================
-- Shows users with payment-related information

SELECT 
    u.id,
    u.email,
    u.name,
    u.pagar_me_customer_id,
    u.cpf_cnpj,
    u.has_used_trial,
    u.trial_started_at,
    u.trial_ended_at,
    u.created_at,
    -- Subscription info
    s.id AS subscription_id,
    s.plan_id,
    s.status AS subscription_status,
    s.billing_cycle,
    s.current_period_end,
    -- Payment summary
    COUNT(p.id) AS total_payments,
    SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) AS total_paid_amount
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN payments p ON p.subscription_id = s.id
GROUP BY u.id, s.id
ORDER BY u.created_at DESC;

-- Users with Pagar.me customer ID but no subscription
SELECT 
    u.id,
    u.email,
    u.name,
    u.pagar_me_customer_id,
    u.created_at
FROM users u
WHERE u.pagar_me_customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
  )
ORDER BY u.created_at DESC;

-- Users who used trial
SELECT 
    u.id,
    u.email,
    u.name,
    u.has_used_trial,
    u.trial_started_at,
    u.trial_ended_at,
    s.plan_id AS current_plan,
    s.status AS subscription_status
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.has_used_trial = true
ORDER BY u.trial_started_at DESC;

-- ============================================
-- 5. INVOICE TABLE (Payment Fields)
-- ============================================
-- Shows invoices with payment status

SELECT 
    inv.id,
    inv.company_id,
    inv.numero,
    inv.valor,
    inv.status AS invoice_status,
    inv.payment_status,
    inv.payment_order_id,
    inv.created_at,
    -- Company details
    c.razao_social,
    c.cnpj,
    c.user_id,
    -- User details
    u.email,
    u.name AS user_name,
    -- Invoice usage (pay-per-use)
    iu.id AS invoice_usage_id,
    iu.status AS invoice_usage_status,
    iu.payment_order_id AS invoice_usage_payment_order_id
FROM invoices inv
LEFT JOIN companies c ON inv.company_id = c.id
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN invoice_usage iu ON inv.id = iu.invoice_id
ORDER BY inv.created_at DESC;

-- Invoices with payment status
SELECT 
    payment_status,
    COUNT(*) AS count,
    SUM(valor) AS total_value
FROM invoices
WHERE payment_status IS NOT NULL
GROUP BY payment_status
ORDER BY count DESC;

-- ============================================
-- 6. COMPREHENSIVE PAYMENT OVERVIEW
-- ============================================
-- Complete payment overview with all related data

SELECT 
    -- User info
    u.id AS user_id,
    u.email,
    u.name AS user_name,
    u.pagar_me_customer_id,
    u.has_used_trial,
    -- Subscription info
    s.id AS subscription_id,
    s.plan_id,
    s.status AS subscription_status,
    s.billing_cycle,
    s.pagar_me_subscription_id,
    s.current_period_start,
    s.current_period_end,
    s.canceled_at,
    -- Payment summary
    COUNT(DISTINCT p.id) AS total_payments,
    COUNT(DISTINCT CASE WHEN p.status = 'paid' THEN p.id END) AS successful_payments,
    COUNT(DISTINCT CASE WHEN p.status = 'failed' THEN p.id END) AS failed_payments,
    SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) AS total_paid_amount,
    MAX(p.paid_at) AS last_payment_date,
    -- Pay-per-use summary
    COUNT(DISTINCT iu.id) AS pay_per_use_charges,
    COUNT(DISTINCT CASE WHEN iu.status = 'paid' THEN iu.id END) AS pay_per_use_paid,
    SUM(CASE WHEN iu.status = 'paid' THEN iu.amount ELSE 0 END) AS pay_per_use_total_cents
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN payments p ON p.subscription_id = s.id
LEFT JOIN invoice_usage iu ON iu.user_id = u.id
GROUP BY u.id, s.id
ORDER BY u.created_at DESC;

-- ============================================
-- 7. REVENUE ANALYSIS
-- ============================================
-- Revenue breakdown by plan and status

SELECT 
    s.plan_id,
    s.billing_cycle,
    p.status AS payment_status,
    COUNT(p.id) AS payment_count,
    SUM(p.amount) AS total_revenue,
    AVG(p.amount) AS avg_payment_amount,
    MIN(p.paid_at) AS first_payment,
    MAX(p.paid_at) AS last_payment
FROM payments p
LEFT JOIN subscriptions s ON p.subscription_id = s.id
WHERE p.status = 'paid'
GROUP BY s.plan_id, s.billing_cycle, p.status
ORDER BY total_revenue DESC;

-- Monthly revenue summary
SELECT 
    DATE_TRUNC('month', p.paid_at) AS month,
    COUNT(p.id) AS payment_count,
    SUM(p.amount) AS total_revenue,
    COUNT(DISTINCT s.user_id) AS unique_customers
FROM payments p
LEFT JOIN subscriptions s ON p.subscription_id = s.id
WHERE p.status = 'paid'
  AND p.paid_at IS NOT NULL
GROUP BY DATE_TRUNC('month', p.paid_at)
ORDER BY month DESC;

-- ============================================
-- 8. PAYMENT ISSUES & TROUBLESHOOTING
-- ============================================
-- Find subscriptions with payment issues

-- Subscriptions with failed payments but still active
SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.status,
    u.email,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) AS failed_payment_count,
    MAX(p.failed_at) AS last_failed_payment
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN payments p ON p.subscription_id = s.id
WHERE s.status = 'ativo'
  AND EXISTS (
    SELECT 1 FROM payments p2 
    WHERE p2.subscription_id = s.id 
    AND p2.status = 'failed'
  )
GROUP BY s.id, u.id
ORDER BY failed_payment_count DESC;

-- Payments without matching subscription
SELECT 
    p.id,
    p.subscription_id,
    p.pagar_me_transaction_id,
    p.amount,
    p.status,
    p.created_at
FROM payments p
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.id = p.subscription_id
);

-- Duplicate transaction IDs (should be unique)
SELECT 
    pagar_me_transaction_id,
    COUNT(*) AS count
FROM payments
GROUP BY pagar_me_transaction_id
HAVING COUNT(*) > 1;

-- Subscriptions with pending status for more than 24 hours
SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.status,
    s.created_at,
    u.email,
    NOW() - s.created_at AS time_pending
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.status = 'pending'
  AND s.created_at < NOW() - INTERVAL '24 hours'
ORDER BY s.created_at ASC;
