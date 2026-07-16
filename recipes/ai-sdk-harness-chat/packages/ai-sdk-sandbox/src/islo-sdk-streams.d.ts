import type { IsloApi } from "@islo-labs/sdk";

export type ExecStreamRequest = {
  sandbox_name: string;
  args: string[];
  workdir?: string | null;
  env_vars?: Record<string, string> | null;
};

declare module "@islo-labs/sdk" {
  export interface SandboxSseEvent {
    event?: string;
    data: string;
    id?: string;
  }

  export namespace SandboxesClient {
    interface RequestOptions {
      abortSignal?: AbortSignal;
      headers?: Record<string, string>;
    }
  }

  export class SandboxesClient {
    execInSandboxStream(
      request: ExecStreamRequest,
      requestOptions?: SandboxesClient.RequestOptions,
    ): AsyncIterable<SandboxSseEvent>;

    createSandboxStream(
      request?: IsloApi.CreateSandboxRequest,
      requestOptions?: SandboxesClient.RequestOptions,
    ): AsyncIterable<SandboxSseEvent>;

    streamSandboxCreationEvents(
      request: { sandbox_name: string },
      requestOptions?: SandboxesClient.RequestOptions,
    ): AsyncIterable<SandboxSseEvent>;
  }
}

declare module "@islo-labs/sdk/api" {
  export interface SandboxSseEvent {
    event?: string;
    data: string;
    id?: string;
  }
}
