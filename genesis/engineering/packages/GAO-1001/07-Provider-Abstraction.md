# 07 Provider Abstraction

Provider abstraction:
- The AI layer is provider-neutral.
- Initial support is adapter-based and does not introduce provider-specific business logic.
- The abstraction anticipates OpenAI, Anthropic, Gemini, Local LLM, Azure OpenAI, and mock providers.

Implementation notes:
- Provider registry holds capabilities, adapter metadata, and health snapshots.
- Routing can fall back across providers and models according to policy.
