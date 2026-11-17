# CLIENT-RECRUIT-PREVIEW-NUMERIC-001

The read-only recruit preview now returns null for non-finite or unsafe
quantities, and for batches whose computed resource costs or duration are
not safe JavaScript integers. This prevents NaN comparisons from reporting
an invalid batch as affordable and avoids displaying rounded batch costs.

Positive finite fractional quantities retain the existing floor behavior.
Normal unit costs, wallet comparison, server validation and RPCs are unchanged.
The existing form treats a null preview as unavailable and disables its button.
This change sets no gameplay limit and does not authorize recruitment.

Regression coverage includes NaN, infinities, non-positive quantities, unsafe
integers, existing fractional behavior and each unit's safe product boundary.
The new regression suite failed 7 cases on the unmodified implementation.
Validation is pure calculation and existing DOM unit testing, not a claim of
real-browser or production acceptance.
