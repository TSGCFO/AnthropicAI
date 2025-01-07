import { CodeEditor } from "@/components/code/CodeEditor";

export function CodeAssistant() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Code Assistant</h1>
          <p className="text-muted-foreground">
            Get real-time code suggestions and improvements powered by AI
          </p>
        </div>

        <CodeEditor 
          language="python"
          initialCode={`# Enter your Python code here\n# Example:\ndef process_transaction(amount: float):\n    pass`}
        />
      </div>
    </div>
  );
}
