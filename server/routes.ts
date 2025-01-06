import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { conversations, messages } from "@db/schema";
import { generateChatResponse } from "./lib/anthropic";
import { eq, desc, asc } from "drizzle-orm";

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
        orderBy: [desc(conversations.updatedAt)],
        with: {
          messages: {
            limit: 1,
            orderBy: [desc(messages.createdAt)],
          },
        },
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
        orderBy: [asc(messages.createdAt)],
      });
      res.json(conversationMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Update conversation title
  app.patch("/api/conversations/:id", async (req, res) => {
    const { title } = req.body;
    try {
      const updated = await db
        .update(conversations)
        .set({ 
          title,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, parseInt(req.params.id)))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Send a message and get AI response
  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { content } = req.body;
    const conversationId = parseInt(req.params.id);

    try {
      // Save user message
      const userMessage = await db.insert(messages).values({
        conversationId,
        role: "user",
        content,
      }).returning();

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      // Get conversation history
      const history = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [asc(messages.createdAt)],
      });

      // Format messages for Anthropic
      const formattedMessages = history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Setup SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const stream = await generateChatResponse(formattedMessages);
        let fullResponse = '';

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            const text = chunk.delta.text;
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        // Save assistant message
        await db.insert(messages).values({
          conversationId,
          role: "assistant",
          content: fullResponse,
        });

        // Generate and update conversation title if it's the first message
        if (history.length <= 1) {
          const titleStream = await generateChatResponse([
            { role: 'user', content: `Based on this message: "${content}", generate a very short title (max 6 words) that captures the main topic.` }
          ]);

          let title = '';
          for await (const chunk of titleStream) {
            if (chunk.type === 'content_block_delta') {
              title += chunk.delta.text;
            }
          }

          await db
            .update(conversations)
            .set({ title: title.slice(0, 100) })
            .where(eq(conversations.id, conversationId));
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('Streaming error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Request error:', error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  return httpServer;
}