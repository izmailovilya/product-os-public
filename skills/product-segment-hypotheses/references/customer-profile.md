# Customer profile contract

`bin/customer-profile.js` in the installed product-os-tools runtime exports the shared
schema, prompt and validator used by profile writes and the console. Run it via the
tools directory of your runtime, not a private path.

- `version: 1`; `group: {id, label}` is a stable navigation family, not a research claim.
- `summary`, `context`, `recognition`, `whySeparate`, `primaryJob`, `productFit`, `alternatives`.
- `successCriteria[]`, `otherJobs[]`: unknown ordering is not invented priority.
- `roles`: `user`, `decisionMaker`, `payer`.
- `journey`: `trigger`, `discovery`, `firstUse`, `purchase`, `retention`.
- `unknowns[]`: concrete unresolved questions.

Each statement is `{text, basis, sourceRefs}`. Basis is `hypothesis`, `team`, `research`
or `unknown`. Team and research statements require an attributable source. An inference
from research remains `hypothesis`; it does not promote segment status or membership.
Unknowns are valid and should be specific. A source of context does not prove demand,
criteria priority, conversion, payment or profitability. Do not invent sources.

Persist as `segment.data.customerProfile` and `customerProfileSource`. Group headings
come from profile metadata. A subsegment has its own profile and a `sub_segment_of` edge
to another segment in the same group. No automatic inheritance of jobs, criteria or support.

The console renders `text` directly. Keep it short and concrete: plain prose a person
can read; IDs only in references; no workflow/review status inside customer
descriptions; do not derive needs from a README alone. Generated profiles must pass
the validator in `bin/customer-profile.js` (`customerProfileIssue`).
