"""Local call storage round-trip tests."""

from datetime import datetime, timezone

from server.services.storage import CallStore
from shared.schemas.call import CallRecord, CallStatus


def test_save_load_round_trip(tmp_call_store: CallStore) -> None:
    call = CallRecord(
        id="call_xyz",
        original_filename="a.wav",
        created_at=datetime.now(timezone.utc),
        status=CallStatus.ready,
    )
    tmp_call_store.save_call(call)

    loaded = tmp_call_store.load_call("call_xyz")
    assert loaded is not None
    assert loaded.id == "call_xyz"
    assert loaded.status == CallStatus.ready


def test_load_missing_returns_none(tmp_call_store: CallStore) -> None:
    assert tmp_call_store.load_call("nope") is None


def test_list_orders_newest_first(tmp_call_store: CallStore) -> None:
    older = CallRecord(
        id="call_1", original_filename="a.wav", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    newer = CallRecord(
        id="call_2", original_filename="b.wav", created_at=datetime(2026, 2, 1, tzinfo=timezone.utc)
    )
    tmp_call_store.save_call(older)
    tmp_call_store.save_call(newer)

    ids = [call.id for call in tmp_call_store.list_calls()]
    assert ids == ["call_2", "call_1"]


def test_save_source_audio(tmp_call_store: CallStore) -> None:
    path = tmp_call_store.save_source("call_9", ".wav", b"\x00\x01")
    assert path.exists()
    assert path.read_bytes() == b"\x00\x01"