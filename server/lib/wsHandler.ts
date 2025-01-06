import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { generateCodeSuggestion, analyzeCode, explainCode } from './codeai';

interface CodeMessage {
  type: 'suggestion' | 'analysis' | 'explanation';
  content: {
    code: string;
    cursor?: number;
    language?: string;
    file?: string;
  };
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/codeai',
  });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', async (message) => {
      try {
        const data: CodeMessage = JSON.parse(message.toString());

        switch (data.type) {
          case 'suggestion':
            const suggestion = await generateCodeSuggestion({
              currentFile: data.content.file || '',
              fileContent: data.content.code,
              cursor: data.content.cursor || 0,
              language: data.content.language || 'python',
            });
            ws.send(JSON.stringify({
              type: 'suggestion',
              content: suggestion,
            }));
            break;

          case 'analysis':
            const analysis = await analyzeCode(data.content.code);
            ws.send(JSON.stringify({
              type: 'analysis',
              content: analysis,
            }));
            break;

          case 'explanation':
            const explanation = await explainCode(data.content.code);
            ws.send(JSON.stringify({
              type: 'explanation',
              content: explanation,
            }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              content: 'Invalid message type',
            }));
        }
      } catch (error) {
        console.error('WebSocket error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: error.message,
        }));
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      content: 'Connected to Code AI WebSocket Server',
    }));
  });

  return wss;
}