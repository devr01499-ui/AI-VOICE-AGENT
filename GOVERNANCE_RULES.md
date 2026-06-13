# GOVERNANCE_RULES

## 1. Code Standards
- All code must be in TypeScript and use robust type annotations. Avoid `any` types.
- Components should reside in `/components` under correct subdirectories.
- Avoid inline Tailwind styles for complex components; define reusable class utilities or clean component abstractions.

## 2. Review Checklist
- [ ] TypeScript compiles with no errors.
- [ ] No placeholder components or missing interactive elements.
- [ ] Accessibility: all buttons and forms must have proper labels and focus indicators.
- [ ] Mobile responsive views verified down to 320px width.

## 3. Decision Protocol
- Every architectural choice requires:
  - Rationale and decision statement.
  - A rejected alternative and the reason it was rejected.
  - Trade-offs and consequences.
  - Verification check against existing architecture.
