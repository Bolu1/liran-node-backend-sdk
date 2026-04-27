import { LiranConfig, ToolDefinition, ToolParam } from '../interfaces/types.js';
import { SessionMessage } from '../storage/session.interfaces.js';

const OUTPUT_FORMAT_INSTRUCTION = `
You must respond with ONLY a valid JSON object. No explanation. No markdown. No extra text.

If the user's message maps to a tool, respond with:
{"tool": "<tool_name>", "args": {"<param_name>": <value>, ...}}

Always include every required param in args. Extract values from the user's message.
If a required param has a default and the user did not provide a value, use the default.

If the user is making small talk or asking something unrelated to the tools, respond with:
{"tool": "__none__", "args": {}, "message": "<reply>"}

Never invent tool names. Never call a tool that is not in the list.`.trim();

function exampleValueForParam(p: ToolParam): string | number | boolean {
  if (p.default !== undefined) return p.default;
  if (p.type === 'number') return 10;
  if (p.type === 'boolean') return true;
  const desc = p.description.toLowerCase();
  if (desc.includes('keyword') || desc.includes('search')) return 'shoes';
  if (desc.includes('status')) return 'pending';
  if (desc.includes('id')) return 1;
  return 'example';
}

function buildExamplesBlock(tools: ToolDefinition[]): string {
  const lines: string[] = ['Examples:'];

  for (const tool of tools) {
    const requiredParams = tool.params.filter((p) => p.required);
    const args: Record<string, string | number | boolean> = {};
    for (const p of requiredParams) {
      args[p.name] = exampleValueForParam(p);
    }
    lines.push(JSON.stringify({ tool: tool.name, args }));
  }

  lines.push(JSON.stringify({ tool: '__none__', args: {}, message: 'How can I help you?' }));

  return lines.join('\n');
}

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
      ...(p.default !== undefined ? { default: p.default } : {}),
    })),
  }));

  return `Available tools:\n${JSON.stringify(toolSchemas, null, 2)}`;
}

function buildHistoryBlock(history: SessionMessage[]): string {
  if (history.length === 0) return '';

  const lines = history.map((msg) => {
    if (msg.role === 'user') return `User: ${msg.content}`;
    if (msg.role === 'tool_result') return `Tool data (${msg.toolName}): ${msg.content}`;
    return `Assistant: ${msg.content}`;
  });

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
    buildExamplesBlock(allowedTools),
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
