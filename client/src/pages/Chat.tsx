import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { Conversation, Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export function Chat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Get current conversation
  const currentConversation = conversations?.[0];

  // Fetch messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [
      `/api/conversations/${currentConversation?.id}/messages`,
    ],
    enabled: !!currentConversation,
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/conversations", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
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

      // Stream response
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

      // Invalidate messages query to get fresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/conversations/${currentConversation.id}/messages`],
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
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">AI Chat</h1>
        <Button
          variant="outline"
          size="icon"
          onClick={() => createConversation.mutate()}
          disabled={createConversation.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </header>

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
  );
}
