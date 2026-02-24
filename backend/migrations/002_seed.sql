INSERT INTO categories (name)
VALUES ('Access & Identity'), ('Hardware'), ('Software'), ('Network')
ON CONFLICT (name) DO NOTHING;

INSERT INTO services (code, title, description, category_id, icon, status, form_link)
SELECT 'ACC-001', 'New User Onboarding', 'Request access to core systems and email.', c.id, 'user-plus', 'active', 'https://forms.microsoft.com/'
FROM categories c WHERE c.name = 'Access & Identity'
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (code, title, description, category_id, icon, status, form_link)
SELECT 'HW-101', 'Laptop Replacement', 'Request a laptop replacement or upgrade.', c.id, 'laptop', 'active', 'https://forms.microsoft.com/'
FROM categories c WHERE c.name = 'Hardware'
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (code, title, description, category_id, icon, status, form_link)
SELECT 'SW-210', 'Software Installation', 'Request installation of approved software.', c.id, 'download', 'active', 'https://forms.microsoft.com/'
FROM categories c WHERE c.name = 'Software'
ON CONFLICT (code) DO NOTHING;

INSERT INTO forms (title, type, url, description)
VALUES
  ('Access Request Form', 'generic', 'https://forms.microsoft.com/', 'Request access to services.'),
  ('IT Asset Request', 'generic', 'https://forms.microsoft.com/', 'Request hardware or peripherals.'),
  ('Device Inventory List', 'generic', 'https://lists.microsoft.com/', 'View current device inventory.')
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_base (title, category, body, tags)
VALUES
  ('Resetting Your Password', 'Access & Identity', 'Use the self-service portal to reset your password. If locked out, contact IT support.', ARRAY['password','access']),
  ('VPN Troubleshooting', 'Network', 'Check your internet connection and verify VPN client version. Restart the VPN service if needed.', ARRAY['vpn','network'])
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('portal_title', 'MTCC IT Portal'),
  ('announcement', 'Scheduled maintenance on Fridays 8PM - 10PM.'),
  ('support_email', 'it-support@mtcc.com.mv')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
