# Genesis Quote Lifecycle

## Commercial Statuses
- draft
- pricing
- pending_approval
- approved
- presented
- negotiating
- accepted
- rejected
- expired
- cancelled
- converted

## Transition Rules
- submit: draft|pricing|negotiating|rejected -> pending_approval
- approve: pending_approval -> approved
- reject: pending_approval -> rejected
- withdraw: pending_approval -> pricing
- present: approved -> presented
- accept: presented|negotiating -> accepted
- cancel: any non-accepted/non-converted -> cancelled
- expire: approved|presented|negotiating -> expired
- convert: accepted -> converted

## Lifecycle Mapping
Commercial status aligns to lifecycleState values on the base document model: draft, pending_review, approved, active, closed, cancelled.
