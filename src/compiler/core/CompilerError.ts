import { CompilerException } from "./CompilerException";

export class CompilerError extends CompilerException {
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(code, message, "execution", "error", details);
    this.name = "CompilerError";
  }
}