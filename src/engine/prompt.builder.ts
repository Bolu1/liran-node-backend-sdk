import { LiranConfig, ToolDefinition } from '../interfaces/types.js';
import { SessionMessage } from '../storage/session.interfaces.js';

const OUTPUT_FORMAT_INSTRUCTION = `
You must respond with ONLY a valid JSON object. No explanation. No markdown. No extra text.

If the user's message maps to a tool, use this structure:
{
  "tool": "<tool_name>",
  "args": {
    "<param_name>": "<value>"
  }
}

If the user is greeting you, making small talk, or asking something unrelated to the available tools, respond conversationally using this structure:
{
  "tool": "__none__",
  "args": {},
  "message": "<your conversational reply here>"
}

Never invent tool names. Never call a tool that is not in the list.`.trim();

function buildIdentityBlock(config: LiranConfig): string {
  return `You are an AI assistant for ${config.system.name}, a ${config.system.domain} system. Your role is to understand the user's request and call the correct tool to retrieve or act on information. You may also respond conversationally to greetings or off-topic messages.`;
}

function buildToolsBlock(tools: ToolDefinition[]): string {
  const toolSchemas = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    params: tool.params.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      required: p.required,
    })),
  }));

  return `Available tools:\n${JSON.stringify(toolSchemas, null, 2)}`;
}

function buildHistoryBlock(history: SessionMessage[]): string {
  if (history.length === 0) return '';

  const lines = history.map((msg) =>
    msg.role === 'user' ? `User: ${msg.content}` : `Assistant: ${msg.content}`,
  );

  return `Conversation so far:\n${lines.join('\n')}`;
}

export function buildIntentPrompt(
  config: LiranConfig,
  allowedTools: ToolDefinition[],
  history: SessionMessage[],
  userMessage: string,
): string {
  const parts: string[] = [
    buildIdentityBlock(config),
    buildToolsBlock(allowedTools),
    OUTPUT_FORMAT_INSTRUCTION,
  ];

  const historyBlock = buildHistoryBlock(history);
  if (historyBlock) parts.push(historyBlock);

  parts.push(`User: ${userMessage}`);

  return parts.join('\n\n');
}

export function buildFormatPrompt(
  config: LiranConfig,
  toolName: string,
  rawData: unknown,
  userMessage: string,
  history: SessionMessage[],
): string {
  const parts: string[] = [
    `You are a helpful assistant for ${config.system.name}, a ${config.system.domain} system.`,
    `The tool "${toolName}" was executed and returned the following data:\n${JSON.stringify(rawData, null, 2)}`,
  ];

  const historyBlock = buildHistoryBlock(history);
  if (historyBlock) parts.push(historyBlock);

  parts.push(
    `User: ${userMessage}`,
    `Respond to the user in natural language using only the data above. Be concise and direct. Do not mention tool names or internal details.`,
  );

  return parts.join('\n\n');
}
