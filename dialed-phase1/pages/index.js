import Head from 'next/head'
import AppLayout from '../components/AppLayout'

export default function Home() {
  return (
    <>
      <Head>
        <title>DIALED — Disc Golf AI Caddy</title>
        <meta name="description" content="Personalized flight intelligence for disc golf" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23ffeb3b'/></svg>" />
      </Head>
      <AppLayout />
    </>
  )
}
