# 07 Channel Routing and Provider Model

Routing strategy:
1. Candidate channels are filtered by definition allow-list and recipient address availability.
2. Eligible channels are passed to the provider layer in stable order.
3. Suppression and preference checks occur before provider invocation.

Provider abstraction:
1. The foundation uses a small provider interface with channel capability metadata.
2. In-memory provider adapters simulate success and failure paths.
3. No real third-party provider integration was added in this work order.
4. Transport ownership remains outside the notification bounded capability.
