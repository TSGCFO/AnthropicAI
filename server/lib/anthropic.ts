import { Anthropic } from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = 'claude-3-5-sonnet-20241022';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateChatResponse(messages: { role: string; content: string }[]) {
  try {
    // Add system message to define the assistant's role
    const systemMessage = {
      role: 'assistant',
      content: `You are an AI assistant specialized for this specific project. Your role is to:
1. Understand natural language input and provide tailored responses based on the project context
2. Maintain a friendly and professional tone
3. Focus on providing accurate, project-relevant information
4. Ask for clarification when needed
5. Use project-specific terminology appropriately
6. Provide examples that relate directly to the project context`
    };

    const formattedMessages = [
      // Add system message first
      systemMessage,
      // Then add user conversation history
      ...messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: formattedMessages,
      stream: true,
    });

    return response;
  } catch (error) {
    console.error('Anthropic API error:', error);
    throw new Error('Failed to generate response');
  }
}