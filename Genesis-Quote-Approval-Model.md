# Genesis Quote Approval Model

## Approval Status Values
- none
- pending
- approved
- rejected
- withdrawn

## Approval History
For each approval event the model stores:
- status
- actor
- timestamp
- notes

## Authorization
Approval actions are permission-gated:
- quotes:submit
- quotes:approve
- quotes:reject
- quotes:withdraw
- quotes:present
- quotes:accept
- quotes:cancel
- quotes:expire
