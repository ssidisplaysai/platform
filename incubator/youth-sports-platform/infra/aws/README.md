# AWS Target

This is the initial target architecture, not yet a live deployment.

## Region

Choose one primary US region during account bootstrap and keep staging/production in the same region initially.

## Proposed services

### Web
AWS Amplify Hosting for the Next.js web/PWA client initially.

### API
Containerized TypeScript API on ECS Fargate behind an Application Load Balancer.

Reasons:
- independent scaling from the web frontend
- long-running API process
- supports realtime/WebSocket evolution
- straightforward Docker portability

### Database
Amazon RDS for PostgreSQL with PostGIS enabled.

### Identity
Amazon Cognito user pools for adult authentication.

### Media
- S3 private buckets
- CloudFront distribution
- signed URLs
- separate staging and production buckets

### Secrets
AWS Secrets Manager / SSM Parameter Store.
Never commit credentials.

### DNS/TLS
- Route 53 when domain is selected
- ACM certificates
- app.<domain>
- api.<domain>

### Observability
- CloudWatch logs
- application health endpoint
- structured JSON logs
- alarms for 5xx rate, task failures, database health

## Environments

### staging
Independent:
- API service
- database
- Cognito pool
- S3 bucket
- environment variables

### production
No shared database or mutable resources with staging.

## Infrastructure as code

Use Terraform for reproducible AWS resources and easy separation from application runtime.

Initial Terraform modules:
- network
- database
- api
- identity
- media
- observability

Amplify connection can initially be configured separately, then codified once repository ownership and AWS account details are final.

## Deployment flow

feature branch -> pull request -> CI -> staging -> validation -> production promotion

No deployment should require a developer workstation.
