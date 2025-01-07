import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CodeEditorLib from "@uiw/react-textarea-code-editor";

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  onCodeChange?: (code: string) => void;
}

interface CodeAnalysis {
  suggestions: string[];
  improvements: string[];
  security: string[];
  patterns?: string[];
  performance?: string[];
  maintainability?: string[];
}

export function CodeEditor({ initialCode = "", language = "python", onCodeChange }: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    // Determine WebSocket protocol based on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/codeai`);

    ws.onopen = () => {
      console.log("Connected to Code AI WebSocket");
      toast({
        title: "Connected",
        description: "Connected to Code AI service",
      });
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

  const requestAnalysis = async () => {
    try {
      const response = await fetch('/api/code/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze code');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const requestExplanation = async () => {
    try {
      const response = await fetch('/api/code/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: suggestions || code }),
      });

      if (!response.ok) {
        throw new Error('Failed to get code explanation');
      }

      const data = await response.json();
      setExplanation(data.explanation);
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

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
      await requestAnalysis();
      await requestExplanation();
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onCodeChange?.(newCode);

    // Debounce real-time suggestions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (newCode.trim().length > 10) {
        requestSuggestion();
      }
    }, 1000);
  };

  const copyToClipboard = async () => {
    if (suggestions) {
      await navigator.clipboard.writeText(suggestions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Code copied to clipboard",
      });
    }
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
            <label className="text-sm font-medium">Your Code</label>
            <div className="relative">
              <CodeEditorLib
                value={code}
                language={language}
                onChange={(e) => handleCodeChange(e.target.value)}
                padding={15}
                style={{
                  fontSize: 14,
                  backgroundColor: "var(--background)",
                  fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  minHeight: "400px",
                }}
                className="min-h-[400px]"
              />
            </div>
          </div>

          {(suggestions || analysis) && (
            <div className="space-y-4">
              <Tabs defaultValue="suggestions">
                <TabsList>
                  <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  {analysis?.patterns && (
                    <TabsTrigger value="patterns">Patterns</TabsTrigger>
                  )}
                  {analysis?.performance && (
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                  )}
                  {analysis?.maintainability && (
                    <TabsTrigger value="maintainability">Maintainability</TabsTrigger>
                  )}
                  {explanation && (
                    <TabsTrigger value="explanation">Explanation</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="suggestions">
                  {suggestions && (
                    <ScrollArea className="h-[400px] w-full rounded-md border">
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Improved Code</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyToClipboard}
                            className="h-8"
                          >
                            {copied ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <CodeEditorLib
                          value={suggestions}
                          language={language}
                          readOnly
                          padding={15}
                          style={{
                            fontSize: 14,
                            backgroundColor: "var(--background)",
                            fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
                          }}
                        />
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="analysis">
                  {analysis && (
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div className="space-y-4">
                        {analysis.suggestions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Suggestions</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.suggestions.map((suggestion, i) => (
                                <li key={i} className="text-sm">{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.improvements.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Improvements</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.improvements.map((improvement, i) => (
                                <li key={i} className="text-sm">{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.security.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Security Considerations</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.security.map((issue, i) => (
                                <li key={i} className="text-sm">{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.maintainability && analysis.maintainability.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Maintainability</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.maintainability.map((item, i) => (
                                <li key={i} className="text-sm">{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysis.patterns && analysis.patterns.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Detected Patterns</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.patterns.map((pattern, i) => (
                                <li key={i} className="text-sm">{pattern}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysis.performance && analysis.performance.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Performance Analysis</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.performance.map((item, i) => (
                                <li key={i} className="text-sm">{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {analysis?.patterns && (
                  <TabsContent value="patterns">
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div>
                        <h4 className="font-medium mb-2">Detected Patterns</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.patterns.map((pattern, i) => (
                            <li key={i} className="text-sm">{pattern}</li>
                          ))}
                        </ul>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}

                {analysis?.performance && (
                  <TabsContent value="performance">
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div>
                        <h4 className="font-medium mb-2">Performance Analysis</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.performance.map((item, i) => (
                            <li key={i} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}

                {analysis?.maintainability && (
                  <TabsContent value="maintainability">
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div>
                        <h4 className="font-medium mb-2">Maintainability</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.maintainability.map((item, i) => (
                            <li key={i} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}

                {explanation && (
                  <TabsContent value="explanation">
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div className="prose prose-sm max-w-none">
                        <h4 className="font-medium mb-2">Code Explanation</h4>
                        <div className="whitespace-pre-wrap text-sm">
                          {explanation}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}