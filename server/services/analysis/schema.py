"""Build a strict, self-contained JSON Schema from a Pydantic model.

The AssemblyAI LLM Gateway accepts an OpenAI-style ``json_schema``. Providers
(especially Gemini-class models) are most reliable with a fully inlined schema
with no ``$defs``/``$ref`` indirection, ``additionalProperties: false``, and
every field listed as required.
"""

import copy
from typing import Any

from shared.schemas.analysis import GroundTruthAnalysis


def _deref(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            name = ref.rsplit("/", 1)[-1]
            resolved = copy.deepcopy(defs.get(name, {}))
            resolved = _deref(resolved, defs)
            resolved.update({k: v for k, v in node.items() if k != "$ref"})
            return resolved
        return {k: _deref(v, defs) for k, v in node.items()}
    if isinstance(node, list):
        return [_deref(item, defs) for item in node]
    return node


def _require_all_properties(node: Any) -> None:
    if isinstance(node, dict):
        if "properties" in node:
            node["required"] = sorted(node["properties"].keys())
            node["additionalProperties"] = False
            for prop in node["properties"].values():
                _require_all_properties(prop)
        items = node.get("items")
        if isinstance(items, dict):
            _require_all_properties(items)
        for key in ("anyOf", "oneOf", "allOf"):
            for variant in node.get(key, []) or []:
                _require_all_properties(variant)


def ground_truth_json_schema() -> dict:
    """Return a strict, inlined JSON Schema for GroundTruthAnalysis."""
    schema = GroundTruthAnalysis.model_json_schema()
    schema = copy.deepcopy(schema)
    defs = schema.pop("$defs", {}) or schema.pop("definitions", {})
    schema = _deref(schema, defs)
    _require_all_properties(schema)
    return schema