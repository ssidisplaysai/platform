import { ProductError, type ProductPersistedState } from "../contracts";

type DirectedEdge = {
  from: string;
  to: string;
};

function canonicalSort(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function detectDirectedCycle(edges: DirectedEdge[]): string[] | null {
  const adjacency = new Map<string, Set<string>>();
  const nodes = new Set<string>();

  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Set<string>());
    }
    adjacency.get(edge.from)!.add(edge.to);
  }

  const temporary = new Set<string>();
  const permanent = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    if (permanent.has(node)) {
      return null;
    }

    if (temporary.has(node)) {
      const start = stack.lastIndexOf(node);
      return [...stack.slice(start), node];
    }

    temporary.add(node);
    stack.push(node);

    for (const next of canonicalSort(adjacency.get(node) ?? [])) {
      const cycle = visit(next);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    temporary.delete(node);
    permanent.add(node);
    return null;
  };

  for (const node of canonicalSort(nodes)) {
    const cycle = visit(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

function parseIdentifiers(input: string, prefix: "rule" | "config"): string[] {
  const matches = new Set<string>();
  const colon = new RegExp(`${prefix}:([A-Za-z0-9._-]+)`, "g");
  const fn = new RegExp(`${prefix}Ref\\(([A-Za-z0-9._-]+)\\)`, "g");

  for (const pattern of [colon, fn]) {
    let found: RegExpExecArray | null = pattern.exec(input);
    while (found) {
      matches.add(found[1]!);
      found = pattern.exec(input);
    }
  }

  return canonicalSort(matches);
}

export function assertBomGraphAcyclic(state: ProductPersistedState): void {
  const edges: DirectedEdge[] = [];
  const productKeys = new Set(state.products.map((item) => `${item.tenantId}|${item.productId}`));

  for (const bom of state.billOfMaterialDefinitions) {
    for (const component of bom.components) {
      const componentKey = `${bom.tenantId}|${component.componentProductId}`;
      if (!productKeys.has(componentKey)) {
        throw new ProductError(
          "INVARIANT_VIOLATION",
          `BOM component references missing product: ${component.componentProductId}`,
          false,
          true,
          "HIGH",
        );
      }

      const from = `${bom.tenantId}|${bom.versionIdentifier}|${bom.productId}`;
      const to = `${bom.tenantId}|${bom.versionIdentifier}|${component.componentProductId}`;
      edges.push({ from, to });
    }
  }

  const cycle = detectDirectedCycle(edges);
  if (cycle) {
    throw new ProductError(
      "INVARIANT_VIOLATION",
      `BOM cycle detected: ${cycle.join(" -> ")}`,
      false,
      true,
      "HIGH",
    );
  }
}

export function assertConfigurationGraphsAcyclic(state: ProductPersistedState): void {
  const ruleEdges: DirectedEdge[] = [];
  const configEdges: DirectedEdge[] = [];

  for (const configuration of state.configurations) {
    const ruleIds = new Set(configuration.rules.map((rule) => rule.configurationRuleId));
    const cfgKey = `${configuration.tenantId}|${configuration.versionIdentifier}|${configuration.configurationId}`;

    for (const rule of configuration.rules) {
      const fromRule = `${cfgKey}|${rule.configurationRuleId}`;
      for (const targetRuleId of parseIdentifiers(rule.expression, "rule")) {
        if (ruleIds.has(targetRuleId)) {
          ruleEdges.push({ from: fromRule, to: `${cfgKey}|${targetRuleId}` });
        }
      }

      for (const targetConfigId of parseIdentifiers(rule.expression, "config")) {
        configEdges.push({ from: cfgKey, to: `${configuration.tenantId}|${configuration.versionIdentifier}|${targetConfigId}` });
      }
    }
  }

  const ruleCycle = detectDirectedCycle(ruleEdges);
  if (ruleCycle) {
    throw new ProductError(
      "INVARIANT_VIOLATION",
      `configuration rule cycle detected: ${ruleCycle.join(" -> ")}`,
      false,
      true,
      "HIGH",
    );
  }

  const configurationIds = new Set(
    state.configurations.map((item) => `${item.tenantId}|${item.versionIdentifier}|${item.configurationId}`),
  );
  const scopedConfigEdges = configEdges.filter((edge) => configurationIds.has(edge.to));
  const cfgCycle = detectDirectedCycle(scopedConfigEdges);
  if (cfgCycle) {
    throw new ProductError(
      "INVARIANT_VIOLATION",
      `configuration dependency cycle detected: ${cfgCycle.join(" -> ")}`,
      false,
      true,
      "HIGH",
    );
  }
}

export function assertReplacementGraphAcyclic(state: ProductPersistedState): void {
  const edges: DirectedEdge[] = state.productRelationships
    .filter((item) => item.kind === "REPLACES")
    .map((item) => ({
      from: `${item.tenantId}|${item.sourceProductId}`,
      to: `${item.tenantId}|${item.targetProductId}`,
    }));

  const cycle = detectDirectedCycle(edges);
  if (cycle) {
    throw new ProductError(
      "INVARIANT_VIOLATION",
      `replacement cycle detected: ${cycle.join(" -> ")}`,
      false,
      true,
      "HIGH",
    );
  }
}
