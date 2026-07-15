import { createCompilerConfiguration } from "./CompilerConfiguration";
import { CompilerEventBus } from "./CompilerEventBus";
import { CompilerLogger } from "./CompilerLogger";
import { CompilerPassRegistry } from "./CompilerPassRegistry";
import { CompilerPipeline } from "./CompilerPipeline";
import type { CompilerConfiguration } from "./types";

export class CompilerPipelineBuilder {
  private registry = new CompilerPassRegistry();
  private eventBus = new CompilerEventBus();
  private logger = new CompilerLogger();
  private configuration: CompilerConfiguration = createCompilerConfiguration();

  withRegistry(registry: CompilerPassRegistry): this {
    this.registry = registry;
    return this;
  }

  withEventBus(eventBus: CompilerEventBus): this {
    this.eventBus = eventBus;
    return this;
  }

  withLogger(logger: CompilerLogger): this {
    this.logger = logger;
    return this;
  }

  withConfiguration(configuration: Partial<CompilerConfiguration>): this {
    this.configuration = createCompilerConfiguration(configuration);
    return this;
  }

  build(): CompilerPipeline {
    return new CompilerPipeline({
      registry: this.registry,
      eventBus: this.eventBus,
      logger: this.logger,
      configuration: this.configuration,
    });
  }
}