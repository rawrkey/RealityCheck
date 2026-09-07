"""AssemblyAI speech-to-text service."""

from server.services.assemblyai.service import AssemblyAIServiceError, transcribe_audio

__all__ = ["AssemblyAIServiceError", "transcribe_audio"]