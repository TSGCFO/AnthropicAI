import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, Upload, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CodeEditorLib from "@uiw/react-textarea-code-editor";

interface CodePattern {
  id?: number; // Added id for pattern usage tracking
  name: string;
  description: string;
  code: string;
  confidence: number;
  context: Record<string, any>;
}

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [patterns, setPatterns] = useState<CodePattern[]>([]);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/codeai`);

    ws.onopen = () => {
      console.log("Connected to Code AI WebSocket");
      setIsConnected(true);
      setReconnectAttempt(0);
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
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);

      const maxReconnectAttempts = 5;
      const baseDelay = 1000;

      if (reconnectAttempt < maxReconnectAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempt), 30000);
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connectWebSocket();
        }, delay);
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to code assistance service. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    wsRef.current = ws;
  }, [toast, reconnectAttempt]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions: { [key: string]: string } = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
    };

    if (extension && extension in supportedExtensions) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCode(content);
        setFileName(file.name);
        toast({
          title: "File Loaded",
          description: `Successfully loaded ${file.name}`,
        });
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a supported code file",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!suggestions && !code) {
      toast({
        title: "Error",
        description: "No code to download",
        variant: "destructive",
      });
      return;
    }

    const content = suggestions || code;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `improved_${fileName}` : `code.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Code file has been downloaded",
    });
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

    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "Waiting for connection to Code AI service...",
        variant: "destructive",
      });
      connectWebSocket();
      return;
    }

    try {
      setIsLoading(true);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'suggestion',
          content: {
            code,
            language,
            cursor: code.length,
          }
        }));
      } else {
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
      }

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

  const requestPatterns = async () => {
    try {
      setIsLoadingPatterns(true);
      const response = await fetch('/api/patterns/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          limit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get pattern suggestions');
      }

      const suggestions = await response.json();
      setPatterns(suggestions);
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingPatterns(false);
    }
  };

  const applyPattern = async (pattern: CodePattern) => {
    try {
      await fetch('/api/patterns/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patternId: pattern.id, // Use pattern ID if available
          context: code,
          accepted: true,
        }),
      });

      setCode(pattern.code);
      onCodeChange?.(pattern.code);

      toast({
        title: "Pattern Applied",
        description: `Successfully applied pattern: ${pattern.name}`,
      });
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

  useEffect(() => {
    if (code.trim().length > 10) {
      requestPatterns();
    }
  }, [code]);

  return (
    <Card className="p-4 w-full">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Code Editor</h3>
            {fileName && (
              <span className="text-sm text-muted-foreground">
                {fileName}
              </span>
            )}
            {!isConnected && (
              <span className="text-sm text-red-500">
                (Disconnected)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".py,.js,.ts,.jsx,.tsx,.java,.cpp,.c,.cs,.go,.rs,.rb,.php,.swift,.kt"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!code && !suggestions}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
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

          {(suggestions || analysis || patterns.length > 0) && (
            <div className="space-y-4">
              <Tabs defaultValue="suggestions">
                <TabsList>
                  <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="patterns">
                    Patterns
                    {patterns.length > 0 && (
                      <span className="ml-2 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                        {patterns.length}
                      </span>
                    )}
                  </TabsTrigger>
                  {analysis?.patterns && (
                    <TabsTrigger value="detected">Detected</TabsTrigger>
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

                <TabsContent value="patterns">
                  <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Recommended Patterns</h4>
                        {isLoadingPatterns && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                      {patterns.map((pattern, index) => (
                        <div
                          key={index}
                          className="rounded-lg border p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium">{pattern.name}</h5>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(pattern.confidence * 100)}% match
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {pattern.description}
                          </p>
                          <div className="relative">
                            <CodeEditorLib
                              value={pattern.code}
                              language={language}
                              readOnly
                              padding={10}
                              style={{
                                fontSize: 12,
                                backgroundColor: "var(--background)",
                                fontFamily:
                                  "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
                              }}
                            />
                            <Button
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => applyPattern(pattern)}
                            >
                              Apply Pattern
                            </Button>
                          </div>
                        </div>
                      ))}
                      {patterns.length === 0 && !isLoadingPatterns && (
                        <p className="text-sm text-muted-foreground">
                          No patterns found for the current code context.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

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