import { useState, type FormEvent, type RefObject } from 'react'
import type { Section } from './Scene'
import { captions, person, projects, ui } from './content'

type Props = {
  name: string
  section: Section
  active: number | null
  setActive: (i: number | null) => void
  keepOpen: () => void
  onLeavePanel: () => void
  hasResume: boolean
  loading: boolean
  railRef: RefObject<HTMLDivElement | null>
  onSkip: () => void
  onContact: () => void
}

// Opens the visitor's email app with a prefilled message (no backend)
export function ContactForm() {
  const [from, setFrom] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const subject = `Hello from ${from || 'a visitor'}`
    const body = `${msg}\n\n${from}${email ? ` (${email})` : ''}`
    window.location.href = `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  return (
    <form className="slip" onSubmit={submit}>
      <h3>{ui.formTitle}</h3>
      <label>Name<input value={from} onChange={(e) => setFrom(e.target.value)} required maxLength={80} /></label>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={120} /></label>
      <label>Message<textarea value={msg} onChange={(e) => setMsg(e.target.value)} required rows={3} maxLength={2000} /></label>
      <button type="submit" className="btn accent">{ui.formSend}</button>
      <div className="links">
        <a href={person.github} target="_blank" rel="noreferrer">GitHub</a>
        <a href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
        <a href={`mailto:${person.email}`}>{person.email}</a>
      </div>
    </form>
  )
}

export default function Overlay(p: Props) {
  const showProjects = p.section === 'unbox'
  const proj = showProjects && p.active !== null ? projects[p.active] : null

  return (
    <div className="overlay">
      <div className="rail"><div ref={p.railRef} className="rail-fill" /></div>

      {p.loading && <div className="loading">{ui.loading}</div>}

      <header className="brand">
        <strong>{person.name}</strong>
        <span>{person.headline}</span>
      </header>

      <button className="btn skip" onClick={p.onSkip}>{ui.skip3d}</button>

      <p key={p.section} className={`caption caption-${p.section}`}>{captions[p.section]}</p>

      {p.section === 'hook' && <div className="scroll-cue">{ui.scrollCue}<span /></div>}

      {p.section === 'delivery' && p.hasResume && (
        <a className="btn accent resume-btn" href={person.resume} download>{ui.downloadResume}</a>
      )}

      {showProjects && (
        <nav className="project-row" aria-label="Projects">
          {projects.map((pr, i) => (
            <button key={pr.title} className={`chip ${p.active === i ? 'on' : ''}`} onClick={() => p.setActive(p.active === i ? null : i)}>
              {pr.title}
            </button>
          ))}
        </nav>
      )}

      {proj && (
        <aside className="panel" onMouseEnter={p.keepOpen} onMouseLeave={p.onLeavePanel} role="dialog" aria-label={proj.title}>
          <button className="close" onClick={() => p.setActive(null)} aria-label="Close">×</button>
          <h2>{proj.title}</h2>
          <p>{proj.description}</p>
          <a className="btn accent" href={proj.link} target="_blank" rel="noreferrer">View on GitHub</a>
        </aside>
      )}

      {p.section === 'contact' && <ContactForm />}

      <nav className="dock" aria-label="Quick links">
        {p.hasResume && <a href={person.resume} download>Resume</a>}
        <a href={person.github} target="_blank" rel="noreferrer">GitHub</a>
        <a href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
        <button onClick={p.onContact}>Contact</button>
      </nav>
    </div>
  )
}
