# 17 Service and Runtime Integration

Slice 9 integrates at runtime startup by awaiting the persistence registration hook before READY.

That keeps durable recovery on the boot path rather than as a later side effect.