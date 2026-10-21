// ALL text and links for the site live here. Edit freely.

export const person = {
  name: 'Omkar Satish Nikam',
  headline: 'Computer Engineering graduate (2026), AI/ML, Python and SAP MM',
  github: 'https://github.com/Omkar210404',
  linkedin: 'https://www.linkedin.com/in/omkar-nikam-6431282b4/',
  email: 'omkarnikamofficial21@gmail.com',
  // Put your PDF at public/resume.pdf. If it is missing, the download buttons hide themselves.
  resume: `${import.meta.env.BASE_URL}resume.pdf`,
}

export type Project = { title: string; link: string; description: string; color?: string }

// To add a project: append an entry. The 3D scene lays out however many there are.
// Folder colours: muted coral, teal, mustard, violet, sage (reused if you add more).
export const projects: Project[] = [
  {
    title: 'Multi-AI Agent System',
    link: 'https://github.com/Omkar210404/Multi-AI-Agent-System',
    description: 'A multi-agent AI system.', // TODO: refine description
    color: '#d9776a',
  },
  {
    title: 'Customer Churn Prediction',
    link: 'https://github.com/Omkar210404/Customer-Churn-Prediction',
    description: 'A machine learning project that predicts customer churn.', // TODO: refine description
    color: '#4f9a94',
  },
  {
    title: 'NewsLens',
    link: 'https://github.com/Omkar210404/News-Lens',
    description: 'An NLP project for exploring news articles.', // TODO: refine description
    color: '#d1a443',
  },
  {
    title: 'Roof-Mint',
    link: 'https://github.com/Omkar210404/Roof-Mint',
    description: 'Roof-Mint project.', // TODO: refine description
    color: '#8d7bb8',
  },
]

export const extraFolderColors = ['#8fa98a', '#d9776a', '#4f9a94']

// Captions shown per scroll section
export const captions = {
  hook: 'A delivery is waiting for you. Scroll to open it.',
  delivery: 'Signed, sealed, delivered: my resume.',
  unbox: 'My projects. Hover or tap a folder to look inside.',
  checkout: 'Packed and ready to ship.',
  contact: 'Want to talk? Send me a note.',
}

export const ui = {
  title: 'Recruiter Workspace Delivery',
  scrollCue: 'scroll',
  monitorSub: 'Delivery for you inside.',
  downloadResume: 'Download resume',
  skip3d: 'Skip 3D',
  view3d: 'View 3D',
  loading: 'Setting up the studio…',
  label: { from: 'FROM: Omkar Satish Nikam', to: 'TO: You', note: 'CONTENTS: resume + projects' },
  stamp: 'HIRE ME',
  formTitle: 'Contact slip',
  formSend: 'Open in email app',
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
