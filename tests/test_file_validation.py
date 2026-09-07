"""File validation tests (unit + API)."""

import io

import pytest
from fastapi import HTTPException

from server.api.routes.calls import _read_and_validate_upload


class FakeUpload:
    def __init__(self, filename: str, payload: bytes) -> None:
        self.filename = filename
        self.file = io.BytesIO(payload)


def _expect_http_exception(upload, status_code: int, message_part: str) -> None:
    with pytest.raises(HTTPException) as exc_info:
        _read_and_validate_upload(upload)
    assert exc_info.value.status_code == status_code
    assert message_part.lower() in str(exc_info.value.detail).lower()


def test_rejects_missing_file() -> None:
    _expect_http_exception(None, 400, "No file provided")


def test_rejects_unsupported_extension() -> None:
    _expect_http_exception(FakeUpload("script.exe", b"data"), 400, "Unsupported file type")


def test_rejects_empty_file() -> None:
    _expect_http_exception(FakeUpload("demo.wav", b""), 400, "empty")


def test_accepts_valid_wav() -> None:
    upload = FakeUpload("demo.wav", b"RIFF data")
    filename, data = _read_and_validate_upload(upload)
    assert filename == "demo.wav"
    assert data == b"RIFF data"


def test_api_missing_file_returns_4xx(client) -> None:
    response = client.post("/api/calls", files={})
    assert response.status_code in (400, 422)


def test_api_unsupported_type_returns_400(client) -> None:
    response = client.post(
        "/api/calls",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]