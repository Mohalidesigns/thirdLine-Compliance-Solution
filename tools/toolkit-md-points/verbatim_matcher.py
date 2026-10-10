#!/usr/bin/env python3
"""
Python port of the intel module's VerbatimMarkerMatcher (and the ToolkitImportService
helpers that use it), so the offline points pass produces EXACTLY the same verbatim
points the runtime pipeline would have produced.

The matcher locates verbatim list points ("(a)", "b)", "c.", "(iii)", "1.", "7.1") inside
an obligation's verbatim description. A marker must exist as a REAL list marker — at the
start of the text or after whitespace / ; : — - — in one of the forms (m), m), m., or a
bare dotted number 7.1 — and the span starts at that marker. A marker that only occurs
inside a word ("c" in "accept") or only as a cross-reference ("paragraphs (b) to (g)",
"Article 31 (1)") is not found. A span ends at the next sibling (same family, later in
sequence) or at the next marker of a higher level (numbers above letters above roman
numerals).

This module is stdlib-only. It mirrors these Java symbols:
  VerbatimMarkerMatcher: normalizeMarker, isPlausible, findMarker, extractSpan, preamble,
                         stripMarkerPrefix
  ToolkitImportService:  extractExactSpan, toPointMapExact, stripMarkerPrefix
"""
from __future__ import annotations

import re

# Characters allowed immediately before a marker (besides start of text).
BOUNDARY = r"(?<![^\s;:\u2014\u2013])"

MARKER_CORE = re.compile(r"[A-Za-z]{1,6}|\d{1,3}(?:\.\d{1,3}){0,3}")

# Any list marker: (m) | m. or m) followed by whitespace | bare dotted number followed by whitespace.
ANY_MARKER = re.compile(
    BOUNDARY
    + r"(?:\(\s*([A-Za-z]{1,6}|\d{1,3})\s*\)"
    + r"|([A-Za-z]{1,6}|\d{1,3}(?:\.\d{1,3}){0,3})[.)](?=\s)"
    + r"|(\d{1,3}(?:\.\d{1,3}){1,3})(?=\s))"
)

ROMAN = re.compile(r"(?i)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})")
LIST_ROMAN = re.compile(r"(?i)[ivx]+")

# Words that, right before a marker, make it a cross-reference rather than a list item.
REFERENCE_WORDS = {
    "section", "sections", "subsection", "subsections", "sub-section", "sub-sections", "s", "ss", "sec",
    "paragraph", "paragraphs", "subparagraph", "subparagraphs", "sub-paragraph", "para", "paras",
    "article", "articles", "art", "regulation", "regulations", "reg", "regs", "rule", "rules",
    "clause", "clauses", "schedule", "schedules", "part", "parts", "item", "items", "chapter", "chapters",
    "to", "in", "of", "under", "with", "see", "per",
}

# Families
DIGIT = "DIGIT"
LOWER_ALPHA = "LOWER_ALPHA"
UPPER_ALPHA = "UPPER_ALPHA"
LOWER_ROMAN = "LOWER_ROMAN"
UPPER_ROMAN = "UPPER_ROMAN"


def normalize_marker(marker):
    """'(c)', ' c) ', 'c.' -> 'c'; None when the value cannot be a list marker."""
    if marker is None:
        return None
    m = re.sub(r"[()\s]", "", marker)
    while m.endswith(".") or m.endswith(")"):
        m = m[:-1]
    if not m or not MARKER_CORE.fullmatch(m) or not is_plausible(m):
        return None
    return m


def is_plausible(core):
    """Digits, a single letter, a doubled letter ('aa') or a valid roman numeral — not 'No'."""
    if not core:
        return False
    if core[0].isdigit():
        return True
    if len(core) == 1:
        return True
    if len(core) == 2 and core[0] == core[1]:
        return True
    return bool(LIST_ROMAN.fullmatch(core)) and bool(ROMAN.fullmatch(core))


