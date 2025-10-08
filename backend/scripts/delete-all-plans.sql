-- Delete all VPS plans
DELETE FROM vps_plans;

-- Show result
SELECT COUNT(*) as remaining_plans FROM vps_plans;
