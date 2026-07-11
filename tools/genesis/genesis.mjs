#!/usr/bin/env node

import { runScaffoldCommand } from "./commands/scaffold.mjs";
import { runDoctorCommand } from "./commands/doctor.mjs";
import { runPlanCommand } from "./commands/plan.mjs";
import { runCompileCommand } from "./commands/compile.mjs";
import { runValidateCommand } from "./commands/validate.mjs";
import { runPromoteCommand } from "./commands/promote.mjs";
import { runBootCommand } from "./commands/boot.mjs";
import { runRuntimeCommand } from "./commands/runtime.mjs";
import { runExecuteCommand } from "./commands/execute.mjs";
import { runPackageCommand } from "./commands/package.mjs";
import { runInstallCommand } from "./commands/install.mjs";
import { runUninstallCommand } from "./commands/uninstall.mjs";
import { runListCommand } from "./commands/list.mjs";
import { runTenantCommand } from "./commands/tenant.mjs";
import { runTwinCommand } from "./commands/twin.mjs";
import { runSimulateCommand } from "./commands/simulate.mjs";
import { runDecideCommand } from "./commands/decide.mjs";
import { runAICommand } from "./commands/ai.mjs";
import { runBusinessCommand } from "./commands/business.mjs";
import { runKnowledgeCommand } from "./commands/knowledge.mjs";
import { runLearningCommand } from "./commands/learn.mjs";
import { runEvolutionCommand } from "./commands/evolve.mjs";
import { runSelfCommand } from "./commands/self.mjs";
import { runPartnerCommand } from "./commands/partner.mjs";
import { runTests } from "./tests/TestRunner.mjs";
import { generate } from "./compiler/CodeGenerationEngine.mjs";

const [, , command, ...args] = process.argv;

