import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  onCodeChange?: (code: string) => void;
}

export function CodeEditor({ initialCode = "", language = "python", onCodeChange }: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Determine WebSocket protocol based on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/codeai`);

    ws.onopen = () => {
      console.log("Connected to Code AI WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'suggestion' && data.content) {
          setSuggestions(data.content.suggestion);
          setIsLoading(false);
        } else if (data.type === 'error') {
          toast({
            title: "Error",
            description: data.content,
            variant: "destructive",
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to code assistance service",
        variant: "destructive",
      });
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [toast]);

  const requestSuggestion = async () => {
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter some code first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/code/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          cursor: code.length,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get code suggestion');
      }

      const data = await response.json();
      setSuggestions(data.suggestion);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  return (
    <Card className="p-4 w-full">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Code Editor</h3>
          <Button
            onClick={requestSuggestion}
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Get Suggestions"
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <textarea
              value={code}
              onChange={handleCodeChange}
              className="w-full h-[400px] font-mono text-sm p-4 rounded-md border bg-background"
              placeholder="Enter your code here..."
            />
          </div>

          {suggestions && (
            <div className="space-y-2">
              <h4 className="font-medium">Suggestions</h4>
              <pre className="p-4 rounded-md bg-muted whitespace-pre-wrap overflow-auto max-h-[400px]">
                {suggestions}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}