# Genesis SDK Entity Generation Pipeline

The Genesis SDK entity generation pipeline is designed as an extensible architecture for future code generation and platform scaffolding.

## Goals

- Keep generation driven by metadata.
- Preserve Clean Architecture boundaries.
- Keep the runtime independent from UI concerns.
- Allow future generators to target different outputs.

## Pipeline Overview

1. A generator receives an EntityDefinition.
2. The generator checks whether it supports the definition.
3. The generator produces a structured output for the requested target.
4. A registry can manage multiple builders and generators.
5. The output can be consumed by future SDK layers, tooling, or runtime services.

## Extension Points

- New builders can be added without changing existing ones.
- New generators can target entities, services, repositories, workflows, or APIs.
- The registry provides a stable point for future discovery and orchestration.

## Architectural Notes

- EntityDefinition is the single input contract.
- Builders and generators remain focused and composable.
- The SDK does not introduce runtime behavior or UI logic.
