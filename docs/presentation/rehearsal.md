# Waste Hub presentation rehearsal

Use the local demo at `http://localhost:3100`; it uses local PostgreSQL. Start the local database and `npm run demo:local` as described in the [runbook](../runbook.md). Existing sign-in details are in the ignored local access file; do not put passwords into slides.

1. **Business outcome:** show collection completion and missed stops on the overview. Explain that the municipality and records are synthetic.
2. **Sources:** open Integrations and show the seven source registrations. CSV and simulated provider snapshots feed the application; actual external provider connections are not implemented.
3. **Extract, transform, load:** choose **New import → Fleet & telemetry → CSV batch** and use [vehicles-example.csv](vehicles-example.csv). The first row is valid; the second has a missing registration and should be quarantined. Change sourceRecordId, registration and code values before a genuinely new demonstration; replaying identical content is deliberately idempotent. The local demo retains imported synthetic records and audit history.
4. **Correct and retry:** inspect the run, add a unique registration to the failed row, and retry it. The original successful row should not be duplicated.
5. **DQM:** run checks once, inspect a finding and its plain-language reason, then view trends. Explain that the score counts record-rule observations and acknowledging a finding does not change that measured score.
6. **Governance and output:** show the owner, steward, classification and audit trail, then open collection reliability. Explain that missing source-event evidence is a data gap, not proof of a missed collection. Retention periods are metadata, not automated deletion.

The source → integration → governance → output flowchart and comparison with Water Hub are in [the PowerPoint alignment review](../integration-pptx-review.md). The activity's five named industries do not include municipal waste; check with the instructor whether this chosen domain is acceptable.
