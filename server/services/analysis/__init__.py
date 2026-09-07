"""Ground-truth analysis service.

PLANNED → IMPLEMENTED in Phase 2: extracts factual signals from a transcript
via the AssemblyAI LLM Gateway with structured output.
"""

from server.services.analysis.service import AnalysisError, analyze_transcript, normalize_analysis

__all__ = [
    "AnalysisError",
    "analyze_transcript",
    "normalize_analysis",
]