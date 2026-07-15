import { CompilerException } from "./CompilerException";

export class CompilerWarning extends CompilerException {
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(code, message, "system", "warning", details);
    this.name = "CompilerWarning";
  }
}