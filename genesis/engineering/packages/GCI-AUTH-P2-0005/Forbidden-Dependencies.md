# Forbidden Dependencies

## Forbidden Capability Dependencies
- inference engines
- AI or LLM frameworks
- probabilistic reasoning frameworks
- identity-resolution engines
- relationship-resolution engines
- rule-evaluation engines inside assembly scope

## Forbidden Infrastructure Dependencies
- persistence/database ownership layers
- orchestration engines
- scheduling engines
- deployment/runtime control planes
- queue managers
- worker pools
- workflow execution engines
- side-effect emitters

## Forbidden Behavioral Coupling
The runtime must not depend on mutable upstream write-path APIs or any dependency that can alter source runtime records during assembly.