def find_marker(text, marker, from_=0):
    """Index where `marker` appears as a real list marker at or after `from_`, or -1."""
    core = normalize_marker(marker)
    if text is None or core is None:
        return -1
    idx = _find_marker(text, core, from_, False)
    return idx if idx >= 0 else _find_marker(text, core, from_, True)


def _find_marker(text, core, from_, ignore_case):
    q = re.escape(core)
    dotted = "." in core
    regex = (BOUNDARY + r"(?:\(\s*" + q + r"\s*\)|" + q + r"\)|" + q + r"\.(?=\s|$)"
             + (r"|" + q + r"(?=\s)" if dotted else "") + r")")
    flags = re.IGNORECASE if ignore_case else 0
    pat = re.compile(regex, flags)
    pos = max(0, from_)
    while pos <= len(text):
        m = pat.search(text, pos)
        if not m:
            return -1
        if not _is_cross_reference(text, m.start(), text[m.start()] == "("):
            return m.start()
        pos = m.start() + 1
    return -1


def extract_span(text, marker, from_=0):
    """The verbatim span of `marker` (starting AT the marker), or None when not a real marker."""
    start = find_marker(text, marker, from_)
    if start < 0:
        return None
    core = normalize_marker(marker)
    own = ANY_MARKER.search(text, start)
    own_end = own.end() if (own and own.start() == start) else start + len(core)
    family = _family_of_own(core, text, start)
    end = len(text)
    m = ANY_MARKER.search(text, own_end)
    pos = own_end
    while pos < len(text) and m:
        cand = m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        paren = m.group(1) is not None
        if is_plausible(cand) and not _is_cross_reference(text, m.start(), paren) and _ends_span(core, family, cand):
            end = m.start()
            break
        pos = m.start() + 1
        m = ANY_MARKER.search(text, pos)
    span = text[start:end].strip()
    return span if span else None


def preamble(text):
    """Text before the first list marker (the lead-in), or the whole text when there is none."""
    if text is None:
        return None
    m = ANY_MARKER.search(text, 0)
    pos = 0
    while m:
        cand = m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        if is_plausible(cand) and not _is_cross_reference(text, m.start(), m.group(1) is not None):
            return text[:m.start()].strip()
        pos = m.start() + 1
        m = ANY_MARKER.search(text, pos)
    return text.strip()


def strip_marker_prefix(text, marker):
    """Removes a leading '(m)', 'm.', 'm)' or 'm:' (and a bare dotted '7.1') from `text`."""
    if text is None:
        return None
    core = normalize_marker(marker)
    if core is None:
        return text.strip()
    out = re.sub(r"^[\s\-\"]+", "", text)
    q = re.escape(core)
    out = re.sub(r"(?i)^\(\s*" + q + r"\s*\)\s*", "", out, count=1)
    out = re.sub(r"(?i)^" + q + r"[.):](\s+|$)", "", out, count=1)
    out = re.sub(r"(?i)^" + q + r"\s+-\s+", "", out, count=1)
    if "." in core:
        out = re.sub(r"^" + q + r"\s+", "", out, count=1)
    return out.strip()


# ── internals ──

def _is_cross_reference(text, idx, paren):
    i = idx - 1
    while i >= 0 and text[i].isspace():
        i -= 1
    if i < 0:
        return False
    # "Article 31 (1)" — a parenthesised marker right after a number is a sub-reference
    if paren and text[i].isdigit():
        return True
    j = i
    while j >= 0 and (text[j].isalpha() or text[j] == "-"):
        j -= 1
    if j == i:
        return False
    word = text[j + 1:i + 1].lower()
    return word in REFERENCE_WORDS


