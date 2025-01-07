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
import { Send, Loader2, Info } from "lucide-react";

export function CodeAssistant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(`# Welcome to the AI Code Assistant!
# You can:
# 1. Write or paste code for analysis and improvements
# 2. Ask questions about programming concepts
# 3. Get help with debugging and problem-solving

`);
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
              language: "python",
              projectContext: "AI Code Assistant"
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

  // Send code/query mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!currentConversation) throw new Error("No conversation selected");
      if (!code.trim()) return;

      // Add user message
      const tempUserMessage: Message = {
        id: Date.now(),
        conversationId: currentConversation.id,
        role: "user",
        content: code,
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
          body: JSON.stringify({ content: code }),
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

      // Clear the input after sending
      setCode("");

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

  return (
    <div className="container mx-auto py-8 px-4 min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold">AI Code Assistant</h1>
          <p className="text-muted-foreground">
            Your intelligent companion for software development
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Input Section */}
          <div className="flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Code & Query Input</CardTitle>
                <CardDescription>
                  Write code or ask questions in natural language
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CodeEditor 
                  language="python"
                  value={code}
                  onChange={setCode}
                  className="min-h-[400px]"
                />
                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={() => sendMessage.mutate()}
                    disabled={sendMessage.isPending || !code.trim()}
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

          {/* Response Section */}
          <div className="flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Assistant Response</CardTitle>
                <CardDescription>
                  View code suggestions and explanations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading conversation...</span>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <Info className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Start by writing code or asking a question
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}