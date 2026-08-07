# 02 Persistence Architecture

Slice 9 composes persistence at the Inventory service-graph boundary. The runtime boots the Inventory service graph, captures tenant partitions, writes them durably, and restores them before READY.

Shared persistence mechanics are reused for the surrounding coordination model, but Inventory owns its persisted domain shape, validation rules, and recovery invariants.