def _ends_span(own, own_family, cand):
    cf = _family_of_cand(cand, own_family, own)
    if cf == DIGIT and own_family == DIGIT:
        od, cd = _depth(own), _depth(cand)
        if cd > od:
            return False          # 7.1.1 inside 7.1
        if cd < od:
            return True           # 8 after 7.1
        return _compare_dotted(cand, own) > 0   # 7.2 after 7.1
    if cf == own_family:
        return _ordinal(cand, cf) > _ordinal(own, own_family)
    return _rank(cf) < _rank(own_family)


def _family_of_own(core, text, start):
    """A lone i/v/x is a letter when its predecessor letter is a marker before it."""
    if len(core) == 1 and LIST_ROMAN.fullmatch(core):
        prev = chr(ord(core[0]) - 1)
        before = text[:start]
        if find_marker(before, prev, 0) >= 0:
            return _alpha(core)
        return _roman(core)
    return _base_family(core)


def _family_of_cand(cand, own_family, own):
    if (len(cand) == 1 and LIST_ROMAN.fullmatch(cand)
            and own_family in (LOWER_ALPHA, UPPER_ALPHA)
            and len(own) == 1 and ord(cand[0]) == ord(own[0]) + 1):
        return _alpha(cand)
    return _base_family(cand)


def _base_family(core):
    if core[0].isdigit():
        return DIGIT
    if LIST_ROMAN.fullmatch(core) and ROMAN.fullmatch(core):
        return _roman(core)
    return _alpha(core)


def _alpha(s):
    return UPPER_ALPHA if s[0].isupper() else LOWER_ALPHA


def _roman(s):
    return UPPER_ROMAN if s[0].isupper() else LOWER_ROMAN


def _rank(f):
    return {DIGIT: 0, UPPER_ALPHA: 1, LOWER_ALPHA: 1, UPPER_ROMAN: 2, LOWER_ROMAN: 2}[f]


def _depth(dotted):
    s = re.sub(r"(\.0)+$", "", dotted)
    return len(s.split("."))


def _compare_dotted(a, b):
    x, y = a.split("."), b.split(".")
    for i in range(max(len(x), len(y))):
        xi = int(x[i]) if i < len(x) else 0
        yi = int(y[i]) if i < len(y) else 0
        if xi != yi:
            return 1 if xi > yi else -1
    return 0


def _ordinal(s, f):
    low = s.lower()
    if f == DIGIT:
        return int(low.split(".")[0])
    if f in (LOWER_ROMAN, UPPER_ROMAN):
        return _roman_value(low)
    v = 0
    for c in low:
        v = v * 26 + (ord(c) - ord("a") + 1)
    return v


def _roman_value(s):
    total = 0
    prev = 0
    for ch in reversed(s):
        v = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}.get(ch, 0)
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


# ── ToolkitImportService helpers built on the matcher ──

def extract_exact_span(description, marker, level=0):
    """Verbatim span for `marker`, starting AT the marker; None marker → the lead-in text."""
    if description is None:
        return None
    if marker is None:
        lead = preamble(description)
        return lead if lead else None
    return extract_span(description, marker, 0)


def to_point_map_exact(marker, exact_text, level, children, point_type):
    """Point map for a verbatim point whose text was cut from the description.

    Children are searched inside the parent's text; a child whose marker is not a real
    list marker there is dropped. Mirrors ToolkitImportService.toPointMapExact.
    """
    cleaned = strip_marker_prefix(exact_text, marker)
    m = {
        "marker": marker,
        "text": cleaned,
        "content": cleaned,
        "pointType": point_type,
        "level": level if level is not None else 0,
    }
    kids = []
    for c in (children or []):
        cm = c.get("marker")
        child_exact = None if cm is None else extract_span(exact_text, cm, 0)
        if child_exact is None:
            continue
        child_exact = strip_marker_prefix(child_exact, cm)
        if not child_exact or not child_exact.strip():
            continue
        kids.append(to_point_map_exact(cm, child_exact, c.get("level"), c.get("children"), point_type))
    m["children"] = kids
    return m