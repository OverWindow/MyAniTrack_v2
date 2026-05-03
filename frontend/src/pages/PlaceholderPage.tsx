import '../styles/pages/PlaceholderPage.css'

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <span className="section-kicker">Coming next</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}
