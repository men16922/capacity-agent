"""Capacity Agent's deterministic, offline calculation core."""

from .engine import calculate
from .benchmarks import compare_benchmark, requirement_from_result
from .rules import VERSION as __version__

__all__ = ["calculate", "compare_benchmark", "requirement_from_result", "__version__"]
