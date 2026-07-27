# GED-0001 Authorization Model

## Purpose
Authorization boundaries define which shared enterprise objects may be viewed or validated by a given Business Agent or operator role.

## Rules
1. Metadata, relationship, version, health, and audit access are authenticated.
2. Validation is restricted to elevated roles.
3. Viewers may read canonical metadata but cannot mutate the catalog.
4. The enterprise domain model is not agent-owned.
