from django.db import models

class CodeSuggestion(models.Model):
    file_path = models.CharField(max_length=255)
    code_snippet = models.TextField()
    suggestion = models.TextField()
    confidence = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    language = models.CharField(max_length=50)

    class Meta:
        ordering = ['-created_at']

class CodeAnalysis(models.Model):
    code_snippet = models.TextField()
    suggestions = models.JSONField()
    improvements = models.JSONField()
    security_concerns = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Code analyses'