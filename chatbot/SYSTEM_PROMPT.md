# SYSTEM PROMPTS REFERENCE — SnowDay Class

See [`../ai/snowday-school-agent.json`](../ai/snowday-school-agent.json) and [`../ai/AGENT_SETUP_AND_ARCHITECTURE.md`](../ai/AGENT_SETUP_AND_ARCHITECTURE.md) for the complete importable Geosoft AI Agent graph containing:
1. **`Mode Router` (`condition-mode-01`)** — Separates automated `[[MODE:GENERATE_LESSON]]` website generation requests from interactive student chat turns.
2. **`Student Lesson Tutor` (`agent-tutor-chat01`)** — Interactive bilingual tutor grounded in the teacher's Google Doc (`Google Doc Lesson Reader` tool) + school curriculum context, with 3-option chat quizzes and Geosoft JumpIn live teacher handoff.
3. **`Lesson Page Generator` (`agent-lesson-gen02`)** — Stateless JSON architect that converts any shared Google Doc lesson into Learning Cards, Hard Words Glossary, and a 3-Option Questionnaire for the SnowDay Class website.
