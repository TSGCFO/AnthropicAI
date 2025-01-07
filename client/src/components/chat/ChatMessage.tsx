import { cn } from "@/lib/utils";
import { Message } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasContext = message.contextSnapshot && Object.keys(message.contextSnapshot).length > 0;

  const getContextValue = (path: string[]) => {
    let current = message.contextSnapshot;
    for (const key of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  };

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className={cn(
        "h-8 w-8",
        isUser ? "bg-primary" : "bg-secondary"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </Avatar>

      <div className="flex flex-col gap-2 max-w-[80%]">
        <Card className={cn(
          "max-w-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}>
          <CardContent className="p-3">
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {hasContext && !isUser && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronDown className="h-4 w-4" />
                Show Context
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2 bg-muted">
                <CardContent className="p-3">
                  <div className="text-xs space-y-2">
                    {getContextValue(['topic']) && (
                      <div>
                        <span className="font-semibold">Topic:</span> {getContextValue(['topic'])}
                      </div>
                    )}
                    {getContextValue(['codeContext']) && (
                      <>
                        {getContextValue(['codeContext', 'language']) && (
                          <div>
                            <span className="font-semibold">Language:</span>{' '}
                            {getContextValue(['codeContext', 'language'])}
                          </div>
                        )}
                        {Array.isArray(getContextValue(['codeContext', 'patterns'])) && (
                          <div>
                            <span className="font-semibold">Patterns:</span>{' '}
                            {(getContextValue(['codeContext', 'patterns']) as string[]).join(', ')}
                          </div>
                        )}
                        {getContextValue(['codeContext', 'projectContext']) && (
                          <div>
                            <span className="font-semibold">Project Context:</span>{' '}
                            {getContextValue(['codeContext', 'projectContext'])}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}