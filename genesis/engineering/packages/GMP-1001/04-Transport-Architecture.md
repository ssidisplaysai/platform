# Transport Architecture

## Implemented Transport

- InMemoryTransport

## Abstraction Contract

Transport contract supports:

1. publish(message)
2. subscribe(handler) with unsubscribe callback
3. queueStats()
4. health()

## Future-Ready Transport Targets

Design supports adding adapters for:

- Database Queue
- Redis
- NATS
- RabbitMQ
- Kafka
- Azure Service Bus
- AWS SQS

No external transport integration is implemented in GMP-1001.