"""Exact decimal inputs and rational arithmetic; rounding only at serialization."""

from decimal import Context, Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
import re

DECIMAL = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?\Z")
CAPACITY = {
    "B": 1,
    "KB": 1000,
    "MB": 1000**2,
    "GB": 1000**3,
    "TB": 1000**4,
    "KiB": 1024,
    "MiB": 1024**2,
    "GiB": 1024**3,
    "TiB": 1024**4,
}
SOURCE_MB = "MB-as-labeled-in-source"


def number(value):
    if not isinstance(value, str) or len(value) > 64 or not DECIMAL.fullmatch(value):
        raise ValueError(
            "Use a plain decimal string, without exponent, percent sign or whitespace."
        )
    if len(value.replace("-", "").replace(".", "")) > 30:
        raise ValueError("At most 30 decimal digits are supported.")
    return Fraction(Decimal(value))


def decimal_text(value):
    """Exact for terminating values, otherwise 50 significant digits, half even."""
    value = Fraction(value)
    denominator = value.denominator
    twos = fives = 0
    while denominator % 2 == 0:
        twos += 1
        denominator //= 2
    while denominator % 5 == 0:
        fives += 1
        denominator //= 5
    terminating = denominator == 1
    precision = (
        max(50, len(str(abs(value.numerator))) + max(twos, fives) + 4)
        if terminating
        else 50
    )
    with localcontext(Context(prec=precision, rounding=ROUND_HALF_EVEN)):
        text = format(Decimal(value.numerator) / Decimal(value.denominator), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def exact(value):
    value = Fraction(value)
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def rounded(value, places=0, mode="half-up"):
    value = Fraction(value) * 10**places
    if value < 0:
        raise ValueError("Sizing results cannot be negative.")
    whole, rest = divmod(value.numerator, value.denominator)
    if mode == "ceiling":
        whole += bool(rest)
    elif mode == "half-up":
        whole += rest * 2 >= value.denominator
    else:
        raise ValueError("Unknown rounding mode.")
    return decimal_text(Fraction(whole, 10**places))


def convert(value, unit, target):
    if unit == target and unit in {*CAPACITY, SOURCE_MB}:
        return value
    if unit not in CAPACITY or target not in CAPACITY:
        raise ValueError(
            "Ambiguous source MB cannot be converted; use explicit physical units."
        )
    return value * Fraction(CAPACITY[unit], CAPACITY[target])
