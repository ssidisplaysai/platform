# Persistence Root and Durability Hardening

Durability mode is now explicit. The runtime reports ephemeral mode when no durable root is configured and reports durable readiness only when persistence.rootDir is explicitly provided.
