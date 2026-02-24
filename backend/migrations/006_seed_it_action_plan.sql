DO $$
DECLARE
  init_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM it_action_plan_initiatives) THEN
    INSERT INTO it_action_plan_initiatives (name) VALUES ('Matrix upgrade') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 1, 3, 'ITOps', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Reduce Licensing Cost') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 1, 3, 'ITOps', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Service Improvement (helpdesk CR,SLA)') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 1, 2, 'Dev', 1),
      (init_id, 3, 5, 'ITOps', 2);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('General Technology Awareness (AI)') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 2, 2, 'ITOps', 1),
      (init_id, 5, 5, 'ITOps', 2),
      (init_id, 8, 8, 'ITOps', 3),
      (init_id, 10, 10, 'ITOps', 4);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Cyber Security Awareness') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 3, 3, 'Infra', 1),
      (init_id, 6, 6, 'Infra', 2),
      (init_id, 9, 9, 'Infra', 3),
      (init_id, 12, 12, 'Infra', 4);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Annual Security Audit - External') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 1, 3, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('User Account Creation Automation') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 2, 3, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Backup Restore Automation') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 1, 1, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('O365 License Assignment Automation') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 2, 3, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('D365 Audit Log View') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 2, 3, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('License Monitoring Development & Implementation') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 1, 1, 'Dev', 1),
      (init_id, 2, 3, 'Infra', 2);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Bulk Purchase') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 1, 3, 'Admin', 1),
      (init_id, 4, 6, 'ERP', 2);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('D365 Cloud Environment Testing') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 4, 6, 'ERP', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Unifi Controller Upgrade') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 4, 6, 'Infra', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('CS Archiving') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 6, 12, '3rd Party', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('TD Retail & CRM Implementation') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 7, 12, 'ERP', 1);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('AI Model hosting internally') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES
      (init_id, 1, 3, 'Admin', 1),
      (init_id, 4, 5, 'Infra', 2);

    INSERT INTO it_action_plan_initiatives (name) VALUES ('Automation of ITOps forms') RETURNING id INTO init_id;
    INSERT INTO it_action_plan_segments (initiative_id, start_month, end_month, department, sort_order) VALUES (init_id, 1, 12, 'ITOps', 1);
  END IF;
END $$;
