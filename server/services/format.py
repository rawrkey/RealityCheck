"""Small shared formatting helpers."""


def format_ms(ms: int) -> str:
    """Format milliseconds as HH:MM:SS."""
    ms = max(0, int(ms))
    total_seconds = ms // 1000
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"