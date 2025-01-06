import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { conversations, messages } from "@db/schema";
import { generateChatResponse } from "./lib/anthropic";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Create a new conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = await db.insert(conversations)
        .values({ title: "New Chat" })
        .returning();
      res.json(conversation[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get all conversations
  app.get("/api/conversations", async (req, res) => {
    try {
      const allConversations = await db.query.conversations.findMany({
        orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
      });
      res.json(allConversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, parseInt(req.params.id)),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      });
      res.json(conversationMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send a message and get AI response
  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { content } = req.body;
    const conversationId = parseInt(req.params.id);

    try {
      // Save user message
      await db.insert(messages).values({
        conversationId,
        role: "user",
        content,
      });

      // Get conversation history
      const history = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      });

      // Format messages for Anthropic
      const formattedMessages = history.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Get streaming response
      const response = await generateChatResponse(formattedMessages);
      
      // Stream response to client
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';
      
      for await (const chunk of response) {
        const text = chunk.content[0]?.text || '';
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      // Save assistant message
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: fullResponse,
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  return httpServer;
}
