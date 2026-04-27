export interface ToolCallResult {
  tool: string;
  args: Record<string, unknown>;
  message?: string;
}

export interface ToolParamSchema {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
}

export interface IModelLoader {
  load(): Promise<void>;
  isLoaded(): boolean;
  parseIntent(
    systemPrompt: string,
    userMessage: string,
    toolNames: string[],
    toolParams: Map<string, ToolParamSchema[]>,
  ): Promise<ToolCallResult>;
  formatResponse(systemPrompt: string, rawData: unknown): Promise<string>;
  formatResponseStream(
    systemPrompt: string,
    rawData: unknown,
    onToken: (token: string) => void,
  ): Promise<void>;
}
