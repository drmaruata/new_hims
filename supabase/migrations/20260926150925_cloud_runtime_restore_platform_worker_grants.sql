BEGIN;

-- Restore the intentionally narrow worker role grants. The Cloud hardening
-- migration removed only Data API roles (anon/authenticated/service_role), but
-- the initial Cloud role provisioning was not present in this project. Without
-- these grants the BYPASSRLS role exists but both workers cannot read/write their
-- work queues.

GRANT USAGE ON SCHEMA hims_workflow TO hims_platform;
GRANT USAGE ON SCHEMA hims_integration TO hims_platform;

GRANT SELECT, UPDATE, DELETE
  ON TABLE hims_workflow.outbox_events
  TO hims_platform;

GRANT SELECT
  ON TABLE hims_integration.integrations
  TO hims_platform;

GRANT SELECT, INSERT, UPDATE
  ON TABLE hims_integration.messages
  TO hims_platform;

GRANT SELECT, INSERT
  ON TABLE hims_integration.message_attempts
  TO hims_platform;

GRANT SELECT, INSERT, UPDATE
  ON TABLE hims_integration.dead_letters
  TO hims_platform;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA hims_workflow
  TO hims_platform;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA hims_integration
  TO hims_platform;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hims_workflow
  GRANT SELECT, INSERT, UPDATE ON TABLES TO hims_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hims_integration
  GRANT SELECT, INSERT, UPDATE ON TABLES TO hims_platform;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hims_workflow
  GRANT USAGE, SELECT ON SEQUENCES TO hims_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hims_integration
  GRANT USAGE, SELECT ON SEQUENCES TO hims_platform;

COMMIT;