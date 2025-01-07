import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CodeEditor } from "@/components/code/CodeEditor";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Conversation, Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  Loader2, 
  Code, 
  MessageSquare, 
  FileCode,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function CodeAssistant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<number>();

  // Fetch current conversation
  const { data: currentConversation, isLoading: isLoadingConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations"],
    select: (conversations) => conversations[0],
  });

  // Fetch messages for current conversation
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery<{
    messages: Message[],
    context: Record<string, any>
  }>({
    queryKey: [
      `/api/conversations/${currentConversation?.id}/messages`,
    ],
    enabled: !!currentConversation,
  });

  const messages = messagesData?.messages ?? [];
  const context = messagesData?.context ?? {};

  // Create conversation if none exists
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Code Assistant Session",
          initialContext: {
            codeContext: {
              language: "typescript",
              projectContext: "AI Code Assistant Development"
            }
          }
        }),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setCurrentConversationId(newConversation.id);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create conversation",
      });
    }
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!currentConversation) throw new Error("No conversation selected");
      const content = isEditorOpen ? code : query;
      if (!content.trim()) return;

      // Add user message
      const tempUserMessage: Message = {
        id: Date.now(),
        conversationId: currentConversation.id,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<{ messages: Message[], context: Record<string, any> }>(
        [`/api/conversations/${currentConversation.id}/messages`],
        (old) => ({
          messages: [...(old?.messages || []), tempUserMessage],
          context: old?.context || {}
        })
      );

      const response = await fetch(
        `/api/conversations/${currentConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response reader");

      let assistantMessage = "";

      // Add assistant message placeholder
      const tempAssistantMessage: Message = {
        id: Date.now() + 1,
        conversationId: currentConversation.id,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<{ messages: Message[], context: Record<string, any> }>(
        [`/api/conversations/${currentConversation.id}/messages`],
        (old) => {
          if (!old) return { messages: [tempAssistantMessage], context: {} };
          return {
            messages: [...old.messages, tempAssistantMessage],
            context: old.context
          };
        }
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const { text } = JSON.parse(data);
                if (text) {
                  assistantMessage += text;

                  // Update assistant message
                  queryClient.setQueryData<{ messages: Message[], context: Record<string, any> }>(
                    [`/api/conversations/${currentConversation.id}/messages`],
                    (old) => {
                      if (!old) return { messages: [], context: {} };
                      const messages = [...old.messages];
                      const lastMessage = messages[messages.length - 1];
                      if (lastMessage.role === "assistant") {
                        lastMessage.content = assistantMessage;
                      }
                      return { ...old, messages };
                    }
                  );
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Clear inputs after sending
      if (isEditorOpen) {
        setCode("");
      } else {
        setQuery("");
      }

      // Invalidate queries to get fresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/conversations/${currentConversation.id}/messages`],
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
      });
    },
  });

  // Create initial conversation if needed
  useEffect(() => {
    if (!currentConversation && !isLoadingConversation) {
      createConversation.mutate();
    }
  }, [currentConversation, isLoadingConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoadingConversation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  const activeContext = context.activeContext || {};

  return (
    <div className="container mx-auto py-8 px-4 min-h-screen flex flex-col max-w-4xl">
      <div className="flex-1 flex flex-col space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">AI Code Assistant</h1>
          <p className="text-muted-foreground">
            Your intelligent companion for software development
          </p>
        </div>

        {/* Context Display */}
        {activeContext.currentFile && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  <span className="font-medium">Current File:</span>
                  <span className="text-muted-foreground">{activeContext.currentFile}</span>
                </div>
                {activeContext.language && (
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <span className="font-medium">Language:</span>
                    <span className="text-muted-foreground">{activeContext.language}</span>
                  </div>
                )}
                {activeContext.projectScope?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium">Scope:</span>
                    <span className="text-muted-foreground">
                      {activeContext.projectScope.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages Display */}
        <Card className="flex-1">
          <CardContent className="p-4 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading conversation...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <div className="space-y-2">
                  <p className="font-medium">Welcome to your AI Code Assistant</p>
                  <p className="text-sm text-muted-foreground">
                    Ask questions or share code for assistance
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditorOpen(!isEditorOpen)}
                className="gap-2"
              >
                <Code className="h-4 w-4" />
                {isEditorOpen ? "Hide Code Editor" : "Show Code Editor"}
                {isEditorOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Collapsible open={isEditorOpen}>
              <CollapsibleContent>
                <div className="border rounded-lg overflow-hidden mb-4">
                  <CodeEditor
                    language={activeContext.language || "typescript"}
                    value={code}
                    onChange={setCode}
                    className="min-h-[200px]"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[60px] p-3 rounded-lg border bg-background resize-none"
                placeholder={
                  isEditorOpen
                    ? "Add any additional context or questions about your code..."
                    : "Ask a question or describe what you need help with..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage.mutate();
                  }
                }}
              />
              <Button
                className="self-end"
                onClick={() => sendMessage.mutate()}
                disabled={
                  sendMessage.isPending ||
                  (!isEditorOpen && !query.trim()) ||
                  (isEditorOpen && !code.trim() && !query.trim())
                }
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}