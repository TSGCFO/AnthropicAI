import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, FileCode, Folder, ChevronRight, ChevronDown } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  language?: string;
}

export function CodeBrowser() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Query for file tree
  const { data: fileTree, isLoading } = useQuery<FileNode>({
    queryKey: ["/api/codebase/tree"],
  });

  // Query for file content
  const { data: fileData, isLoading: isLoadingContent } = useQuery<{ content: string }>({
    queryKey: ["/api/codebase/file", selectedFile?.path],
    enabled: !!selectedFile?.path,
    queryFn: async () => {
      const res = await fetch(`/api/codebase/file?path=${encodeURIComponent(selectedFile?.path!)}`);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
  });

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTree = (node: FileNode, level = 0) => {
    const isExpanded = expandedDirs.has(node.path);
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch && node.type === 'file') {
      return null;
    }

    return (
      <div key={node.path} style={{ marginLeft: `${level * 16}px` }}>
        <div 
          className={`flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer ${
            selectedFile?.path === node.path ? 'bg-accent' : ''
          }`}
          onClick={() => {
            if (node.type === 'directory') {
              toggleDir(node.path);
            } else {
              setSelectedFile(node);
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Folder className="h-4 w-4" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileCode className="h-4 w-4" />
            </>
          )}
          <span className="text-sm">{node.name}</span>
        </div>
        {node.type === 'directory' && isExpanded && node.children?.map(child => renderTree(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-screen">
      <div className="w-[300px] border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : fileTree ? (
            <div className="p-2">{renderTree(fileTree)}</div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              No files found
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <header className="flex items-center justify-between p-4 border-b bg-background">
              <div>
                <h2 className="font-semibold">{selectedFile.path}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedFile.language || 'Plain text'}
                </p>
              </div>
            </header>
            <ScrollArea className="flex-1">
              {isLoadingContent ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : fileData ? (
                <pre className="p-4 text-sm">
                  <code>{fileData.content}</code>
                </pre>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  Failed to load file content
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <Card className="m-4">
            <CardHeader>
              <CardTitle>Code Browser</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a file from the sidebar to view its contents.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}