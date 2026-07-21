-- Manager role enum value (must commit before use in 088_manager_role_rls.sql).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
