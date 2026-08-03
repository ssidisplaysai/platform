# 06 Recipient and Preference Model

Recipient strategy:
1. Recipient references may include explicit channel addresses or identity-style fields.
2. The resolver returns resolved recipients and unresolved references separately.
3. Unresolved recipients are recorded in audit evidence.

Preference strategy:
1. Channel preferences can enable, disable, or reorder channel delivery.
2. Quiet-hours policy can defer delivery for non-critical notifications.
3. Preference decisions are notification-domain policy, not scheduling ownership.

Boundary evidence:
1. Notifications do not own contacts; they consume recipient input from upstream systems.
2. Notifications do not own timing; deferrals are policy outputs only.
