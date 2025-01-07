import { Switch, Route } from "wouter";
import { CodeAssistant } from "@/pages/CodeAssistant";
import { CodeBrowser } from "@/pages/CodeBrowser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Code, FileCode } from "lucide-react";
import { Link } from "wouter";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/code" component={CodeAssistant} />
      <Route path="/browse" component={CodeBrowser} />
    </Switch>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">AI-Powered Code Assistant</h1>
          <p className="text-xl text-muted-foreground">
            Your intelligent companion for software development
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/code">
            <Card className="p-6 hover:bg-accent cursor-pointer transition-colors">
              <div className="space-y-4">
                <Code className="w-12 h-12" />
                <h2 className="text-2xl font-semibold">Code Assistant</h2>
                <p className="text-muted-foreground">
                  Get real-time code suggestions and engage in natural conversations about your code
                </p>
              </div>
            </Card>
          </Link>

          <Link href="/browse">
            <Card className="p-6 hover:bg-accent cursor-pointer transition-colors">
              <div className="space-y-4">
                <FileCode className="w-12 h-12" />
                <h2 className="text-2xl font-semibold">Code Browser</h2>
                <p className="text-muted-foreground">
                  Browse and explore the codebase directly
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;