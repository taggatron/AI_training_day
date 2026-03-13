# The Turing Tutor — JISC Presentation

This repository contains a lightweight, single-page presentation site for a talk to JISC on ethical and responsible use of AI in education. It introduces the Turing Tutor concept and the AI Assessment Scale (AIAS) as practical guardrails to support students’ ethical AI use in assessment.

## What this is

- A browser-based slide deck powered by static HTML/CSS/JS
- Entry point: `index.html`
- Purpose: present an overview of the Turing Tutor chatbot and the AI Assessment Scale (AIAS) as a framework for transparent, responsible AI usage in coursework and assessment.

## Narrative and key ideas

- Problem: Unchecked use of GenAI can undermine academic integrity and learning outcomes.
- Approach: Co-design an assistive "Turing Tutor" chatbot that guides planning, structure, and study strategies rather than generating work.
- Guardrails: The AI Assessment Scale (AIAS) clarifies acceptable AI involvement by levels:
  - 0 — No AI: independent work
  - 1 — Assistive: brainstorming, planning
  - 2 — Supported: drafting with signposting
  - 3 — High Involvement: significant AI shaping
  - 4 — Unacceptable: autonomous generation
- Ethics and governance: privacy by design, no personal data storage, transparency, human oversight for high-stakes cases, and ongoing risk review.

## Files

- `index.html` — the presentation slides
- `styles.css` — styling for the deck (layout, animations, components)
- `script.js` — interactions (slide navigation, timers, simple UI behavior)
- `TuringTutorShed.png` — image asset used in the opening story slide
- `20251009_1414_Remix Video_remix_01k74hqe06fjg8jbt9m03v8vfv.mp4` — short intro video
- `20251009_1524_Coffee Conversations_simple_compose_01k74np2bneb8aktd9kdc1tez8.png` — image used in the conversation slide

## Run locally

You can simply open `index.html` in your browser. For a cleaner experience (avoids any cross-origin issues and supports relative paths consistently), serve the folder with a basic HTTP server and open the root:

- macOS/Linux
  - Use Python 3 built-in server: `python3 -m http.server 8080`
  - Then visit: http://localhost:8080

- Node.js
  - Install once: `npm i -g serve`
  - Run: `serve .`

If this repo’s `package.json` contains a `start` script, you can also use:

- `npm start`

## Presenting to JISC

This deck is designed for a session with JISC stakeholders to:

- Frame the challenge: balancing innovation in AI with academic integrity
- Demonstrate the Turing Tutor approach: formative support, not ghostwriting
- Introduce the AI Assessment Scale (AIAS): a shared language for acceptable AI use
- Discuss governance and compliance: GDPR-conscious design, transparency, and human oversight
- Share pilot outcomes and next steps for scaling across curricula and VLEs

## Notes and future work

- Expand examples for each AIAS level with discipline-specific scenarios
- Add accessibility audits (ARIA, color contrast) and keyboard navigation for the deck
- Optional: package as a small static site with a lightweight bundler if needed

---

Questions or ideas? PRs and issues welcome.
