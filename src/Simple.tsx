import { person, projects, ui } from './content'
import { ContactForm } from './Overlay'

// Plain, fast HTML version. Used when WebGL is missing, reduced motion is set, or "Skip 3D" is clicked.
export default function Simple({ hasResume, canView3d, onView3d }: {
  hasResume: boolean; canView3d: boolean; onView3d: () => void
}) {
  return (
    <main className="simple">
      {canView3d && <button className="btn skip" onClick={onView3d}>{ui.view3d}</button>}
      <section>
        <h1>{person.name}</h1>
        <p className="lead">{person.headline}</p>
        <div className="links">
          {hasResume && <a className="btn accent" href={person.resume} download>{ui.downloadResume}</a>}
          <a href={person.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={`mailto:${person.email}`}>{person.email}</a>
        </div>
      </section>
      <section>
        <h2>Projects</h2>
        <ul className="cards">
          {projects.map((p) => (
            <li key={p.title} style={{ borderLeftColor: p.color }}>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <a href={p.link} target="_blank" rel="noreferrer">View on GitHub</a>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <ContactForm />
      </section>
    </main>
  )
}
