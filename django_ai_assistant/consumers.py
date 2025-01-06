import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .services import generate_code_suggestion, analyze_code
from .models import CodeSuggestion, CodeAnalysis

class CodeAssistantConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to Code Assistant WebSocket'
        }))

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            content = data.get('content', {})

            if message_type == 'suggestion':
                suggestion = await self._handle_suggestion(content)
                await self.send(text_data=json.dumps({
                    'type': 'suggestion',
                    'content': suggestion
                }))
            elif message_type == 'analysis':
                analysis = await self._handle_analysis(content)
                await self.send(text_data=json.dumps({
                    'type': 'analysis',
                    'content': analysis
                }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'content': str(e)
            }))

    @database_sync_to_async
    def _handle_suggestion(self, content):
        suggestion = generate_code_suggestion(
            code=content.get('code', ''),
            cursor=content.get('cursor', 0),
            language=content.get('language', 'python'),
            file_path=content.get('file', '')
        )
        
        # Store suggestion in database
        CodeSuggestion.objects.create(
            user=self.scope['user'],
            file_path=content.get('file', ''),
            code_snippet=content.get('code', ''),
            suggestion=suggestion['suggestion'],
            confidence=suggestion['confidence'],
            language=content.get('language', 'python')
        )
        
        return suggestion

    @database_sync_to_async
    def _handle_analysis(self, content):
        analysis = analyze_code(content.get('code', ''))
        
        # Store analysis in database
        CodeAnalysis.objects.create(
            user=self.scope['user'],
            code_snippet=content.get('code', ''),
            suggestions=analysis['suggestions'],
            improvements=analysis['improvements'],
            security_concerns=analysis['security']
        )
        
        return analysis
