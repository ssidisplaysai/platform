# 08 Safe Write Coordination

Safe write model implemented:
1. capture and validate canonical Manufacturing state
2. deterministically serialize manifest/runtime and tenant partitions
3. ensure directory structure
4. write temporary candidate
5. replace target by rename
6. restore prior backup on failure where available
7. clean bounded temp/backup artifacts

Retry behavior:
- ENOENT/directory-race path is retried once after directory re-ensure
- no infinite retry loop
- non-ENOENT failures propagate
