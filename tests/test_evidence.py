"""Evidence retrieval tests."""

from server.services.evidence import search_evidence
from shared.schemas.transcript import Transcript


def test_keyword_search_matches_case_insensitive(
    sample_transcript: Transcript, sample_analysis
) -> None:
    results = search_evidence(sample_transcript, query="BUDGET")
    assert len(results) == 1
    item = results[0]
    assert item.utterance_id == "utt_0001"
    assert "budget" in item.matched_reason.lower()


def test_keyword_search_no_matches_returns_empty(sample_transcript) -> None:
    assert search_evidence(sample_transcript, query="penguin") == []


def test_theoretical_evidence_by_analysis_item(
    sample_transcript, sample_analysis
) -> None:
    results = search_evidence(
        sample_transcript, analysis_item_id="commit_001", analysis=sample_analysis
    )
    assert [item.utterance_id for item in results] == ["utt_0003"]
    assert "commitment" in results[0].matched_reason


def test_evidence_by_analysis_item_unknown_id(sample_transcript, sample_analysis) -> None:
    assert (
        search_evidence(
            sample_transcript, analysis_item_id="nope", analysis=sample_analysis
        )
        == []
    )


def test_evidence_by_utterance_id(sample_transcript) -> None:
    results = search_evidence(sample_transcript, utterance_id="utt_0001")
    assert len(results) == 1
    assert results[0].text.startswith("Thanks")


def test_evidence_by_utterance_id_csv(sample_transcript) -> None:
    results = search_evidence(
        sample_transcript, utterance_ids="utt_0002, utt_0004"
    )
    assert [item.utterance_id for item in results] == ["utt_0002", "utt_0004"]


def test_no_filter_returns_everything(sample_transcript) -> None:
    results = search_evidence(sample_transcript)
    assert len(results) == 4
    assert all(item.matched_reason == "transcript utterance" for item in results)


def test_evidence_item_has_timestamp(sample_transcript) -> None:
    item = search_evidence(sample_transcript, utterance_id="utt_0002")[0]
    assert item.timestamp == "00:00:03"
    assert item.speaker.value == "SPEAKER_B"