-- Fix attendance records for users who were wrongly auto-checked-out today
-- Only affects users with less than 3 hours worked (clearly auto-checkout victims)
UPDATE attendance_records 
SET 
  check_out_time = NULL,
  total_hours_worked = 0,
  is_early_departure = false,
  early_departure_minutes = 0
WHERE 
  date = CURRENT_DATE 
  AND check_out_time IS NOT NULL
  AND total_hours_worked < 3;