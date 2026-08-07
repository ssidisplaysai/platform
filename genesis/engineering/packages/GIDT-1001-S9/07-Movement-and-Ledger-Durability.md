# 07 Movement and Ledger Durability

Movement records and ledger entries are part of the persisted tenant partition.

Recovery validates that every movement has the expected ledger entries and that ledger references remain consistent after restart.