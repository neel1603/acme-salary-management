from __future__ import annotations


class ConflictError(ValueError):
    """Raised when a write would violate a uniqueness rule the caller can fix (e.g. a duplicate email).

    Subclasses ValueError so a router that only knows about ValueError -> 422 still catches this as a
    fallback if a ConflictError -> 409 handler is ever missing from a given endpoint; a router that does
    handle it explicitly should catch ConflictError first to get the more precise 409.
    """
