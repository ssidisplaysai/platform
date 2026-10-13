# Three-Campaign Health Operator

Run the normal read-only health check from the repository root:

```powershell
npm run glw:campaign-health -- --json
```

The command reads the durable product, campaign, target, and execution repositories for the certified LDW, SSI, and ProjectorEnclosure campaigns. It reports missing authority, target counts, expired running leases, completed drafts that still need reconciliation, reference state, and unauthorized publication evidence.

The default command does not mutate durable state or WordPress. It does not generate pages, dispatch targets, activate campaigns, publish content, or interact with port 3001.

When the report contains an explicit `RECONCILE` action, an operator may request only that recovery operation:

```powershell
npm run glw:campaign-health -- --reconcile
```

Reconciliation calls the existing bounded draft-batch reconciliation endpoint on port 3002. It does not authorize publication, new generation, scheduler dispatch, campaign activation, or target creation. Findings that require any other operation remain diagnostic and require their dedicated workflow and authority gates.