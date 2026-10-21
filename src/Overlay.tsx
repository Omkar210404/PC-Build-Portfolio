import { useState, type FormEvent, type RefObject } from 'react'
import type { Section } from './Scene'
import { aiml, internship, languages, person, projects, sap, sections, ui } from './content'

type Props = {
  section: Section
  active: string | null // 'ram-0'..'ram-3' or 'ssd-0'..; null = nothing open
  setActive: (k: string | null) => void
  keepOpen: () => void
  onLeavePanel: () => void
  hasResume: boolean
  loading: boolean
  railRef: RefObject<HTMLDivElement | null>
  onSkip: () => void
  onContact: () => void
}

// BIOS-style contact form: opens the visitor's email app with a prefilled message (no backend)
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
    <form className="bios" onSubmit={submit}>
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

export function SapList() {
  return (
    <>
      <p className="sub">{sap.title}</p>
      <ul className="tags">{sap.items.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="sub">{internship.role} · {internship.org}, {internship.place} · {internship.year}</p>
    </>
  )
}

// Section card: what each part "means"
function Card({ section, active, setActive }: Pick<Props, 'section' | 'active' | 'setActive'>) {
  const toggle = (k: string) => setActive(active === k ? null : k)
  switch (section) {
    case 'cpu':
      return (
        <section className="card">
          <h2>{sections.cpu.title}</h2>
          <p className="big">{person.name}</p>
          <p className="sub">{person.headline}</p>
          <p className="sub">{person.degree}</p>
        </section>
      )
    case 'ram':
      return (
        <section className="card">
          <h2>{sections.ram.title}</h2>
          <p className="sub">{sections.ram.text}</p>
          <div className="chips">
            {languages.map((l, i) => (
              <button key={l.name} className={`chip ${active === `ram-${i}` ? 'on' : ''}`} onClick={() => toggle(`ram-${i}`)}>{l.name}</button>
            ))}
          </div>
        </section>
      )
    case 'gpu':
      return (
        <section className="card">
          <h2>{sections.gpu.title}</h2>
          <ul className="tags">{aiml.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      )
    case 'ssd':
      return (
        <section className="card">
          <h2>{sections.ssd.title}</h2>
          <p className="sub">{sections.ssd.text}</p>
          <div className="chips">
            {projects.slice(0, 6).map((p, i) => (
              <button key={p.title} className={`chip ${active === `ssd-${i}` ? 'on' : ''}`} onClick={() => toggle(`ssd-${i}`)}>{p.title}</button>
            ))}
          </div>
        </section>
      )
    case 'power':
      return (
        <section className="card">
          <h2>{sections.power.title}</h2>
          <SapList />
        </section>
      )
    default:
      return null
  }
}

export default function Overlay(p: Props) {
  const [kind, idx] = (p.active ?? '').split('-')
  const i = Number(idx)
  const proj = p.section === 'ssd' && kind === 'ssd' ? projects[i] : null
  const lang = p.section === 'ram' && kind === 'ram' ? languages[i] : null

  return (
    <div className="overlay">
      <div className="rail"><div ref={p.railRef} className="rail-fill" /></div>
      {p.loading && <div className="loading">{ui.loading}</div>}

      <header className="brand">
        <strong>{person.name}</strong>
        <span>{person.headline}</span>
      </header>
      <button className="btn skip" onClick={p.onSkip}>{ui.skip3d}</button>

      {p.section === 'hook' && (
        <div className="hook">
          <h1>{sections.hook.title}</h1>
          <div className="scroll-cue">{ui.scrollCue}<span /></div>
        </div>
      )}
      {p.section === 'boot' && <p className="caption">{sections.boot.title}</p>}

      <Card key={p.section} section={p.section} active={p.active} setActive={p.setActive} />

      {(proj || lang) && (
        <aside className="panel" onMouseEnter={p.keepOpen} onMouseLeave={p.onLeavePanel} role="dialog" aria-label={proj?.title ?? lang?.name}>
          <button className="close" onClick={() => p.setActive(null)} aria-label="Close">×</button>
          {proj && (
            <>
              <h2>{proj.title}</h2>
              <p>{proj.description}</p>
              {proj.stack.length > 0 && <ul className="tags">{proj.stack.map((s) => <li key={s}>{s}</li>)}</ul>}
              <a className="btn accent" href={proj.link} target="_blank" rel="noreferrer">View on GitHub</a>
            </>
          )}
          {lang && (
            <>
              <h2>{lang.name}</h2>
              <p>{lang.note}</p>
            </>
          )}
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
