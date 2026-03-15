# 🏗️ SOP: Anti-Gravity Automation Framework

This SOP defines the 3-layer architecture for the bidirectional JIRA-TestRail automation sync.

## 🎯 Goal
Automate the generation, sync, execution, and defect reporting for Anti-Gravity scenarios.

## 📂 Layered Architecture

### Layer 1: SOPs (Architecture)
- `architecture/automation_framework.md` (This file)
- `architecture/testrail_integration.md` (API logic & Data mapping)
- `architecture/jira_defect_reporting.md` (Bug lifecycle logic)

### Layer 2: Navigation (Reasoning)
- Handled by AI Agent using tools in `tools/automation/`.
- Logic flow: Generate -> Push to TestRail -> Execute -> Capture Evidence -> Create Bug (on fail) -> Link.

### Layer 3: Tools (Execution)
- Python scripts for atomic operations.
- Playwright for UI/API execution.

---

## 🛠️ Step 1: Generation & TestRail Sync Logic

### 1. Scenario Generation
- **Target:** Anti-Gravity feature.
- **Scenarios:** 
  1. Zero-Gravity Validation
  2. Lift Mechanisms
  3. Stability Controls
  4. Payload Limits
  5. Emergency Protocols
- **Format:** Title, Preconditions, Steps, Expected Result.

### 2. TestRail Matching
- Search for Project "Scrum 3" using `GET /get_projects`.
- If not found, create or use fallback.
- Push cases using `POST /add_case/{section_id}`.
- Map fields:
  - `priority_id`: 3 (High)
  - `type_id`: 3 (Automated)
  - `custom_prio`: 3 (High)
  - `custom_sprint`: "Current"

### 3. Traceability
- Save the returned `test_id` to the local `test_cases` table.
- Link to the relevant JIRA ticket key.

---

## ⚠️ Edge Cases
- **Duplicate Push:** Check local `testrail_id` or query TestRail by title before creating new.
- **Network Failure:** Retry logic (3 attempts).
- **ID Mismatch:** Refresh local ID if TestRail case is deleted/re-created.