function printHelp() {
  console.log(`
Genesis CLI

Usage:
  node tools/genesis/genesis.mjs <command> [options]

Commands:
  doctor                          - Run workspace health check
  generate [Entity]               - Generate entity code (all entities if no name given)
  plan <Entity|enterprise>         - Create generation plan or enterprise plan
  plan <Entity>                   - Entity definition plan
  plan enterprise                 - Enterprise-wide metadata-driven plan
  compile <Entity|modules>        - Compile generation plan or all modules
  compile application <AppName>   - Compile application from modules
  compile solution <SolutionName> - Compile solution from applications
  package <name> [version]        - Create a distributable package
  install <package> [version]     - Install a package
  uninstall <package> [version]   - Uninstall a package
  list packages                   - List all packages
  tenant create <name>            - Create a new tenant
  tenant list                     - List all tenants
  tenant validate <tenantId>      - Validate a tenant
  twin build [tenantId]           - Build Enterprise Digital Twin
  twin summary [tenantId]         - Display Twin summary
  twin health [tenantId]          - Display Twin health report
  simulate [subcommand]           - Execute simulations (see simulate --help)
  decide [subcommand]             - Evaluate enterprise decisions (see decide --help)
  ai [subcommand]                 - Execute AI orchestration (see ai --help)
  business [subcommand]           - Transform business intent to Genesis metadata (see business --help)
  knowledge [subcommand]          - Enterprise Knowledge Graph compilation (see knowledge --help)
  learn [subcommand]              - Enterprise Learning Engine analysis (see learn --help)
  evolve [subcommand]             - Enterprise Evolution Engine analysis (see evolve --help)
  self [subcommand]               - Genesis Meta Compiler self-compilation (see self --help)
  partner [subcommand]            - Partner & QR Identity Engine (see partner --help)
  validate generated <Entity>     - Validate generated entity slice
  promote <Entity>                - Promote entity to Genesis Runtime (simulated)
  boot                            - Boot Genesis Runtime (12-stage pipeline)
  runtime                         - Display runtime diagnostics and registered components
  execute [options]               - Execute commands via Runtime Execution Engine
  test                            - Run automated test suite
  scaffold core-object-system

Examples:
  node tools/genesis/genesis.mjs doctor
  node tools/genesis/genesis.mjs generate Customer
  node tools/genesis/genesis.mjs generate
  node tools/genesis/genesis.mjs plan Customer
  node tools/genesis/genesis.mjs plan enterprise
  node tools/genesis/genesis.mjs plan operations --tenant=corp-001
  node tools/genesis/genesis.mjs plan inventory --verbose
  node tools/genesis/genesis.mjs compile Customer
  node tools/genesis/genesis.mjs compile modules
  node tools/genesis/genesis.mjs compile application CRM
  node tools/genesis/genesis.mjs compile solution SSI
  node tools/genesis/genesis.mjs package genesis-crm 1.0.0
  node tools/genesis/genesis.mjs install genesis-crm
  node tools/genesis/genesis.mjs list packages
  node tools/genesis/genesis.mjs tenant create acme-corp
  node tools/genesis/genesis.mjs tenant list
  node tools/genesis/genesis.mjs tenant validate tenant-acme-corp
  node tools/genesis/genesis.mjs twin build
  node tools/genesis/genesis.mjs twin summary
  node tools/genesis/genesis.mjs twin health
  node tools/genesis/genesis.mjs simulate scenario --dry-run
  node tools/genesis/genesis.mjs simulate impact --object=obj-1
  node tools/genesis/genesis.mjs simulate stress-test
  node tools/genesis/genesis.mjs decide enterprise
  node tools/genesis/genesis.mjs decide evaluate --tenant=corp-001
  node tools/genesis/genesis.mjs decide compare --verbose
  node tools/genesis/genesis.mjs ai orchestrate "Optimize operations"
  node tools/genesis/genesis.mjs ai execute "Strategic planning" --verbose
  node tools/genesis/genesis.mjs ai agents list
  node tools/genesis/genesis.mjs business compile "Build customer portal"
  node tools/genesis/genesis.mjs business compile --file=intent.txt --verbose
  node tools/genesis/genesis.mjs learn analyze
  node tools/genesis/genesis.mjs learn report --format=detailed
  node tools/genesis/genesis.mjs evolve analyze
  node tools/genesis/genesis.mjs evolve report --format=detailed
  node tools/genesis/genesis.mjs business describe --examples
  node tools/genesis/genesis.mjs knowledge compile
  node tools/genesis/genesis.mjs knowledge inspect industries
  node tools/genesis/genesis.mjs knowledge relationships
  node tools/genesis/genesis.mjs learn analyze
  node tools/genesis/genesis.mjs learn analyze --verbose
  node tools/genesis/genesis.mjs learn report --format=detailed
  node tools/genesis/genesis.mjs learn insights --domain=sales
  node tools/genesis/genesis.mjs self validate
  node tools/genesis/genesis.mjs self inspect
  node tools/genesis/genesis.mjs self describe
  node tools/genesis/genesis.mjs self status --verbose
  node tools/genesis/genesis.mjs partner validate
  node tools/genesis/genesis.mjs partner inspect
  node tools/genesis/genesis.mjs partner describe --format=json
  node tools/genesis/genesis.mjs partner status --verbose
  node tools/genesis/genesis.mjs validate generated Customer
  node tools/genesis/genesis.mjs promote Customer
  node tools/genesis/genesis.mjs boot
  node tools/genesis/genesis.mjs runtime
  node tools/genesis/genesis.mjs execute --dry-run
  node tools/genesis/genesis.mjs test
`);
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "doctor") {
    await runDoctorCommand();
    return;
  }

  if (command === "plan") {
    await runPlanCommand(...args);
    return;
  }

  if (command === "compile") {
    const [target, ...options] = args;
    await runCompileCommand(target, options);
    return;
  }

  if (command === "package") {
    await runPackageCommand(args);
    return;
  }

  if (command === "install") {
    await runInstallCommand(args);
    return;
  }

  if (command === "uninstall") {
    await runUninstallCommand(args);
    return;
  }

  if (command === "list") {
    await runListCommand(args);
    return;
  }

  if (command === "tenant") {
    await runTenantCommand(args);
    return;
  }

  if (command === "twin") {
    await runTwinCommand(args);
    return;
  }

  if (command === "simulate") {
    await runSimulateCommand(args);
    return;
  }

  if (command === "decide") {
    await runDecideCommand(args);
    return;
  }

  if (command === "ai") {
    await runAICommand(args);
    return;
  }

  if (command === "business") {
    await runBusinessCommand(args);
    return;
  }

  if (command === "knowledge") {
    await runKnowledgeCommand(args);
    return;
  }

  if (command === "learn") {
    await runLearningCommand(args);
    return;
  }

  if (command === "evolve") {
    await runEvolutionCommand(args);
    return;
  }

  if (command === "self") {
    await runSelfCommand(args);
    return;
  }

  if (command === "partner") {
    await runPartnerCommand(args);
    return;
  }

  if (command === "validate") {
    const [target, entityName] = args;
    await runValidateCommand(target, entityName);
    return;
  }

  if (command === "promote") {
    const [entityName] = args;
    await runPromoteCommand(entityName);
    return;
  }

  if (command === "boot") {
    await runBootCommand();
    return;
  }

  if (command === "runtime") {
    await runRuntimeCommand();
    return;
  }

  if (command === "execute") {
    await runExecuteCommand(args);
    return;
  }

  if (command === "generate") {
    const [entity] = args;
    await generate({ entity });
    return;
  }

  if (command === "test") {
    await runTests();
    return;
  }

  if (command === "scaffold") {
    const [target] = args;
    await runScaffoldCommand(target);
    return;
  }

  console.error(`Unknown Genesis command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((error) => {
  console.error("Genesis CLI failed.");
  console.error(error);
  process.exit(1);
});
