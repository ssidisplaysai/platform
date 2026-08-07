# 13 Query Surface

Added read-only deterministic queries:

Lot queries:
- GetLot
- ListLots
- ListLotsByInventoryItem
- ListLotsByWarehouse
- ListLotsByLocation
- ListQuarantinedLots
- ListExpiringLots
- ListExpiredLots

Serial queries:
- GetSerial
- ListSerials
- ListSerialsByInventoryItem
- ListSerialsByBalance
- ListSerialsByLot
- ListQuarantinedSerials
- ListExpiredSerials

Expiration query:
- GetExpirationStatus

No query mutates state.
