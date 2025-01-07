import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  role: text("role", { enum: ['user', 'assistant'] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const codePatterns = pgTable("code_patterns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  code: text("code").notNull(),
  tags: text("tags").array(),
  context: jsonb("context").notNull().default({}),
  usageCount: integer("usage_count").notNull().default(0),
  confidence: integer("confidence").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patternSuggestions = pgTable("pattern_suggestions", {
  id: serial("id").primaryKey(),
  patternId: integer("pattern_id")
    .references(() => codePatterns.id, { onDelete: 'cascade' })
    .notNull(),
  context: text("context").notNull(),
  confidence: integer("confidence").notNull(),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const patternSuggestionRelations = relations(patternSuggestions, ({ one }) => ({
  pattern: one(codePatterns, {
    fields: [patternSuggestions.patternId],
    references: [codePatterns.id],
  }),
}));

// Export schemas for validation
export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export const insertCodePatternSchema = createInsertSchema(codePatterns);
export const selectCodePatternSchema = createSelectSchema(codePatterns);
export const insertPatternSuggestionSchema = createInsertSchema(patternSuggestions);
export const selectPatternSuggestionSchema = createSelectSchema(patternSuggestions);

// Export types
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CodePattern = typeof codePatterns.$inferSelect;
export type PatternSuggestion = typeof patternSuggestions.$inferSelect;