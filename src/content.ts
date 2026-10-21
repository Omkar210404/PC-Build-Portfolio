// ALL text and links for the site live here. Edit freely.

export const person = {
  name: 'Omkar Satish Nikam',
  headline: 'Computer Engineering graduate (2026), AI/ML, Python and SAP MM',
  degree: 'Computer Engineering graduate, University of Mumbai, 2026', // TODO: refine wording
  github: 'https://github.com/Omkar210404',
  linkedin: 'https://www.linkedin.com/in/omkar-nikam-6431282b4/',
  email: 'omkarnikamofficial21@gmail.com',
  // Put your PDF at public/resume.pdf. If it is missing, the download buttons hide themselves.
  resume: `${import.meta.env.BASE_URL}resume.pdf`,
}

// RAM sticks, one per language (keep it at 4: the board has 4 slots)
export const languages = [
  { name: 'Python', note: 'One of the languages I work in.' }, // TODO: refine note
  { name: 'SQL', note: 'One of the languages I work in.' }, // TODO: refine note
  { name: 'TypeScript', note: 'One of the languages I work in.' }, // TODO: refine note
  { name: 'JavaScript', note: 'One of the languages I work in.' }, // TODO: refine note
]

// GPU section: AI/ML focus
export const aiml = [
  'Generative AI', 'LLM APIs', 'Multi-agent systems', 'Prompt engineering',
  'scikit-learn', 'Hugging Face', 'Pandas', 'NumPy',
] // TODO: refine list

// Power section: SAP experience + internship
export const sap = {
  title: 'SAP S/4HANA, hands-on',
  items: [
    'Procure-to-pay', 'OBYC', 'Release strategy', 'MIRO three-way match', 'Consignment', 'Subcontracting',
  ], // TODO: refine wording
}
export const internship = {
  role: 'WordPress Developer Intern', org: 'NS Media', place: 'Mumbai', year: '2022',
} // TODO: refine

export type Project = { title: string; link: string; description: string; stack: string[]; color?: string }

// Each project becomes one M.2 SSD (the board fits 2 to 6). To add one, append an entry.
// Stack tags are left empty on purpose; fill them in (the tag row hides while empty).
export const projects: Project[] = [
  {
    title: 'Multi-AI Agent System',
    link: 'https://github.com/Omkar210404/Multi-AI-Agent-System',
    description: 'A multi-agent AI system.', // TODO: refine description
    stack: [], // TODO: add stack tags
    color: '#d9776a',
  },
  {
    title: 'Customer Churn Prediction',
    link: 'https://github.com/Omkar210404/Customer-Churn-Prediction',
    description: 'A machine learning project that predicts customer churn.', // TODO: refine description
    stack: [], // TODO: add stack tags
    color: '#4f9a94',
  },
  {
    title: 'NewsLens',
    link: 'https://github.com/Omkar210404/News-Lens',
    description: 'An NLP project for exploring news articles.', // TODO: refine description
    stack: [], // TODO: add stack tags
    color: '#d1a443',
  },
  {
    title: 'Roof-Mint',
    link: 'https://github.com/Omkar210404/Roof-Mint',
    description: 'Roof-Mint project.', // TODO: refine description
    stack: [], // TODO: add stack tags
    color: '#8d7bb8',
  },
]

// HUD callout labels attached to the active part
export const callouts = {
  cpu: 'CPU · the core', ram: 'RAM · languages', gpu: 'GPU · AI/ML', ssd: 'M.2 · projects', power: 'PSU · SAP experience', boot: 'BIOS · contact',
}

// Section headings and captions
export const sections = {
  hook: { title: 'Every part of this machine is a part of me.', text: 'Scroll to build it.' },
  cpu: { title: 'CPU · who I am' },
  ram: { title: 'Memory · languages', text: 'Hover or tap a stick.' },
  gpu: { title: 'GPU · AI/ML focus' },
  ssd: { title: 'Storage · projects', text: 'Hover or tap a drive.' },
  power: { title: 'Power · SAP experience' },
  boot: { title: 'Booting…' },
}

export const ui = {
  scrollCue: 'scroll',
  downloadResume: 'Download resume',
  skip3d: 'Skip 3D',
  view3d: 'View 3D',
  loading: 'POST… checking parts',
  bootDone: 'System online. Hire me.',
  formTitle: 'BIOS SETUP · CONTACT',
  formSend: 'Save & exit (open email app)',
}

// Name from ?for=Name. Letters, spaces, hyphens, apostrophes only; max 24 chars. Never used as HTML.
export function visitorName(): string {
  const raw = new URLSearchParams(window.location.search).get('for') ?? ''
  const clean = raw
    .replace(/[^\p{L} '’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim()
  return clean || 'Visitor'
}
