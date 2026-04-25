export interface ToolCallResult {
  tool: string;
  args: Record<string, unknown>;
  message?: string;
}

export interface IModelLoader {
  load(): Promise<void>;
  isLoaded(): boolean;
  parseIntent(systemPrompt: string, userMessage: string): Promise<ToolCallResult>;
  formatResponse(systemPrompt: string, rawData: unknown): Promise<string>;
  formatResponseStream(
    systemPrompt: string,
    rawData: unknown,
    onToken: (token: string) => void,
  ): Promise<void>;
}
