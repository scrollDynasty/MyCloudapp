-- First delete all orders
DELETE FROM orders;

-- Then delete all VPS plans
DELETE FROM vps_plans;

-- Show results
SELECT 'Orders deleted' as result, COUNT(*) as count FROM orders
UNION ALL
SELECT 'Plans deleted' as result, COUNT(*) as count FROM vps_plans;
