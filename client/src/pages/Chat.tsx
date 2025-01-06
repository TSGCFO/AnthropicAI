import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationList } from "@/components/chat/ConversationList";
import { Conversation, Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Info, Menu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Chat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number>();

  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === selectedConversationId) || conversations[0];

  // Fetch messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [
      `/api/conversations/${currentConversation?.id}/messages`,
    ],
    enabled: !!currentConversation,
  });

  // Select first conversation when loaded
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/conversations", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversationId(newConversation.id);
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!currentConversation) throw new Error("No conversation selected");

      // Optimistically add user message
      const tempUserMessage: Message = {
        id: Date.now(),
        conversationId: currentConversation.id,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(
        [`/api/conversations/${currentConversation.id}/messages`],
        (old = []) => [...old, tempUserMessage]
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

      // Add temporary assistant message
      const tempAssistantMessage: Message = {
        id: Date.now() + 1,
        conversationId: currentConversation.id,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(
        [`/api/conversations/${currentConversation.id}/messages`],
        (old = []) => [...old, tempAssistantMessage]
      );

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
              assistantMessage += text;

              // Update temporary assistant message
              queryClient.setQueryData<Message[]>(
                [`/api/conversations/${currentConversation.id}/messages`],
                (old = []) => {
                  const messages = [...old];
                  const lastMessage = messages[messages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content = assistantMessage;
                  }
                  return messages;
                }
              );
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: [`/api/conversations/${currentConversation.id}/messages`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations"],
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen">
      {/* Mobile conversation list */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[300px]">
          <ConversationList
            conversations={conversations}
            currentId={currentConversation?.id}
            onSelect={(id) => setSelectedConversationId(id)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop conversation list */}
      <div className="hidden md:block w-[300px] border-r">
        <ConversationList
          conversations={conversations}
          currentId={currentConversation?.id}
          onSelect={(id) => setSelectedConversationId(id)}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b bg-background">
          <div>
            <h1 className="text-2xl font-semibold">Project Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Your specialized AI assistant for this project
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => createConversation.mutate()}
            disabled={createConversation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        {messages.length === 0 && (
          <Card className="m-4">
            <CardHeader>
              <CardTitle>Welcome to Your Project Assistant</CardTitle>
              <CardDescription>
                I'm here to help you with this project. I can:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Info className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <span>Understand and respond to your project-related questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <span>Provide relevant examples and explanations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <span>Help you understand project-specific concepts</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <ChatInput
          onSend={(content) => sendMessage.mutate(content)}
          disabled={sendMessage.isPending || !currentConversation}
        />
      </div>
    </div>
  );
}