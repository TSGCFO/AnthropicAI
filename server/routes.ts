import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupWebSocketServer } from './lib/wsHandler';
import { generateCodeSuggestion, analyzeCode, explainCode } from './lib/codeai';
import { detectPatterns, suggestPatterns, storeCodePattern, recordPatternUsage } from './lib/patterns';
import { db } from "@db";
import { conversations, messages, codePatterns, promptTemplates } from "@db/schema";
import { generateChatResponse } from "./lib/anthropic";
import { eq, desc, asc } from "drizzle-orm";
import { ContextManager } from "./lib/contextManager";
import { indexCodebase } from "./lib/codebaseIndexer";
import { AssistantService } from './lib/assistantService';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup WebSocket server for real-time code assistance
  const wss = setupWebSocketServer(httpServer);

  // Initialize codebase indexing
  indexCodebase().catch(error => {
    console.error('Failed to index codebase:', error);
  });

  // Code pattern endpoints
  app.post("/api/patterns/detect", async (req, res) => {
    try {
      const { code, language } = req.body;
      const patterns = await detectPatterns(code, language);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/patterns/suggest", async (req, res) => {
    try {
      const { code, language, limit } = req.body;
      const suggestions = await suggestPatterns(code, language, limit);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/patterns/store", async (req, res) => {
    try {
      const { name, description, code, language, tags, context } = req.body;
      const pattern = await storeCodePattern(name, description, code, language, tags, context);
      res.json(pattern);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/patterns/usage", async (req, res) => {
    try {
      const { patternId, context, accepted } = req.body;
      await recordPatternUsage(patternId, context, accepted);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/patterns", async (req, res) => {
    try {
      const { language } = req.query;
      const patterns = await db.query.codePatterns.findMany({
        where: language ? eq(codePatterns.language, language as string) : undefined,
        orderBy: [desc(codePatterns.usageCount)],
      });
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Test endpoint to demonstrate enhanced code generation
  app.post("/api/code/test-generation", async (req, res) => {
    try {
      // Example: Financial transaction processing with comprehensive validation
      const code_template = `
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import Transaction, Account, AuditLog
from .validators import validate_transaction
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def process_financial_transaction(request):
    """
    Process a financial transaction with comprehensive validation and security measures.
    Implements double-entry accounting principles and maintains audit logs.
    """
    try:
        # Implementation needed here
        pass

    except Exception as e:
        logger.error(f"Transaction processing error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
      `;

      // Generate code using our enhanced AI service
      const suggestion = await generateCodeSuggestion({
        currentFile: 'transactions/views.py',
        fileContent: code_template,
        cursor: code_template.length,
        language: 'python',
        projectContext: 'LedgerLink financial management system requiring secure transaction handling'
      });

      // Get comprehensive code analysis
      const analysis = await analyzeCode(suggestion.suggestion || code_template);

      res.json({
        generated_code: suggestion,
        code_analysis: analysis
      });

    } catch (error) {
      console.error('Test generation error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // REST endpoints for code assistance
  app.post("/api/code/suggest", async (req, res) => {
    try {
      const { code, cursor, language, file } = req.body;
      const suggestion = await generateCodeSuggestion({
        currentFile: file,
        fileContent: code,
        cursor,
        language,
      });
      res.json(suggestion);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/code/analyze", async (req, res) => {
    try {
      const { code } = req.body;
      const analysis = await analyzeCode(code);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/code/explain", async (req, res) => {
    try {
      const { code } = req.body;
      const explanation = await explainCode(code);
      res.json({ explanation });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create a new conversation with initial context
  app.post("/api/conversations", async (req, res) => {
    try {
      const { title, initialContext } = req.body;
      const conversation = await db.insert(conversations)
        .values({
          title: title || "New Chat",
          context: initialContext || {},
          metadata: { startedAt: new Date().toISOString() }
        })
        .returning();
      res.json(conversation[0]);
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get conversations with context
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
      console.error('Get conversations error:', error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages with context for a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationContext = await ContextManager.getConversationContext(
        parseInt(req.params.id)
      );

      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, parseInt(req.params.id)),
        orderBy: [asc(messages.createdAt)],
      });

      res.json({
        messages: conversationMessages,
        context: conversationContext.context
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Update conversation title and context
  app.patch("/api/conversations/:id", async (req, res) => {
    const { title, context } = req.body;
    try {
      let updates: any = { updatedAt: new Date() };
      if (title) updates.title = title;
      if (context) {
        const updatedContext = await ContextManager.updateContext(
          parseInt(req.params.id),
          context
        );
        updates.context = updatedContext;
      }

      const updated = await db
        .update(conversations)
        .set(updates)
        .where(eq(conversations.id, parseInt(req.params.id)))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error('Update conversation error:', error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Send a message and get AI response with tools
  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { content } = req.body;
    const conversationId = parseInt(req.params.id);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Keep track of whether headers have been sent
    let headersSent = false;
    const keepAlive = setInterval(() => {
      if (!headersSent) {
        res.write(': keep-alive\n\n');
      }
    }, 15000);

    try {
      // Save user message
      await db.insert(messages).values({
        conversationId,
        role: "user",
        content,
        contextSnapshot: {},
        createdAt: new Date()
      });

      // Update conversation timestamp
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      try {
        const stream = await AssistantService.processMessage(content, conversationId);

        headersSent = true;
        for await (const chunk of stream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
      } catch (error) {
        console.error('Streaming error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!headersSent) {
          res.status(500).json({ error: errorMessage });
        } else {
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        }
      }
    } catch (error) {
      console.error('Request error:', error);
      if (!headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
      }
    } finally {
      clearInterval(keepAlive);
      if (!res.closed) {
        res.end();
      }
    }
  });

  return httpServer;
}