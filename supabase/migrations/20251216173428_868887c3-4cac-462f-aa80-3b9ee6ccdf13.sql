-- Rename 'stuck' to 'alert' in escalation_level enum
ALTER TYPE escalation_level RENAME VALUE 'stuck' TO 'alert';