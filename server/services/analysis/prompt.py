"""Versioned ground-truth extraction prompts.

This prompt asks the model to extract only what is supported by the
transcript. It never generates coaching advice, sales language, or judgments
about what the rep "should have done" - those belong to later phases.
"""

from shared.schemas.analysis import GROUND_TRUTH_ANALYSIS_VERSION

SYSTEM_PROMPT = """\
You are the Ground Truth Analysis engine for RealityCheck, a tool that helps \
sales teams verify what actually happened on a sales call.

Your ONLY job is to extract factual and operational signals from the provided \
transcript. Follow these rules strictly.

1. ONLY extract information that is supported by the transcript text. If a fact \
is not present, do not include it.
2. Every extracted item MUST reference the transcript utterance IDs that support \
it in its evidence_utterance_ids list. Never guess an ID that is not in the \
provided transcript.
3. Never hallucinate missing information. If budget, deadline, or timeline was \
never stated, leave those fields null.
4. Represent uncertainty explicitly: use "unknown" levels and low confidence \
scores when the evidence is weak or ambiguous.
5. Distinguish explicit statements from inference. Confidence reflects how \
directly the transcript supports the item.
6. Do not decide who the salesperson is based only on the speaker label. \
Speakers are labeled SPEAKER_A, SPEAKER_B, etc. Infer roles only from what \
they SAY (for example, who asks about budget vs. who offers pricing). Use the \
"unknown" role if you cannot tell.
7. Do not generate coaching advice, recommendations, or persuasive sales \
language. Do not comment on what the salesperson "should have done".
8. Use these stable id prefixes: obj_ for objections, sig_ for buyer signals, \
stake_ for stakeholders, commit_ for commitments, step_ for next steps, \
price_ for pricing signals, tl_ for timeline signals, comp_ for competitors. \
Give every item a unique id.
9. Do not list generic sentiment. Only include buyer signals that reflect \
meaningful sales context (interest, concern, urgency, hesitation, \
commitment, comparison, or a request for next steps).
10. For the initial_ground_truth_assessment, this is an EARLY, evidence-based \
guess only, NOT a final verdict. Use "unknown" instead of guessing when there \
is not enough evidence.
"""

USER_PROMPT_TEMPLATE = """\
Analyze the following speaker-labeled sales call transcript.

{transcript}

Output the GroundTruthAnalysis JSON structure exactly as required by the \
response_format schema. Set prompt_version to "{prompt_version}".
"""


def format_transcript_for_analysis(transcript) -> str:
    """Render a Transcript into a speaker-labeled, id-anchored text block."""
    from server.services.format import format_ms

    lines = [f"Call id: {transcript.id}"]
    lines.append(f"Duration: {transcript.duration_seconds:.1f}s")
    lines.append(f"Language: {transcript.language}")
    lines.append("")
    for utterance in transcript.utterances:
        start = format_ms(utterance.start_ms)
        end = format_ms(utterance.end_ms)
        lines.append(
            f"[{utterance.id}] {utterance.speaker.value} ({start} - {end}): "
            f"{utterance.text}"
        )
    return "\n".join(lines)


def build_user_prompt(transcript) -> str:
    """Return the full user prompt for a given transcript."""
    block = format_transcript_for_analysis(transcript)
    return USER_PROMPT_TEMPLATE.format(
        transcript=block,
        prompt_version=GROUND_TRUTH_ANALYSIS_VERSION,
    )