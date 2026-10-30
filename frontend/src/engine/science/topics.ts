/**
 * Curated science topics for grades 7–12. See sources.ts for provenance policy.
 * Facts are deliberately limited to well-established, textbook-level content.
 * Where scientists use approximate or debated values, the text says so.
 */

export type ScienceSubject = "biology" | "chemistry" | "physics" | "earth_science" | "general_science";

export interface ConceptCheck {
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface ScienceTopic {
  id: string;
  subject: ScienceSubject;
  title: string;
  grades: [number, number];
  keywords: string[];
  summary: { basic: string; advanced: string };
  keyPoints: string[];
  definitions: { term: string; meaning: string }[];
  example: { title: string; body: string };
  checks: ConceptCheck[];
  practice: { question: string; answer: string }[];
  uncertainty?: string;
  sources: string[];
}

export const SUBJECT_NAMES: Record<ScienceSubject, string> = {
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  earth_science: "Earth science",
  general_science: "General science",
};

export const TOPICS: ScienceTopic[] = [
  // ------------------------------------------------------------------ BIOLOGY
  {
    id: "cells",
    subject: "biology",
    title: "Cells: the building blocks of life",
    grades: [7, 10],
    keywords: ["cell", "cells", "organelle", "nucleus", "mitochondria", "cell membrane", "cell wall", "cell theory", "prokaryote", "eukaryote"],
    summary: {
      basic: "All living things are made of cells. A cell is the smallest unit that can carry out the processes of life. Some living things are a single cell, like bacteria. Others, like you, are made of trillions of cells.",
      advanced: "Cell theory states that all organisms are made of one or more cells, the cell is the basic unit of life, and all cells come from pre-existing cells. Prokaryotic cells (bacteria and archaea) lack a nucleus and membrane-bound organelles; eukaryotic cells (plants, animals, fungi, protists) have a nucleus and specialised organelles that divide up the cell's work.",
    },
    keyPoints: [
      "The cell membrane controls what enters and leaves the cell.",
      "The nucleus holds the cell's DNA in eukaryotic cells.",
      "Mitochondria release energy from food through cellular respiration.",
      "Plant cells also have a cell wall and chloroplasts; animal cells do not.",
    ],
    definitions: [
      { term: "Organelle", meaning: "A small structure inside a cell that has a specific job." },
      { term: "Prokaryote", meaning: "A single-celled organism whose cell has no nucleus, such as a bacterium." },
      { term: "Eukaryote", meaning: "An organism whose cells have a nucleus." },
    ],
    example: { title: "Comparing cells", body: "A cell from an onion skin has a rigid cell wall and a large central vacuole, but no chloroplasts because it grows underground. A cheek cell has a cell membrane and nucleus but no cell wall." },
    checks: [
      { question: "Which structure controls what enters and leaves a cell?", choices: ["Cell membrane", "Nucleus", "Chloroplast", "Cell wall"], answer: 0, explanation: "The cell membrane is selectively permeable: it lets some substances through and keeps others out." },
      { question: "Which of these do plant cells have but animal cells do not?", choices: ["Mitochondria", "Nucleus", "Chloroplasts", "Cell membrane"], answer: 2, explanation: "Chloroplasts (for photosynthesis) are found in plant cells and some protists, not in animal cells." },
      { question: "According to cell theory, where do new cells come from?", choices: ["Non-living matter", "Pre-existing cells", "Sunlight", "Water"], answer: 1, explanation: "All cells come from pre-existing cells by cell division." },
    ],
    practice: [
      { question: "Name two organelles and describe the job of each.", answer: "Example: the nucleus stores DNA; mitochondria release energy from food (cellular respiration)." },
      { question: "What is the main difference between a prokaryotic and a eukaryotic cell?", answer: "Eukaryotic cells have a nucleus (and membrane-bound organelles); prokaryotic cells do not." },
    ],
    sources: ["openstax-conceptsbio", "openstax-bio2e"],
  },
  {
    id: "photosynthesis",
    subject: "biology",
    title: "Photosynthesis",
    grades: [7, 12],
    keywords: ["photosynthesis", "chlorophyll", "chloroplast", "plants make food", "glucose", "light energy", "calvin cycle", "stomata"],
    summary: {
      basic: "Photosynthesis is how plants make their own food. They use energy from sunlight to turn carbon dioxide from the air and water from the soil into glucose (a sugar). Oxygen is released as a by-product.",
      advanced: "Photosynthesis converts light energy into chemical energy stored in glucose. It happens in chloroplasts. The light-dependent reactions (in the thylakoid membranes) split water, release O₂, and make ATP and NADPH. The Calvin cycle (in the stroma) uses that ATP and NADPH to fix CO₂ into sugars.",
    },
    keyPoints: [
      "Overall equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.",
      "Chlorophyll is the green pigment that absorbs light, mainly red and blue light.",
      "The oxygen released comes from splitting water molecules.",
      "Photosynthesis provides the energy that most food chains depend on.",
    ],
    definitions: [
      { term: "Chlorophyll", meaning: "The green pigment in chloroplasts that absorbs light energy." },
      { term: "Glucose", meaning: "A sugar (C₆H₁₂O₆) that stores chemical energy." },
      { term: "Stomata", meaning: "Tiny openings, mostly on leaves, that let carbon dioxide in and oxygen and water vapour out." },
    ],
    example: { title: "Pondweed bubbles", body: "If you place pondweed in water under a lamp, it gives off bubbles of oxygen. Moving the lamp closer usually increases the number of bubbles, because more light means faster photosynthesis (until something else, like CO₂ or temperature, limits it)." },
    checks: [
      { question: "Which gas do plants take in for photosynthesis?", choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], answer: 1, explanation: "Plants take in carbon dioxide and release oxygen during photosynthesis." },
      { question: "Where in a plant cell does photosynthesis happen?", choices: ["Mitochondria", "Nucleus", "Chloroplast", "Vacuole"], answer: 2, explanation: "Chloroplasts contain chlorophyll and the enzymes for photosynthesis." },
      { question: "What is the source of the oxygen released in photosynthesis?", choices: ["Carbon dioxide", "Glucose", "Water", "Soil minerals"], answer: 2, explanation: "Experiments with labelled oxygen atoms showed the O₂ comes from water that is split in the light-dependent reactions." },
    ],
    practice: [
      { question: "Write the word equation for photosynthesis.", answer: "carbon dioxide + water → (light) → glucose + oxygen" },
      { question: "Give two factors that can limit the rate of photosynthesis.", answer: "Any two of: light intensity, carbon dioxide concentration, temperature (and water availability)." },
    ],
    sources: ["openstax-bio2e", "openstax-conceptsbio"],
  },
  {
    id: "cellular-respiration",
    subject: "biology",
    title: "Cellular respiration",
    grades: [8, 12],
    keywords: ["respiration", "cellular respiration", "atp", "mitochondria", "aerobic", "anaerobic", "fermentation", "glycolysis"],
    summary: {
      basic: "Cellular respiration is how cells release the energy stored in food. In most cells it uses oxygen to break down glucose, making carbon dioxide and water and releasing energy the cell can use.",
      advanced: "Aerobic respiration oxidises glucose to CO₂ and H₂O, capturing energy as ATP. It has three main stages: glycolysis (cytoplasm), the citric acid (Krebs) cycle, and oxidative phosphorylation with the electron transport chain (mitochondria). Without oxygen, many cells use fermentation, which releases much less ATP.",
    },
    keyPoints: [
      "Overall equation: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + energy (ATP).",
      "It is roughly the reverse of photosynthesis in terms of inputs and outputs.",
      "Plants do cellular respiration too, all the time, not only at night.",
      "Fermentation (anaerobic) produces lactic acid in muscles, or ethanol and CO₂ in yeast.",
    ],
    definitions: [
      { term: "ATP", meaning: "Adenosine triphosphate, the molecule cells use to carry and spend energy." },
      { term: "Aerobic", meaning: "Using oxygen." },
      { term: "Anaerobic", meaning: "Without oxygen." },
    ],
    example: { title: "Sore muscles", body: "During a sprint your muscles may need energy faster than oxygen can be delivered, so some cells use lactic acid fermentation for a short time." },
    checks: [
      { question: "Which organelle carries out most of aerobic respiration?", choices: ["Chloroplast", "Mitochondrion", "Ribosome", "Cell wall"], answer: 1, explanation: "The citric acid cycle and electron transport chain happen in mitochondria." },
      { question: "What are the products of aerobic respiration?", choices: ["Glucose and oxygen", "Carbon dioxide, water and energy", "Oxygen and water", "Lactic acid only"], answer: 1, explanation: "Glucose and oxygen react to give carbon dioxide, water and energy (ATP)." },
      { question: "Do plants carry out cellular respiration?", choices: ["No, only animals do", "Only at night", "Yes, all the time", "Only in their roots"], answer: 2, explanation: "Plant cells need ATP constantly, so they respire day and night." },
    ],
    practice: [{ question: "Why do your muscles need more oxygen during exercise?", answer: "They need more ATP, and aerobic respiration uses oxygen to release energy from glucose." }],
    uncertainty: "The exact number of ATP made per glucose is not fixed: modern estimates are about 30–32, while older textbooks often say 36–38.",
    sources: ["openstax-bio2e"],
  },
  {
    id: "dna-genetics",
    subject: "biology",
    title: "DNA, genes and inheritance",
    grades: [8, 12],
    keywords: ["dna", "gene", "genes", "genetics", "chromosome", "heredity", "inheritance", "allele", "dominant", "recessive", "punnett"],
    summary: {
      basic: "DNA is the molecule that carries the instructions for building and running a living thing. A gene is a section of DNA. You inherit half your DNA from each parent, which is why you share some traits with them.",
      advanced: "DNA is a double helix of two strands held together by base pairs: adenine with thymine, and cytosine with guanine. Genes are DNA sequences, most of which code for proteins. Different versions of a gene are called alleles; dominant alleles show their effect with one copy, recessive alleles only with two.",
    },
    keyPoints: [
      "Base-pairing rules: A pairs with T, and C pairs with G.",
      "Humans usually have 46 chromosomes (23 pairs) in each body cell.",
      "Each parent passes on one allele of each gene.",
      "A Punnett square predicts the probabilities of offspring genotypes.",
    ],
    definitions: [
      { term: "Gene", meaning: "A section of DNA that carries the instructions for a trait, usually by coding for a protein." },
      { term: "Allele", meaning: "One version of a gene." },
      { term: "Genotype / phenotype", meaning: "Genotype is the alleles an organism has; phenotype is the trait you can observe." },
    ],
    example: { title: "A Punnett square", body: "If both parents are Bb for a trait where B (brown) is dominant over b (blue), the Punnett square gives BB, Bb, Bb, bb: a 3 in 4 chance of the dominant trait and a 1 in 4 chance of the recessive trait for each child." },
    checks: [
      { question: "Which base pairs with adenine (A) in DNA?", choices: ["Cytosine", "Guanine", "Thymine", "Uracil"], answer: 2, explanation: "In DNA, A pairs with T and C pairs with G. (Uracil replaces thymine in RNA.)" },
      { question: "How many chromosomes are in a typical human body cell?", choices: ["23", "46", "92", "44"], answer: 1, explanation: "Typical human body cells have 46 chromosomes, arranged as 23 pairs." },
      { question: "Two Bb parents: what is the chance a child is bb?", choices: ["0", "1/4", "1/2", "3/4"], answer: 1, explanation: "The Punnett square gives BB, Bb, Bb, bb, so bb is 1 out of 4." },
    ],
    practice: [{ question: "What is the difference between a gene and an allele?", answer: "A gene is a section of DNA for a trait; alleles are different versions of that gene." }],
    uncertainty: "The number of human protein-coding genes is an estimate (roughly 20,000) and has been revised as research continues.",
    sources: ["openstax-bio2e", "openstax-conceptsbio"],
  },
  {
    id: "cell-division",
    subject: "biology",
    title: "Mitosis and meiosis",
    grades: [9, 12],
    keywords: ["mitosis", "meiosis", "cell division", "gamete", "diploid", "haploid"],
    summary: {
      basic: "Cells divide to make new cells. Mitosis makes two identical cells for growth and repair. Meiosis makes sex cells (eggs and sperm) with half the usual number of chromosomes.",
      advanced: "Mitosis produces two genetically identical diploid daughter cells and is used for growth, repair and asexual reproduction. Meiosis has two divisions and produces four genetically different haploid gametes; crossing over and independent assortment create genetic variation.",
    },
    keyPoints: [
      "Mitosis: 1 division → 2 identical cells.",
      "Meiosis: 2 divisions → 4 different cells with half the chromosomes.",
      "Fertilisation joins two haploid gametes to restore the diploid number.",
    ],
    definitions: [
      { term: "Diploid", meaning: "Having two sets of chromosomes (in humans, 46)." },
      { term: "Haploid", meaning: "Having one set of chromosomes (in human gametes, 23)." },
    ],
    example: { title: "Healing a cut", body: "When skin is damaged, nearby cells divide by mitosis to replace the lost cells with identical copies." },
    checks: [
      { question: "How many cells does meiosis produce from one cell?", choices: ["1", "2", "4", "8"], answer: 2, explanation: "Meiosis has two divisions, producing four haploid cells." },
      { question: "What is mitosis mainly used for?", choices: ["Making gametes", "Growth and repair", "Photosynthesis", "Digestion"], answer: 1, explanation: "Mitosis makes identical cells for growth and repair." },
      { question: "How many chromosomes are in a human egg cell?", choices: ["46", "23", "92", "12"], answer: 1, explanation: "Gametes are haploid, so a human egg has 23 chromosomes." },
    ],
    practice: [{ question: "Why must gametes be haploid?", answer: "So that when two gametes join at fertilisation, the offspring has the normal diploid number of chromosomes." }],
    sources: ["openstax-bio2e"],
  },
  {
    id: "ecosystems",
    subject: "biology",
    title: "Ecosystems and food webs",
    grades: [7, 10],
    keywords: ["ecosystem", "food chain", "food web", "producer", "consumer", "decomposer", "predator", "prey", "energy pyramid", "trophic"],
    summary: {
      basic: "An ecosystem is all the living things in an area plus their non-living surroundings. Energy flows from the Sun to producers (plants), then to consumers (animals that eat), and decomposers break down dead material.",
      advanced: "Energy flows through ecosystems in one direction while matter cycles. At each trophic level, most energy is used for life processes or lost as heat, so only a small fraction passes to the next level. This limits the length of food chains.",
    },
    keyPoints: [
      "Producers make their own food, usually by photosynthesis.",
      "Consumers can be herbivores, carnivores or omnivores.",
      "Decomposers (bacteria, fungi) recycle nutrients back into the soil.",
      "A food web shows many connected food chains.",
    ],
    definitions: [
      { term: "Trophic level", meaning: "A feeding level in a food chain (producer, primary consumer, and so on)." },
      { term: "Decomposer", meaning: "An organism that breaks down dead material and returns nutrients to the environment." },
    ],
    example: { title: "A simple food chain", body: "grass → rabbit → fox. The grass is the producer, the rabbit is a primary consumer (herbivore) and the fox is a secondary consumer (carnivore)." },
    checks: [
      { question: "In a food chain, what are plants?", choices: ["Producers", "Consumers", "Decomposers", "Predators"], answer: 0, explanation: "Plants produce their own food using light energy." },
      { question: "What do decomposers do?", choices: ["Make food from sunlight", "Hunt other animals", "Break down dead material", "Pollinate flowers"], answer: 2, explanation: "Decomposers recycle nutrients from dead organisms." },
      { question: "Why do food chains rarely have more than 4–5 levels?", choices: ["Animals get too big", "Most energy is lost at each level", "There isn't enough water", "Plants stop growing"], answer: 1, explanation: "Only a small fraction of energy passes to each next level, so there isn't enough for many levels." },
    ],
    practice: [{ question: "Draw a food chain with four organisms and label each one's role.", answer: "Example: algae (producer) → small fish (primary consumer) → large fish (secondary consumer) → heron (tertiary consumer)." }],
    uncertainty: "The common '10% rule' for energy transfer between levels is a rough average; real ecosystems vary widely.",
    sources: ["openstax-bio2e", "openstax-conceptsbio"],
  },
  {
    id: "evolution",
    subject: "biology",
    title: "Evolution by natural selection",
    grades: [9, 12],
    keywords: ["evolution", "natural selection", "darwin", "adaptation", "fossil", "species", "survival of the fittest"],
    summary: {
      basic: "Living things change over many generations. Individuals vary, and those with traits that help them survive and reproduce pass those traits on more often. Over time this is called evolution by natural selection.",
      advanced: "Natural selection, described by Charles Darwin and Alfred Russel Wallace, requires variation, inheritance of that variation, and differences in survival and reproduction. Over generations, beneficial heritable traits become more common in a population. Evidence includes fossils, comparative anatomy, DNA comparisons and directly observed changes such as antibiotic resistance.",
    },
    keyPoints: [
      "Populations evolve; individual organisms do not evolve during their lifetime.",
      "'Fittest' means best at surviving and reproducing in a particular environment, not strongest.",
      "Evolution is supported by many independent lines of evidence and is a central theory of biology.",
    ],
    definitions: [
      { term: "Adaptation", meaning: "An inherited trait that helps an organism survive and reproduce in its environment." },
      { term: "Species", meaning: "A group of organisms that can interbreed and produce fertile offspring." },
    ],
    example: { title: "Antibiotic resistance", body: "When bacteria are exposed to an antibiotic, any that happen to be resistant survive and multiply. The population becomes more resistant over time, which is why doctors ask you to finish a prescribed course." },
    checks: [
      { question: "What does 'fitness' mean in natural selection?", choices: ["Being the strongest", "Being the fastest", "Surviving and reproducing well in an environment", "Living the longest"], answer: 2, explanation: "Fitness is about passing on genes: surviving and reproducing in a given environment." },
      { question: "Which of these is evolving?", choices: ["One rabbit during its life", "A population of rabbits over generations", "A rock", "A single leaf"], answer: 1, explanation: "Evolution is change in populations across generations." },
      { question: "Which is evidence for evolution?", choices: ["Fossil record", "Weather forecasts", "Magnetism", "Tides"], answer: 0, explanation: "Fossils show how life has changed over long periods." },
    ],
    practice: [{ question: "List the three conditions needed for natural selection.", answer: "Variation in a trait, the trait is inherited, and the trait affects survival or reproduction." }],
    sources: ["openstax-bio2e"],
  },
  // ---------------------------------------------------------------- CHEMISTRY
  {
    id: "atoms",
    subject: "chemistry",
    title: "Atoms and subatomic particles",
    grades: [7, 11],
    keywords: ["atom", "atoms", "proton", "neutron", "electron", "nucleus", "atomic number", "mass number", "isotope"],
    summary: {
      basic: "Everything is made of tiny particles called atoms. An atom has a centre called the nucleus, made of protons and neutrons, with electrons moving around it.",
      advanced: "Protons (+1 charge) and neutrons (no charge) sit in the dense nucleus; electrons (−1 charge, far less massive) occupy regions around it. The atomic number (number of protons) identifies the element. Isotopes of an element have the same number of protons but different numbers of neutrons.",
    },
    keyPoints: [
      "Atomic number = number of protons.",
      "Mass number = protons + neutrons.",
      "A neutral atom has equal numbers of protons and electrons.",
      "Atoms that gain or lose electrons become ions.",
    ],
    definitions: [
      { term: "Isotope", meaning: "Atoms of the same element with different numbers of neutrons." },
      { term: "Ion", meaning: "An atom or group of atoms with an electric charge because it gained or lost electrons." },
    ],
    example: { title: "Carbon-12 and carbon-14", body: "Both have 6 protons (so both are carbon). Carbon-12 has 6 neutrons and carbon-14 has 8 neutrons. Carbon-14 is radioactive and is used in radiocarbon dating." },
    checks: [
      { question: "What determines which element an atom is?", choices: ["Number of neutrons", "Number of protons", "Number of electrons", "Its mass"], answer: 1, explanation: "The atomic number (proton count) defines the element." },
      { question: "What charge does a neutron have?", choices: ["Positive", "Negative", "No charge", "It changes"], answer: 2, explanation: "Neutrons are electrically neutral." },
      { question: "An atom has 11 protons and 12 neutrons. What is its mass number?", choices: ["11", "12", "23", "1"], answer: 2, explanation: "Mass number = protons + neutrons = 11 + 12 = 23 (this is sodium-23)." },
    ],
    practice: [{ question: "Oxygen-16 has atomic number 8. How many neutrons does it have?", answer: "16 − 8 = 8 neutrons." }],
    sources: ["openstax-chem2e"],
  },
  {
    id: "periodic-table",
    subject: "chemistry",
    title: "The periodic table",
    grades: [7, 12],
    keywords: ["periodic table", "element", "elements", "group", "period", "metal", "nonmetal", "noble gas", "mendeleev"],
    summary: {
      basic: "The periodic table lists all the known elements in order of atomic number. Elements in the same column (group) behave in similar ways.",
      advanced: "Elements are ordered by atomic number. Rows are periods; columns are groups. Elements in a group have similar outer-electron arrangements, so they show similar chemical properties. Metals are on the left and centre, nonmetals on the right, and metalloids along the boundary. Group 18 contains the unreactive noble gases.",
    },
    keyPoints: [
      "118 elements have been named and confirmed.",
      "Group 1 (alkali metals) react strongly with water.",
      "Group 17 are the halogens, such as chlorine.",
      "Dmitri Mendeleev published an early periodic table in 1869 and predicted undiscovered elements.",
    ],
    definitions: [
      { term: "Group", meaning: "A vertical column of the periodic table." },
      { term: "Period", meaning: "A horizontal row of the periodic table." },
    ],
    example: { title: "Why sodium and potassium are alike", body: "Sodium and potassium are both in group 1. Each has one outer electron that it loses easily, so both react vigorously with water to form an alkaline solution and hydrogen gas." },
    checks: [
      { question: "How is the modern periodic table ordered?", choices: ["By mass", "By atomic number", "Alphabetically", "By discovery date"], answer: 1, explanation: "Elements are arranged by increasing atomic number." },
      { question: "Which group contains the noble gases?", choices: ["Group 1", "Group 2", "Group 17", "Group 18"], answer: 3, explanation: "Group 18: helium, neon, argon, krypton, xenon, radon (and oganesson)." },
      { question: "Elements in the same group have similar…", choices: ["Masses", "Colours", "Chemical properties", "Discovery dates"], answer: 2, explanation: "They have similar outer electron arrangements, so they react in similar ways." },
    ],
    practice: [{ question: "Is chlorine a metal or a nonmetal? Which group is it in?", answer: "A nonmetal, in group 17 (the halogens)." }],
    sources: ["openstax-chem2e", "iupac-ptable"],
  },
  {
    id: "states-of-matter",
    subject: "chemistry",
    title: "States of matter",
    grades: [7, 9],
    keywords: ["states of matter", "solid", "liquid", "gas", "melting", "boiling", "evaporation", "condensation", "freezing", "particles", "plasma"],
    summary: {
      basic: "Matter is usually a solid, a liquid or a gas. In solids the particles are packed tightly and vibrate in place; in liquids they are close but can move past each other; in gases they are far apart and move quickly.",
      advanced: "Changes of state happen when energy is added or removed: melting, boiling and sublimation need energy; freezing, condensation and deposition release it. During a change of state at constant pressure, the temperature stays constant while energy changes the particle arrangement.",
    },
    keyPoints: [
      "Solids have a fixed shape and volume; liquids have a fixed volume but take the shape of their container; gases fill their container.",
      "Pure water at standard sea-level pressure melts at 0 °C and boils at 100 °C.",
      "Plasma, a hot gas of charged particles, is often called a fourth state of matter.",
    ],
    definitions: [
      { term: "Evaporation", meaning: "A liquid turning into a gas at its surface, below the boiling point." },
      { term: "Condensation", meaning: "A gas turning into a liquid when it cools." },
    ],
    example: { title: "A cold drink 'sweats'", body: "Water vapour in the air touches the cold glass, cools, and condenses into liquid droplets. The water comes from the air, not from inside the glass." },
    checks: [
      { question: "Which state has a fixed volume but no fixed shape?", choices: ["Solid", "Liquid", "Gas", "None"], answer: 1, explanation: "Liquids keep their volume but take the shape of their container." },
      { question: "What is it called when a gas turns into a liquid?", choices: ["Melting", "Evaporation", "Condensation", "Sublimation"], answer: 2, explanation: "Condensation happens when a gas cools and becomes liquid." },
      { question: "At standard sea-level pressure, pure water boils at…", choices: ["0 °C", "50 °C", "100 °C", "212 °C"], answer: 2, explanation: "100 °C (212 °F). At high altitude, lower pressure makes it boil at a lower temperature." },
    ],
    practice: [{ question: "Why does a puddle disappear on a sunny day even though it never reaches 100 °C?", answer: "Water evaporates from the surface at temperatures below its boiling point." }],
    sources: ["openstax-chem2e"],
  },
  {
    id: "chemical-reactions",
    subject: "chemistry",
    title: "Chemical reactions and conservation of mass",
    grades: [8, 12],
    keywords: ["chemical reaction", "reactant", "product", "balancing equations", "conservation of mass", "chemical change", "physical change", "combustion"],
    summary: {
      basic: "In a chemical reaction, substances (reactants) change into new substances (products). Atoms are rearranged, not created or destroyed, so the total mass stays the same.",
      advanced: "The law of conservation of mass means a balanced chemical equation has the same number of each type of atom on both sides. Coefficients are adjusted to balance equations; subscripts in formulas are never changed. Signs of a chemical change include gas production, a colour change, a precipitate, or energy released or absorbed.",
    },
    keyPoints: [
      "Physical changes (like melting) don't make new substances; chemical changes do.",
      "Balanced example: 2H₂ + O₂ → 2H₂O.",
      "Combustion of methane: CH₄ + 2O₂ → CO₂ + 2H₂O.",
    ],
    definitions: [
      { term: "Reactant", meaning: "A substance present at the start of a reaction." },
      { term: "Product", meaning: "A substance formed by a reaction." },
      { term: "Coefficient", meaning: "The number written in front of a formula in an equation to balance it." },
    ],
    example: { title: "Balancing hydrogen and oxygen", body: "H₂ + O₂ → H₂O is unbalanced (2 O on the left, 1 on the right). Put 2 in front of H₂O: H₂ + O₂ → 2H₂O. Now there are 4 H on the right, so put 2 in front of H₂: 2H₂ + O₂ → 2H₂O. Each side has 4 H and 2 O." },
    checks: [
      { question: "Which of these is a chemical change?", choices: ["Ice melting", "Paper burning", "Sugar dissolving", "Glass breaking"], answer: 1, explanation: "Burning makes new substances (carbon dioxide, water, ash)." },
      { question: "When balancing an equation, what may you change?", choices: ["Subscripts", "Coefficients", "Element symbols", "Charges"], answer: 1, explanation: "Only coefficients; changing subscripts would change the substance." },
      { question: "In a sealed container, the mass after a reaction is…", choices: ["Larger", "Smaller", "The same", "Zero"], answer: 2, explanation: "Mass is conserved because atoms are only rearranged." },
    ],
    practice: [{ question: "Balance: N₂ + H₂ → NH₃", answer: "N₂ + 3H₂ → 2NH₃" }],
    sources: ["openstax-chem2e"],
  },
  {
    id: "acids-bases",
    subject: "chemistry",
    title: "Acids, bases and pH",
    grades: [8, 12],
    keywords: ["acid", "acids", "base", "bases", "alkali", "ph", "neutral", "neutralisation", "neutralization", "indicator", "litmus"],
    summary: {
      basic: "Acids taste sour (never taste chemicals in a lab!) and bases feel slippery. The pH scale measures how acidic or basic a solution is. pH 7 is neutral, lower is acidic and higher is basic.",
      advanced: "In water, acids increase the concentration of hydrogen (hydronium) ions and bases increase hydroxide ions. pH = −log₁₀[H⁺], so each one-unit drop in pH means ten times more H⁺. Acids and bases neutralise each other to form a salt and water.",
    },
    keyPoints: [
      "pH 7 is neutral at 25 °C (pure water).",
      "Lemon juice is acidic; soap and baking soda solutions are basic.",
      "Acid + base → salt + water, e.g. HCl + NaOH → NaCl + H₂O.",
      "Indicators like litmus change colour depending on pH.",
    ],
    definitions: [
      { term: "pH", meaning: "A scale (usually 0–14) showing how acidic or basic a solution is." },
      { term: "Neutralisation", meaning: "A reaction between an acid and a base that forms a salt and water." },
    ],
    example: { title: "Ten times stronger", body: "A solution at pH 3 has ten times the hydrogen-ion concentration of one at pH 4, and one hundred times that of one at pH 5." },
    checks: [
      { question: "A solution has pH 2. It is…", choices: ["Strongly acidic", "Neutral", "Weakly basic", "Strongly basic"], answer: 0, explanation: "pH well below 7 means strongly acidic." },
      { question: "What forms when an acid neutralises a base?", choices: ["Only gas", "A salt and water", "Pure acid", "Oxygen"], answer: 1, explanation: "Neutralisation gives a salt and water." },
      { question: "How much more H⁺ is in pH 4 than pH 6?", choices: ["2 times", "10 times", "100 times", "Same"], answer: 2, explanation: "Two pH units = 10 × 10 = 100 times." },
    ],
    practice: [{ question: "Why might someone take an antacid for indigestion?", answer: "Antacids are bases that neutralise excess stomach acid." }],
    sources: ["openstax-chem2e"],
  },
  // ------------------------------------------------------------------ PHYSICS
  {
    id: "motion",
    subject: "physics",
    title: "Speed, velocity and acceleration",
    grades: [7, 12],
    keywords: ["speed", "velocity", "acceleration", "motion", "distance", "displacement", "kinematics"],
    summary: {
      basic: "Speed tells you how fast something moves: speed = distance ÷ time. Velocity is speed in a particular direction. Acceleration means the velocity is changing.",
      advanced: "Velocity is a vector (magnitude and direction); speed is its magnitude. Average velocity = displacement ÷ time. Acceleration = change in velocity ÷ time, measured in m/s². For constant acceleration: v = u + at and s = ut + ½at².",
    },
    keyPoints: [
      "SI unit of speed is metres per second (m/s).",
      "Turning a corner at constant speed is still acceleration, because direction changes.",
      "Negative acceleration in the direction of motion means slowing down.",
    ],
    definitions: [
      { term: "Vector", meaning: "A quantity with both size and direction, like velocity or force." },
      { term: "Displacement", meaning: "The straight-line change in position, with direction." },
    ],
    example: { title: "Worked example", body: "A cyclist travels 150 m in 30 s. Speed = 150 m ÷ 30 s = 5 m/s. If she speeds up from 5 m/s to 9 m/s in 2 s, acceleration = (9 − 5) ÷ 2 = 2 m/s²." },
    checks: [
      { question: "A car goes 100 m in 5 s. What is its average speed?", choices: ["500 m/s", "20 m/s", "0.05 m/s", "95 m/s"], answer: 1, explanation: "Speed = 100 ÷ 5 = 20 m/s." },
      { question: "What is the unit of acceleration?", choices: ["m/s", "m/s²", "m", "N"], answer: 1, explanation: "Metres per second per second (m/s²)." },
      { question: "A car drives around a roundabout at a steady 20 km/h. Is it accelerating?", choices: ["No, speed is constant", "Yes, its direction changes", "Only if it brakes", "Only uphill"], answer: 1, explanation: "Velocity includes direction, so changing direction is acceleration." },
    ],
    practice: [{ question: "A ball speeds up from 0 to 12 m/s in 4 s. What is its acceleration?", answer: "(12 − 0) ÷ 4 = 3 m/s²" }],
    sources: ["openstax-hsphysics", "openstax-collegephys2e"],
  },
  {
    id: "newtons-laws",
    subject: "physics",
    title: "Forces and Newton's laws",
    grades: [7, 12],
    keywords: ["force", "forces", "newton", "newtons laws", "inertia", "f = ma", "friction", "action reaction", "net force"],
    summary: {
      basic: "A force is a push or a pull. Newton's laws explain how forces change motion: things keep doing what they're doing unless a force acts, a bigger force gives a bigger acceleration, and every action has an equal and opposite reaction.",
      advanced: "First law: an object stays at rest or moves at constant velocity unless a net external force acts (inertia). Second law: F_net = ma. Third law: when object A exerts a force on B, B exerts an equal and opposite force on A; these forces act on different objects. Force is measured in newtons (1 N = 1 kg·m/s²).",
    },
    keyPoints: [
      "Net force is the combined effect of all forces on an object.",
      "Balanced forces → no change in motion; unbalanced forces → acceleration.",
      "Friction acts against the direction of sliding motion.",
    ],
    definitions: [
      { term: "Inertia", meaning: "The tendency of an object to resist changes in its motion." },
      { term: "Newton (N)", meaning: "The SI unit of force: the force that accelerates 1 kg at 1 m/s²." },
    ],
    example: { title: "Worked example", body: "A 2 kg box is pushed with a net force of 10 N. Using F = ma: a = F ÷ m = 10 ÷ 2 = 5 m/s²." },
    checks: [
      { question: "What net force accelerates a 3 kg mass at 4 m/s²?", choices: ["7 N", "12 N", "0.75 N", "1.33 N"], answer: 1, explanation: "F = ma = 3 × 4 = 12 N." },
      { question: "A book rests on a table. The forces on it are…", choices: ["Unbalanced", "Balanced", "Zero because nothing touches it", "Only gravity"], answer: 1, explanation: "Gravity down and the table's push up balance, so it stays still." },
      { question: "Which law explains why a rocket moves forward when gas is pushed backward?", choices: ["First", "Second", "Third", "None"], answer: 2, explanation: "The rocket pushes gas back; the gas pushes the rocket forward." },
    ],
    practice: [{ question: "Why do passengers lurch forward when a bus brakes suddenly?", answer: "Inertia: their bodies keep moving forward until a force (seatbelt, seat) stops them." }],
    sources: ["openstax-hsphysics", "openstax-collegephys2e"],
  },
  {
    id: "energy",
    subject: "physics",
    title: "Energy and its conservation",
    grades: [7, 12],
    keywords: ["energy", "kinetic energy", "potential energy", "conservation of energy", "joule", "work", "power", "efficiency"],
    summary: {
      basic: "Energy is the ability to do work or cause change. It comes in stores like kinetic (movement) and potential (position) energy. Energy can't be created or destroyed, only transferred or changed from one form to another.",
      advanced: "Kinetic energy KE = ½mv²; gravitational potential energy near Earth's surface GPE = mgh. Energy is measured in joules (J). In real systems some energy is usually transferred to the surroundings as heat, so efficiency = useful output ÷ total input is less than 100%.",
    },
    keyPoints: [
      "Law of conservation of energy: total energy in a closed system stays constant.",
      "Power = energy transferred ÷ time, measured in watts (1 W = 1 J/s).",
      "Doubling speed makes kinetic energy four times bigger.",
    ],
    definitions: [
      { term: "Joule (J)", meaning: "The SI unit of energy." },
      { term: "Efficiency", meaning: "The fraction of input energy that ends up as useful output." },
    ],
    example: { title: "Worked example", body: "A 0.5 kg ball moving at 4 m/s has KE = ½ × 0.5 × 4² = 4 J. Lifting a 2 kg bag up 1.5 m gains GPE ≈ 2 × 9.8 × 1.5 ≈ 29.4 J." },
    checks: [
      { question: "What is the kinetic energy of a 2 kg object moving at 3 m/s?", choices: ["3 J", "6 J", "9 J", "18 J"], answer: 2, explanation: "KE = ½ × 2 × 3² = 9 J." },
      { question: "What happens to total energy in a closed system?", choices: ["It increases", "It decreases", "It stays the same", "It disappears as heat"], answer: 2, explanation: "Energy is conserved; it only changes form or moves." },
      { question: "If you double an object's speed, its KE becomes…", choices: ["Twice as big", "Four times as big", "Half", "The same"], answer: 1, explanation: "KE depends on v², so 2² = 4 times." },
    ],
    practice: [{ question: "Describe the energy changes when a ball is dropped from a height.", answer: "Gravitational potential energy → kinetic energy as it falls; on impact, some becomes sound and heat." }],
    sources: ["openstax-hsphysics", "openstax-collegephys2e"],
  },
  {
    id: "waves-light",
    subject: "physics",
    title: "Waves, sound and light",
    grades: [8, 12],
    keywords: ["wave", "waves", "sound", "light", "frequency", "wavelength", "amplitude", "electromagnetic", "speed of light", "reflection", "refraction"],
    summary: {
      basic: "Waves carry energy from place to place without carrying matter along. Sound waves need a material (like air) to travel through. Light is an electromagnetic wave and can travel through empty space.",
      advanced: "For any wave, speed = frequency × wavelength (v = fλ). Sound is a longitudinal mechanical wave; light is a transverse electromagnetic wave. In a vacuum, light travels at exactly 299,792,458 m/s (this value is defined exactly in the SI system). Sound in air at about 20 °C travels at roughly 343 m/s.",
    },
    keyPoints: [
      "Frequency is measured in hertz (Hz): waves per second.",
      "Higher-pitched sounds have higher frequency.",
      "The electromagnetic spectrum includes radio, microwaves, infrared, visible light, ultraviolet, X-rays and gamma rays.",
      "Refraction is the bending of a wave when it changes speed entering a new material.",
    ],
    definitions: [
      { term: "Wavelength", meaning: "The distance from one point on a wave to the same point on the next wave." },
      { term: "Amplitude", meaning: "The height of a wave from its rest position; for sound it relates to loudness." },
    ],
    example: { title: "Lightning and thunder", body: "Light from lightning reaches you almost instantly, but sound travels about 343 m each second. If you hear thunder 3 seconds after the flash, the strike was roughly 1 km away." },
    checks: [
      { question: "A wave has frequency 5 Hz and wavelength 2 m. What is its speed?", choices: ["2.5 m/s", "7 m/s", "10 m/s", "3 m/s"], answer: 2, explanation: "v = fλ = 5 × 2 = 10 m/s." },
      { question: "Why can't sound travel through space?", choices: ["Space is too cold", "Sound needs a material to travel through", "Space is too dark", "Sound is too slow"], answer: 1, explanation: "Sound is a vibration of particles; a vacuum has almost none." },
      { question: "Which travels faster in air?", choices: ["Sound", "Light", "They are equal", "It depends on the colour"], answer: 1, explanation: "Light is about a million times faster than sound in air." },
    ],
    practice: [{ question: "A sound wave in air has frequency 343 Hz. Using v ≈ 343 m/s, what is its wavelength?", answer: "λ = v ÷ f ≈ 343 ÷ 343 = 1 m" }],
    sources: ["openstax-hsphysics", "nist-constants"],
  },
  {
    id: "electricity",
    subject: "physics",
    title: "Electric circuits",
    grades: [8, 12],
    keywords: ["electricity", "circuit", "current", "voltage", "resistance", "ohm", "ohms law", "series", "parallel", "battery"],
    summary: {
      basic: "Electric current is the flow of electric charge around a complete circuit. A battery provides the push (voltage), and components like bulbs resist the flow.",
      advanced: "Ohm's law: V = IR, where V is potential difference (volts), I is current (amperes) and R is resistance (ohms), for ohmic conductors at constant temperature. In series circuits current is the same everywhere and resistances add; in parallel circuits voltage is the same across each branch and currents add.",
    },
    keyPoints: [
      "A circuit must be complete (closed) for current to flow.",
      "Electrical power P = VI, measured in watts.",
      "Household electricity can be dangerous: never experiment with mains power.",
    ],
    definitions: [
      { term: "Current (I)", meaning: "The rate of flow of electric charge, measured in amperes (A)." },
      { term: "Resistance (R)", meaning: "How much a component opposes current, measured in ohms (Ω)." },
    ],
    example: { title: "Worked example", body: "A 12 V battery is connected to a 4 Ω resistor. Current I = V ÷ R = 12 ÷ 4 = 3 A. Power P = VI = 12 × 3 = 36 W." },
    checks: [
      { question: "Using V = IR, what current flows through 10 Ω with 5 V across it?", choices: ["50 A", "2 A", "0.5 A", "15 A"], answer: 2, explanation: "I = V ÷ R = 5 ÷ 10 = 0.5 A." },
      { question: "In a series circuit, if one bulb breaks…", choices: ["The others stay on", "All the bulbs go out", "They get brighter", "Nothing changes"], answer: 1, explanation: "A series circuit has only one path, so breaking it stops all current." },
      { question: "What is the unit of resistance?", choices: ["Volt", "Ampere", "Ohm", "Watt"], answer: 2, explanation: "Resistance is measured in ohms (Ω)." },
    ],
    practice: [{ question: "Why are houses wired in parallel rather than series?", answer: "Each device gets the full voltage and can be switched on or off independently." }],
    sources: ["openstax-hsphysics", "openstax-collegephys2e"],
  },
  {
    id: "gravity",
    subject: "physics",
    title: "Gravity, mass and weight",
    grades: [7, 12],
    keywords: ["gravity", "gravitation", "weight", "mass", "free fall", "orbit", "9.8"],
    summary: {
      basic: "Gravity is a force that pulls objects with mass toward each other. Your mass is how much matter you have; your weight is the force of gravity on you, so it would be smaller on the Moon even though your mass stays the same.",
      advanced: "Newton's law of universal gravitation: F = Gm₁m₂/r². Near Earth's surface, gravitational field strength g ≈ 9.8 N/kg, so weight W = mg. Ignoring air resistance, all objects fall with the same acceleration. Orbits happen when an object moves sideways fast enough that it keeps falling around a planet instead of into it.",
    },
    keyPoints: [
      "Mass is measured in kilograms; weight (a force) in newtons.",
      "The Moon's surface gravity is about one-sixth of Earth's.",
      "Air resistance, not gravity, is why a feather falls more slowly than a hammer in air.",
    ],
    definitions: [
      { term: "Mass", meaning: "The amount of matter in an object (kg). It doesn't change from place to place." },
      { term: "Weight", meaning: "The force of gravity on an object (N)." },
    ],
    example: { title: "Worked example", body: "A 50 kg student has weight W = mg ≈ 50 × 9.8 = 490 N on Earth, and about 490 ÷ 6 ≈ 82 N on the Moon. Their mass is 50 kg in both places." },
    checks: [
      { question: "What is the weight of a 10 kg object on Earth (g ≈ 9.8 N/kg)?", choices: ["10 N", "9.8 N", "98 N", "0.98 N"], answer: 2, explanation: "W = mg ≈ 10 × 9.8 = 98 N." },
      { question: "On the Moon, your mass would…", choices: ["Decrease", "Increase", "Stay the same", "Become zero"], answer: 2, explanation: "Mass doesn't depend on location; weight does." },
      { question: "In a vacuum, a hammer and a feather dropped together…", choices: ["Hammer lands first", "Feather lands first", "Land together", "Float"], answer: 2, explanation: "Without air resistance they have the same acceleration. Apollo 15 astronauts demonstrated this on the Moon." },
    ],
    practice: [{ question: "Explain the difference between mass and weight.", answer: "Mass is the amount of matter (kg) and stays constant; weight is the gravitational force (N) and depends on where you are." }],
    sources: ["openstax-hsphysics", "nasa-science"],
  },
  // ------------------------------------------------------------ EARTH SCIENCE
  {
    id: "water-cycle",
    subject: "earth_science",
    title: "The water cycle",
    grades: [7, 9],
    keywords: ["water cycle", "evaporation", "condensation", "precipitation", "transpiration", "runoff", "groundwater", "rain", "clouds"],
    summary: {
      basic: "Water moves around Earth in a cycle. The Sun heats water so it evaporates, the vapour rises and cools to form clouds (condensation), and water falls back as rain or snow (precipitation). It then flows into rivers, oceans and the ground, and the cycle continues.",
      advanced: "The water cycle is driven by solar energy and gravity. Water is stored in oceans (most of Earth's water), ice, groundwater, lakes, the atmosphere and living things, and moves between them by evaporation, transpiration, condensation, precipitation, infiltration and runoff. Humans affect it through water use, land use and climate change.",
    },
    keyPoints: [
      "Most of Earth's water is salt water in the oceans.",
      "Transpiration is water vapour released by plants through their leaves.",
      "Clouds are tiny liquid droplets or ice crystals, not water vapour (which is invisible).",
    ],
    definitions: [
      { term: "Precipitation", meaning: "Water falling from clouds as rain, snow, sleet or hail." },
      { term: "Infiltration", meaning: "Water soaking into the ground." },
    ],
    example: { title: "One water molecule's trip", body: "A water molecule evaporates from the ocean, condenses into a cloud over land, falls as rain, soaks into the ground, is taken up by a tree's roots, and is released again by transpiration." },
    checks: [
      { question: "What provides the energy for evaporation in the water cycle?", choices: ["The Moon", "The Sun", "Wind only", "Earth's core"], answer: 1, explanation: "Solar energy heats water so it evaporates." },
      { question: "What is transpiration?", choices: ["Rain falling", "Water vapour released by plants", "Water flowing in rivers", "Ice melting"], answer: 1, explanation: "Plants release water vapour through small openings in their leaves." },
      { question: "Where is most of Earth's water found?", choices: ["Rivers", "Glaciers", "Oceans", "The atmosphere"], answer: 2, explanation: "Most of Earth's water is in the oceans." },
    ],
    practice: [{ question: "Explain why clouds form when moist air rises.", answer: "Rising air cools; cooler air holds less water vapour, so the vapour condenses into droplets that form clouds." }],
    sources: ["usgs-water"],
  },
  {
    id: "plate-tectonics",
    subject: "earth_science",
    title: "Plate tectonics",
    grades: [7, 12],
    keywords: ["plate tectonics", "tectonic plates", "earthquake", "earthquakes", "volcano", "volcanoes", "continental drift", "fault", "mountains", "subduction"],
    summary: {
      basic: "Earth's outer shell is broken into huge pieces called tectonic plates. They move very slowly, a few centimetres a year. Where plates meet, we get earthquakes, volcanoes and mountains.",
      advanced: "The lithosphere is divided into plates that move over the weaker asthenosphere. At divergent boundaries plates move apart and new crust forms; at convergent boundaries they collide, causing subduction or mountain building; at transform boundaries they slide past each other, causing earthquakes. Evidence includes matching fossils and rocks across oceans, seafloor spreading and the distribution of earthquakes.",
    },
    keyPoints: [
      "Plates move about as fast as fingernails grow.",
      "The Himalayas formed where the Indian plate collides with the Eurasian plate.",
      "Alfred Wegener proposed continental drift in the early 1900s; plate tectonics explained it in the 1960s.",
    ],
    definitions: [
      { term: "Lithosphere", meaning: "Earth's rigid outer layer: the crust plus the uppermost mantle." },
      { term: "Subduction", meaning: "When one plate sinks beneath another into the mantle." },
    ],
    example: { title: "The Mid-Atlantic Ridge", body: "Along the middle of the Atlantic Ocean, plates are moving apart. Magma rises to fill the gap, forming new ocean floor, so the Atlantic is slowly widening." },
    checks: [
      { question: "About how fast do tectonic plates move?", choices: ["A few cm per year", "A few metres per day", "A few km per year", "They don't move"], answer: 0, explanation: "Typical speeds are a few centimetres per year." },
      { question: "What happens at a divergent boundary?", choices: ["Plates collide", "Plates move apart", "Plates slide past", "Plates melt"], answer: 1, explanation: "Plates separate and new crust forms." },
      { question: "Which landform is created by two continental plates colliding?", choices: ["Ocean trench", "Mountain range", "Rift valley", "Delta"], answer: 1, explanation: "Collisions crumple and push up crust, e.g. the Himalayas." },
    ],
    practice: [{ question: "Give two pieces of evidence for plate tectonics.", answer: "Any two of: matching fossils/rocks on different continents, the jigsaw fit of continents, seafloor spreading, earthquake and volcano locations along boundaries." }],
    sources: ["nasa-science"],
  },
  {
    id: "rock-cycle",
    subject: "earth_science",
    title: "Rocks and the rock cycle",
    grades: [7, 9],
    keywords: ["rock cycle", "igneous", "sedimentary", "metamorphic", "rocks", "magma", "erosion", "weathering"],
    summary: {
      basic: "There are three main types of rock. Igneous rock forms when melted rock cools. Sedimentary rock forms from layers of sediment pressed together. Metamorphic rock forms when heat and pressure change existing rock. Rocks slowly change from one type to another in the rock cycle.",
      advanced: "Igneous rocks crystallise from magma or lava (e.g. granite, basalt); cooling speed controls crystal size. Sedimentary rocks form by weathering, erosion, deposition, compaction and cementation (e.g. sandstone, limestone) and may contain fossils. Metamorphic rocks form by heat and pressure without melting (e.g. marble from limestone, slate from shale).",
    },
    keyPoints: [
      "Fossils are mostly found in sedimentary rock.",
      "Slow cooling underground makes large crystals; fast cooling at the surface makes small crystals.",
      "Weathering breaks rock down; erosion moves the pieces.",
    ],
    definitions: [
      { term: "Magma / lava", meaning: "Molten rock underground is magma; once it reaches the surface it is called lava." },
      { term: "Sediment", meaning: "Small pieces of rock, minerals or shells moved by water, wind or ice." },
    ],
    example: { title: "From limestone to marble", body: "Limestone (sedimentary) buried deep and heated changes into marble (metamorphic) without melting." },
    checks: [
      { question: "Which rock type forms from cooled magma or lava?", choices: ["Igneous", "Sedimentary", "Metamorphic", "Fossil"], answer: 0, explanation: "Igneous means 'from fire': it forms from molten rock." },
      { question: "Where are fossils most often found?", choices: ["Igneous rock", "Sedimentary rock", "Metamorphic rock", "Lava"], answer: 1, explanation: "Sediments bury remains gently, so fossils can be preserved." },
      { question: "Marble forms from limestone by…", choices: ["Melting", "Heat and pressure", "Erosion", "Evaporation"], answer: 1, explanation: "Metamorphism changes rock with heat and pressure." },
    ],
    practice: [{ question: "Describe one path through the rock cycle starting with granite.", answer: "Example: granite weathers into sediment, which is deposited and cemented into sandstone, which heat and pressure change into quartzite." }],
    sources: ["nasa-science"],
  },
  {
    id: "climate-greenhouse",
    subject: "earth_science",
    title: "Weather, climate and the greenhouse effect",
    grades: [8, 12],
    keywords: ["weather", "climate", "greenhouse effect", "global warming", "climate change", "carbon dioxide", "greenhouse gas"],
    summary: {
      basic: "Weather is what the atmosphere is doing today. Climate is the average weather over many years. Greenhouse gases like carbon dioxide trap heat near Earth's surface, keeping the planet warm enough for life.",
      advanced: "Greenhouse gases (water vapour, CO₂, methane, nitrous oxide) absorb infrared radiation emitted by Earth's surface and re-emit it, warming the lower atmosphere. Burning fossil fuels has raised atmospheric CO₂ substantially since the Industrial Revolution, and scientific assessments conclude that human activities are the main cause of the observed warming since the mid-20th century.",
    },
    keyPoints: [
      "Without any greenhouse effect, Earth would be far colder.",
      "Climate is usually described using averages over about 30 years.",
      "Evidence of warming includes rising global temperatures, shrinking glaciers and rising sea level.",
    ],
    definitions: [
      { term: "Greenhouse gas", meaning: "A gas that absorbs and re-emits infrared radiation, trapping heat in the atmosphere." },
      { term: "Climate", meaning: "The long-term pattern of weather in a region." },
    ],
    example: { title: "A hot car", body: "Sunlight enters a car and warms the seats, which give off infrared radiation that the glass partly traps. It's a useful comparison, though the real greenhouse effect works by gases absorbing and re-emitting infrared rather than by blocking air movement." },
    checks: [
      { question: "What is the difference between weather and climate?", choices: ["No difference", "Weather is short-term, climate is long-term average", "Climate is daily, weather is yearly", "Weather is only rain"], answer: 1, explanation: "Climate is long-term average weather." },
      { question: "Which is a greenhouse gas?", choices: ["Nitrogen (N₂)", "Oxygen (O₂)", "Carbon dioxide (CO₂)", "Argon"], answer: 2, explanation: "CO₂ absorbs infrared radiation; N₂ and O₂ largely do not." },
      { question: "What is the main cause of recent global warming according to scientific assessments?", choices: ["Changes in the Sun", "Human activities such as burning fossil fuels", "Volcanoes", "Earth moving closer to the Sun"], answer: 1, explanation: "Assessments conclude human greenhouse gas emissions are the main cause." },
    ],
    practice: [{ question: "Give two ways people can reduce greenhouse gas emissions.", answer: "Examples: using renewable energy, walking/cycling/public transport, using energy efficiently, reducing waste." }],
    uncertainty: "Exactly how much and how fast specific regions will warm depends on future emissions and is studied with models that have ranges of uncertainty. The fact of human-caused warming is not in serious scientific doubt.",
    sources: ["nasa-science"],
  },
  {
    id: "seasons-solar-system",
    subject: "earth_science",
    title: "Seasons and the solar system",
    grades: [7, 10],
    keywords: ["seasons", "solar system", "planets", "earth tilt", "axis", "orbit", "moon phases", "sun", "summer", "winter"],
    summary: {
      basic: "Earth orbits the Sun once a year and spins on its axis once a day. Earth's axis is tilted, so for part of the year your half of Earth leans toward the Sun (summer) and for part it leans away (winter).",
      advanced: "Seasons are caused by Earth's axial tilt of about 23.4°, which changes the angle of sunlight and the length of daylight through the year. They are not caused by changes in distance from the Sun; in fact Earth is closest to the Sun in early January. The solar system has eight planets orbiting the Sun, held by gravity.",
    },
    keyPoints: [
      "The eight planets in order: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
      "When it is summer in the Northern Hemisphere, it is winter in the Southern Hemisphere.",
      "The Moon's phases are caused by how much of its sunlit side we see, not by Earth's shadow.",
    ],
    definitions: [
      { term: "Axis", meaning: "The imaginary line through Earth's poles that it spins around." },
      { term: "Orbit", meaning: "The curved path of one object around another due to gravity." },
    ],
    example: { title: "Why Australia has summer in December", body: "In December the Southern Hemisphere is tilted toward the Sun, so sunlight hits it more directly and days are longer, giving summer there while it is winter in Europe." },
    checks: [
      { question: "What causes Earth's seasons?", choices: ["Distance from the Sun", "Earth's axial tilt", "The Moon", "Clouds"], answer: 1, explanation: "The tilt changes sunlight angle and day length." },
      { question: "How long does Earth take to orbit the Sun?", choices: ["1 day", "1 month", "About 1 year", "10 years"], answer: 2, explanation: "About 365.25 days." },
      { question: "Which planet is largest?", choices: ["Earth", "Saturn", "Jupiter", "Neptune"], answer: 2, explanation: "Jupiter is the largest planet in our solar system." },
    ],
    practice: [{ question: "Why is it a misconception that summer happens because Earth is closer to the Sun?", answer: "The hemispheres have opposite seasons at the same time, and Earth is actually closest to the Sun in early January." }],
    sources: ["nasa-science"],
  },
  // --------------------------------------------------------- GENERAL SCIENCE
  {
    id: "scientific-method",
    subject: "general_science",
    title: "The scientific method and fair tests",
    grades: [7, 12],
    keywords: ["scientific method", "hypothesis", "experiment", "variable", "independent variable", "dependent variable", "control", "fair test", "theory", "data"],
    summary: {
      basic: "Scientists learn about the world by asking questions, making a prediction (hypothesis), testing it with a fair experiment, and looking carefully at the results. In a fair test you change only one thing at a time.",
      advanced: "A testable hypothesis predicts how an independent variable affects a dependent variable. Controlled variables are kept constant, and a control group provides a baseline. Repeating trials improves reliability. A scientific theory is a well-tested explanation supported by a large body of evidence, not just a guess.",
    },
    keyPoints: [
      "Independent variable: what you change. Dependent variable: what you measure.",
      "Controlled variables: everything you keep the same.",
      "Results that don't support a hypothesis are still useful.",
      "Scientists share results so others can check and repeat them.",
    ],
    definitions: [
      { term: "Hypothesis", meaning: "A testable prediction or explanation." },
      { term: "Theory", meaning: "A well-supported explanation of many observations, tested repeatedly." },
    ],
    example: { title: "Plant growth test", body: "Question: does the amount of light affect plant growth? Independent variable: hours of light. Dependent variable: plant height after two weeks. Controlled variables: plant type, soil, water, pot size and temperature." },
    checks: [
      { question: "In an experiment, the variable you change on purpose is the…", choices: ["Dependent variable", "Independent variable", "Controlled variable", "Constant"], answer: 1, explanation: "The independent variable is the one you deliberately change." },
      { question: "Why should you repeat an experiment?", choices: ["To get the answer you want", "To check results are reliable", "To use more equipment", "It isn't needed"], answer: 1, explanation: "Repeats show whether results are consistent." },
      { question: "In science, a 'theory' is…", choices: ["A wild guess", "A well-tested explanation supported by evidence", "An opinion", "Something that can't be tested"], answer: 1, explanation: "Theories like evolution or plate tectonics are supported by large bodies of evidence." },
    ],
    practice: [{ question: "Design a fair test to see if salt affects how fast ice melts.", answer: "Use identical ice cubes; add different amounts of salt (independent); time how long each takes to melt (dependent); keep temperature and container the same (controlled); repeat." }],
    sources: ["openstax-conceptsbio"],
  },
];
