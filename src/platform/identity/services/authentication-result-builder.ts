import type { AuthenticationContext, AuthenticationResult, SessionDescriptor } from "../contracts";

export class AuthenticationResultBuilder {
  success(input: {
    requestId: string;
    principalId: string;
    identityId: string;
    context: AuthenticationContext;
    session: SessionDescriptor;
  }): AuthenticationResult {
    return {
      requestId: input.requestId,
      authenticated: true,
      principalId: input.principalId,
      identityId: input.identityId,
      authenticationContext: input.context,
      session: input.session,
    };
  }

  failure(input: {
    requestId: string;
    code: string;
    message: string;
  }): AuthenticationResult {
    return {
      requestId: input.requestId,
      authenticated: false,
      failureCode: input.code,
      failureMessage: input.message,
    };
  }
}
