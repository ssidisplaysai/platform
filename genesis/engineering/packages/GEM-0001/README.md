# GEM-0001 Engineering Package

Package: GEM-0001 — Unified Test Runner Alignment
Version: 1.0.0
Date: 2026-07-15

Purpose:
- Align repository testing so one documented workflow executes Jest suites, node:test suites, and GCC-1002 compiler-core suites.

Authoritative workflow:
- `npm test` -> `test:all`
- `test:all` runs:
  1. `test:jest`
  2. `test:node`
  3. `test:compiler`

Validation highlights:
- Jest split-runner command executes and passes discovered Jest suites.
- node:test split-runner command executes discovered node:test suites with zero failing and zero skipped tests.
- GCC-1002 compiler-core suite remains passing.
- Aggregate authoritative command passes with all sub-suites green.
- Aggregate smoke mode passes and remains deterministic.

Scope constraints satisfied:
- No Foundation artifact changes.
- No GCC-1001 architecture changes.
- No GCC-1002 runtime redesign.
- No GCC-1003 work started.
