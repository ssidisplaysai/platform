# 05 Template and Rendering Model

Template strategy:
1. Templates are channel-specific and versioned.
2. Each template declares required variables and can define subject, title, and body fragments.
3. Rendering performs simple placeholder interpolation for notification payload values.
4. Missing template variables fail fast rather than silently omitting content.

Template boundaries:
1. The system does not generate creative or AI-authored content.
2. The system does not manage marketing copy or campaign templates.
3. The system only renders deterministic notification content from explicit payload variables.
