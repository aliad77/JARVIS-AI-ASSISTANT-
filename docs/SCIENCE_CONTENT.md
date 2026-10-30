# Science content: coverage and provenance

The science lessons in `frontend/src/engine/science/topics.ts` are a **starter library**. They are **not** a complete or audited grade 7–12 curriculum. No mapping to NGSS or any national syllabus has been made or audited.

## Provenance policy

- The text was written for JARVIS in plain language (AI-assisted authoring). It was not copied from any source.
- Facts were limited to well-established textbook content. Each topic lists the open reference(s) it was checked against:
  - OpenStax *Biology 2e*, *Concepts of Biology*, *Chemistry 2e*, *Physics* (high school) and *College Physics 2e*, all CC BY 4.0
  - USGS Water Science School
  - NASA Science
  - NIST Fundamental Physical Constants
  - IUPAC Periodic Table
- Book-level references only. No chapter or page citations are given, so none can be wrong.
- Where values are approximate or debated, the topic has an "uncertainty" note. Examples: ATP yield per glucose, the number of human genes, the 10% energy rule, regional climate projections.
- **Review status: not yet reviewed by a qualified teacher.** A teacher should review the content before relying on it.

## Coverage (24 topics)

| Subject | Topics (grade range) |
|---|---|
| Biology | Cells (7–10), Photosynthesis (7–12), Cellular respiration (8–12), DNA & inheritance (8–12), Mitosis & meiosis (9–12), Ecosystems & food webs (7–10), Evolution (9–12) |
| Chemistry | Atoms (7–11), Periodic table (7–12), States of matter (7–9), Chemical reactions & conservation of mass (8–12), Acids, bases & pH (8–12) |
| Physics | Speed, velocity & acceleration (7–12), Forces & Newton's laws (7–12), Energy (7–12), Waves, sound & light (8–12), Electric circuits (8–12), Gravity, mass & weight (7–12) |
| Earth science | Water cycle (7–9), Plate tectonics (7–12), Rock cycle (7–9), Weather, climate & greenhouse effect (8–12), Seasons & solar system (7–10) |
| General science | Scientific method & fair tests (7–12) |

Each topic has:

- a basic (grades 7–9) and an advanced (grades 10–12) summary
- key points and definitions
- a worked example
- at least 3 multiple-choice concept checks with explanations
- practice questions with model answers
- its sources

Automated tests check the structure: four distinct choices per question, valid answer indexes, sources present.

## Known gaps

Not yet covered, among others:

- organic chemistry, stoichiometry calculations, thermodynamics, electromagnetism beyond circuits, nuclear physics
- human body systems, astronomy beyond the solar system, ecology cycles (carbon and nitrogen)

Questions outside the library get an honest "I can't find that in my built-in lessons" reply. If local AI is on, they get a clearly labelled on-device AI answer.
