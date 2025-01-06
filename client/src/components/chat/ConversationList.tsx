import { Conversation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  conversations: Conversation[];
  currentId?: number;
  onSelect: (id: number) => void;
}

export function ConversationList({ conversations, currentId, onSelect }: ConversationListProps) {
  if (!conversations.length) return null;
  
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4">
        {conversations.map((conversation) => (
          <Button
            key={conversation.id}
            variant={conversation.id === currentId ? "secondary" : "ghost"}
            className={cn(
              "justify-start h-auto py-3 px-4",
              conversation.id === currentId && "bg-secondary"
            )}
            onClick={() => onSelect(conversation.id)}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-medium">{conversation.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
