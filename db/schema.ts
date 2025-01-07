import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic"),
  context: jsonb("context").default({}).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
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
  contextSnapshot: jsonb("context_snapshot").default({}).notNull(),
  feedback: integer("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationTopics = pgTable("conversation_topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  parentId: integer("parent_id").references(() => conversationTopics.id),
  contextData: jsonb("context_data").default({}).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  template: text("template").notNull(),
  contextRequirements: jsonb("context_requirements").default([]).notNull(),
  variables: jsonb("variables").default([]).notNull(),
  effectiveness: integer("effectiveness").default(0).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const codeSnippets = pgTable("code_snippets", {
  id: serial("id").primaryKey(),
  filePath: text("file_path").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull(),
  category: text("category").notNull(), 
  description: text("description"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

// Relations
export const conversationRelations = relations(conversations, ({ many, one }) => ({
  messages: many(messages),
  topic: one(conversationTopics, {
    fields: [conversations.topic],
    references: [conversationTopics.name],
  }),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const topicRelations = relations(conversationTopics, ({ one, many }) => ({
  parent: one(conversationTopics, {
    fields: [conversationTopics.parentId],
    references: [conversationTopics.id],
  }),
  children: many(conversationTopics),
}));

// Schemas for validation
export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export const insertTopicSchema = createInsertSchema(conversationTopics);
export const selectTopicSchema = createSelectSchema(conversationTopics);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const selectPromptTemplateSchema = createSelectSchema(promptTemplates);
export const insertCodePatternSchema = createInsertSchema(codePatterns);
export const selectCodePatternSchema = createSelectSchema(codePatterns);
export const insertPatternSuggestionSchema = createInsertSchema(patternSuggestions);
export const selectPatternSuggestionSchema = createSelectSchema(patternSuggestions);
export const insertCodeSnippetSchema = createInsertSchema(codeSnippets);
export const selectCodeSnippetSchema = createSelectSchema(codeSnippets);

// Types
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ConversationTopic = typeof conversationTopics.$inferSelect;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type CodeSnippet = typeof codeSnippets.$inferSelect;
export type CodePattern = typeof codePatterns.$inferSelect;
export type PatternSuggestion = typeof patternSuggestions.$inferSelect;