# Claritiy Voice — Human Call Intelligence Labeling Guide
Version: 1.0.0
Author: Applied-ML & Evaluation Engineering

## 1. Objective
Produce authoritative, ground-truth human labels for call transcripts to evaluate and calibrate the Claritiy Voice post-call report analysis system. Accuracy and truthfulness supersede coverage. If a call is ambiguous or uninterpretable, label it `Unclear`.

## 2. General Principles
1. **Speaker Attribution**: Facts about the caller must come exclusively from what the caller said. If the agent prompts or repeats something (e.g., *"So you have five years experience with Node.js?"*) and the caller does not explicitly confirm, the caller does **not** have that attribute recorded.
2. **Verbatim Evidence Grounding**: Every assigned label and extracted field must cite an exact verbatim quote and segment index from the transcript turns.
3. **Abstention Over Guessing**: If a piece of information was not stated by the caller, record `null` (Not Stated). Never infer or guess values based on caller tone or accent.
4. **Second-Labeler Agreement**: 20% of calls in every evaluation batch are labeled independently by a second human reviewer. Where Cohen's Kappa or agreement is below 85%, the label definition or tie-break rule is ambiguous and must be refined before evaluating the model.

## 3. Signal Hierarchy & Tie-Break Rules
1. **Telephony & Connection Facts**: Unanswered calls (`No Answer`), busy tones (`Busy`), and carrier drops (`Failed`) resolve immediately.
2. **System & Tool Events**: A verified calendar tool success (`schedule_event` / `book_appointment`) always means `Booked`, regardless of conversational nuances.
3. **Deterministic Opt-Out**: Any explicit request for DNC / do not call resolves to `Opted Out`.
4. **Mutually Exclusive Labels**: When multiple conversational topics arise, follow the blueprint's numerical priority order (Priority 1 wins over Priority 2).

## 4. Vertical Label Definitions & Examples

### Receptionist (`tpl-1`)
* `Priority Escalated` (Priority 1): Active service outage or critical issue requiring tier-2 support.
* `Sales Demo Scheduled` (Priority 2): Agreement to sales consultation or demo slot.
* `Support Ticket Logged` (Priority 3): Routine non-urgent technical questions.
* `Self-Service Link Dispatched` (Priority 4): Billing/account portal links sent via SMS.
* `Information Provided` (Priority 5): Office timings, location, general facts.
* `Unclear` (Priority 99): Dropped before intent was determined.

### Recruitment Pre-screening (`tpl-12`)
* `Interview Scheduled` (Priority 1): Candidate agreed to a specific interview slot.
* `Strong Fit` (Priority 2): Meets experience, CTC, notice period, and expressed interest.
* `Compensation Mismatch` (Priority 3): Expected CTC exceeds role budget.
* `Not Looking` (Priority 4): Stated they are happy in current role.
* `Unclear` (Priority 99): Silent or hung up before screening.

### Debt Collections & EMI Recovery (`tpl-15`)
* `Severe Distress / Emergency` (Priority 1): Hospitalization, bereavement, emergency. Immediate compassionate hold.
* `Promise to Pay` (Priority 2): Borrower committed to specific date and amount.
* `Dispute / Already Paid` (Priority 3): Claims payment was already made or disputes statement.
* `Financial Hardship` (Priority 4): Job loss or business closure, requesting restructuring.
* `Refusal to Pay` (Priority 5): Explicit refusal or hostile non-cooperation.
* `Unclear` (Priority 99): Disconnected before status determined.
