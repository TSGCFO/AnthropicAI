import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, FileCode, Folder, ChevronRight, ChevronDown, GitFork, Network } from "lucide-react";
import { ContextMap } from "@/components/code/ContextMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  language?: string;
}

interface CodeRelationship {
  nodes: Array<{
    id: string;
    label: string;
    type: "file" | "function" | "class" | "pattern";
    metadata?: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    type: "imports" | "calls" | "extends" | "implements" | "uses";
  }>;
}

export function CodeBrowser() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState("");
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [showContextMap, setShowContextMap] = useState(false);
  const queryClient = useQueryClient();

  // Clone repository mutation
  const cloneRepository = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/codebase/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      });

      if (!response.ok) {
        throw new Error('Failed to clone repository');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/codebase/tree"] });
      toast({
        title: "Repository cloned",
        description: "The repository has been successfully cloned.",
      });
      setIsCloneDialogOpen(false);
      setRepoUrl("");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clone repository",
      });
    },
  });

  // Query for file tree
  const { data: fileTree, isLoading } = useQuery<FileNode>({
    queryKey: ["/api/codebase/tree"],
  });

  // Query for code relationships
  const { data: relationships, isLoading: isLoadingRelationships } = useQuery<CodeRelationship>({
    queryKey: ["/api/codebase/relationships"],
    enabled: showContextMap,
  });

  // Query for file content
  const { data: fileData, isLoading: isLoadingContent } = useQuery<{ content: string }>({
    queryKey: ["/api/codebase/file", selectedFile?.path],
    enabled: !!selectedFile?.path,
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

  const handleNodeClick = (node: { id: string; type: string }) => {
    if (node.type === 'file') {
      const file = findFileByPath(fileTree, node.id);
      if (file) {
        setSelectedFile(file);
      }
    }
  };

  const findFileByPath = (tree: FileNode | null, path: string): FileNode | null => {
    if (!tree) return null;
    if (tree.path === path) return tree;
    if (tree.children) {
      for (const child of tree.children) {
        const found = findFileByPath(child, path);
        if (found) return found;
      }
    }
    return null;
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
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex gap-2">
            <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <GitFork className="h-4 w-4" />
                  Clone Repository
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clone Repository</DialogTitle>
                  <DialogDescription>
                    Enter the URL of the GitHub repository you want to clone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="repo-url">Repository URL</Label>
                    <Input
                      id="repo-url"
                      placeholder="https://github.com/username/repo.git"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => cloneRepository.mutate(repoUrl)}
                    disabled={cloneRepository.isPending || !repoUrl}
                    className="w-full"
                  >
                    {cloneRepository.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cloning...
                      </>
                    ) : (
                      'Clone Repository'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowContextMap(!showContextMap)}
            >
              <Network className="h-4 w-4" />
              {showContextMap ? 'Hide' : 'Show'} Context Map
            </Button>
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
              No repositories found. Clone a repository to get started.
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {showContextMap ? (
          <Card className="m-4 flex-1">
            <CardHeader>
              <CardTitle>Code Relationships</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {isLoadingRelationships ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : relationships ? (
                <ContextMap
                  nodes={relationships.nodes}
                  edges={relationships.edges}
                  onNodeClick={handleNodeClick}
                  className="h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No code relationships found
                </div>
              )}
            </CardContent>
          </Card>
        ) : selectedFile ? (
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
                Select a file from the sidebar to view its contents, or use the context map to explore code relationships.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}