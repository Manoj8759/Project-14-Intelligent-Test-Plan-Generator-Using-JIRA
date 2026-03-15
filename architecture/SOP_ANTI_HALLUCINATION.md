# 🎯 CRISP Plan: Anti-Hallucination Protocol Integration

> **Objective:** Implement deterministic, fact-based test plan generation by strictly adhering to the protocols defined in `ch_01_anti_hallucination.md`.

---

## 🏗️ 1. Architecture (Layer 1 SOP)
- **New SOP:** Create `architecture/SOP_ANTI_HALLUCINATION.md` to formalize these rules for the backend.
- **Role Enforcement:** Update the LLM system prompt to: *"You are a QA assistant operating under strict verification rules. Use ONLY provided info. Do NOT invent features."*

---

## 🛠️ 2. Core Logic (The 4-Step Chain)
Modify the generation service (`backend/src/services/llm-providers/`) to follow this chain:

1.  **Fact Extraction:** Parse JIRA ADF/Text for ACs and Summary.
2.  **Gap Identification:** Explicitly identify if JIRA fields (like AC) are missing.
3.  **Strict Generation:** Map identified facts to the PDF template structure.
4.  **Self-Check:** LLM must run a verification pass against the source ticket before returning the final payload.

---

## 📊 3. Data Schema Update
Update the `TestPlanGenerationSchema` in `gemini.md` to include verification metadata:
```json
{
  "verifiedFacts": ["string"],
  "missingInfo": ["string"],
  "content": "string (markdown)",
  "validationCheck": "boolean"
}
```

---

## 💻 4. UI Implementation
- **Source Panel:** Display "Verified Facts" and "Missing Data" in the Dashboard after fetching a ticket.
- **Inference Flags:** UI should highlight scenarios tagged as `[Inference]` in a different color (e.g., yellow badge).

---

## ✅ 5. Success Criteria
- [ ] 0% invented features in generated plans.
- [ ] Every assertion in the test plan corresponds to a specific line in the JIRA ticket.
- [ ] "Insufficient information" is returned when a critical field (like ticket summary) is missing.

---
*Generated based on ch_01_anti_hallucination.md ruleset.*
