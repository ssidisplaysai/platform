# Operational Ownership

## Runtime Ownership Record
- Scheduled Task Name: Genesis Production Server
- Scheduled Task Path: \
- Startup Script: C:\Users\rober\Documents\Stoner Platform\start-genesis.ps1
- Production Worktree: C:\Users\rober\Documents\Stoner Platform\platform-production
- Runtime Port: 3001

## Ownership Discovery Findings
1. Production runtime ownership was traced to Windows Scheduled Task execution model.
2. Session 0 ownership and protected process behavior required governed control-plane restart handling.
3. Canonical ownership was restored to the scheduled-task model.

## Final Owning Process Model
Windows Task Scheduler launches the approved startup script, which starts the production runtime bound to port 3001.

## Restart Procedure (High Level)
1. Use Task Scheduler ownership path, not ad hoc terminal runtime commands.
2. Stop existing scheduled-task-owned runtime instance through governed operator controls.
3. Start or rerun Genesis Production Server scheduled task.
4. Verify runtime process on port 3001 and re-run local/public route checks.
