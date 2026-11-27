UPDATE credit_policies
SET mode = 'REQUEST_OR_PAY'
WHERE scope_type = 'GLOBAL' AND scope_id IS NULL;
