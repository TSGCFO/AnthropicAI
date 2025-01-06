from django.db import models

class CodeSuggestion(models.Model):
    file_path = models.CharField(max_length=255)
    code_snippet = models.TextField()
    suggestion = models.TextField()
    confidence = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    language = models.CharField(max_length=50)
    explanation = models.TextField(null=True, blank=True)
    related_files = models.JSONField(default=list)
    test_cases = models.TextField(null=True, blank=True)
    context = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']

class CodeAnalysis(models.Model):
    code_snippet = models.TextField()
    suggestions = models.JSONField()
    improvements = models.JSONField()
    security_concerns = models.JSONField()
    patterns = models.JSONField(default=list)
    database_impact = models.JSONField(default=list)
    api_considerations = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Code analyses'

class CodePattern(models.Model):
    """Store common code patterns from LedgerLink for better suggestions"""
    name = models.CharField(max_length=100)
    pattern_type = models.CharField(max_length=50)
    code_template = models.TextField()
    description = models.TextField()
    usage_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-usage_count', '-last_used']