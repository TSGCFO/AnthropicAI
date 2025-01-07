export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  contextSnapshot?: Record<string, any>;
  createdAt: string;
}

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}