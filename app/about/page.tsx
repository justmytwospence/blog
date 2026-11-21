import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getRecentBooksOrThrow, type UserBook } from '@blog/hardcover';
import { RandomAdventurePhoto } from '@/components/about/RandomAdventurePhoto';
import { RecentBooksWidget } from '@/components/RecentBooksWidget';
import { RecentAdventuresWidget } from '@/components/adventures/RecentAdventuresWidget';
import { PageContainer } from '@/components/PageContainer';
import { getActivityGrandTotals, getAllAdventures, getRandomBannerPhotos } from '@/lib/adventures';
import { getAllProjects } from '@/lib/content';
import { readThrough } from '@/lib/last-good';
import { AUTHOR, SITE_URL } from '@/lib/site';

// Renders via ISR (hourly) — keep it static; readThrough serves last-good if Hardcover is down.
export const revalidate = 3600;

const SUMMARY =
  'Independent data scientist working across Bayesian modeling, production ML, LLM tooling, and full-stack data products.';
const DESCRIPTION = `About ${AUTHOR.name}. ${SUMMARY}`;

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { type: 'profile', url: '/about', title: `About ${AUTHOR.name}`, description: DESCRIPTION },
};

const EMAIL = 'hi@spencerboucher.com';

// ---------------------------------------------------------------------------------------------
// Work, newest first: the clients I consult for now, then past full-time roles.
// To add a company, put its logo in public/logos (cropped to the mark) and add an entry here.
// ---------------------------------------------------------------------------------------------

interface Company {
  name: string;
  href: string;
  /** Years for a past role; omitted for a current client, which shows "Now". */
  when?: string;
  /** The engagement for a client, the job title for an employer. */
  role: string;
  blurb: string;
  logo: ReactNode;
}

/** A logo sized by height, so each mark can be tuned to sit at the same optical weight. */
function Logo({ src, ratio, className }: { src: string; ratio: number; className: string }) {
  return <Image src={src} alt="" width={Math.round(64 * ratio)} height={64} className={`w-auto ${className}`} />;
}

const WORK: Company[] = [
  {
    name: 'VO Health',
    href: 'https://vohealth.co',
    role: 'Statistical modeling',
    blurb: 'Biomarkers for health and human performance, starting with a blood test for VO₂\u00a0max.',
    logo: <Logo src="/logos/vohealth.png" ratio={1.96} className="h-10" />,
  },
  {
    name: 'FieldGoal',
    href: 'https://fieldgoal.com',
    role: 'Bayesian demand forecasting',
    blurb: 'Hierarchical causal models of price elasticity and promotions for consumer packaged goods.',
    // No official wordmark asset is public; this lockup is rebuilt from their mark.
    logo: (
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 512 512" className="h-[1.375rem] w-[1.375rem] shrink-0" aria-hidden="true">
          <path
            fill="#4fbfa5"
            d="M469.333 0C492.843 0 512 19.285 512 42.667v426.666C512 492.715 492.843 512 469.333 512h-128c-24.554 0-42.666-18.304-42.666-42.667v-256h-256C18.283 213.333 0 195.2 0 170.667v-128C0 19.285 19.157 0 42.667 0zM0 341.333c0-24.554 18.112-42.666 42.667-42.666h128c24.554 0 42.666 18.112 42.666 42.666v128c0 24.555-18.112 42.667-42.666 42.667h-128C18.112 512 0 493.888 0 469.333z"
          />
        </svg>
        <span className="text-xl font-bold leading-none tracking-tight text-[#21433b]">FieldGoal</span>
      </span>
    ),
  },
  {
    name: 'Gametime',
    href: 'https://gametime.co',
    when: '2021 – 2024',
    role: 'Senior Product Data Scientist',
    blurb: 'Built the experimentation stack behind company-wide A/B testing, and the scoring that surfaces the best ticket deals.',
    logo: <Logo src="/logos/gametime.svg" ratio={6.43} className="h-[1.125rem]" />,
  },
  {
    name: 'InVision',
    href: 'https://www.invisionapp.com',
    when: '2019 – 2020',
    role: 'Senior Product Data Scientist',
    blurb: 'Built the next experimentation platform and used it to improve onboarding, retention, and conversion.',
    logo: <Logo src="/logos/invision.svg" ratio={2.92} className="h-8" />,
  },
  {
    name: 'DataCamp',
    href: 'https://www.datacamp.com',
    when: '2017 – 2018',
    role: 'Data Science Curriculum Lead',
    blurb: 'Designed and built the mobile data science curriculum, from the authoring format to the teaching guidelines.',
    logo: <Logo src="/logos/datacamp.svg" ratio={4.29} className="h-7" />,
  },
  {
    name: 'Uber',
    href: 'https://www.uber.com',
    when: '2014 – 2016',
    role: 'Data Scientist',
    blurb: 'Bayesian models of ride-sharing markets, Uber Eats dispatch optimization, and features for the internal ML platform.',
    logo: <Logo src="/logos/uber.svg" ratio={4.65} className="h-5" />,
  },
];

const EDUCATION = [
  {
    when: '2014',
    degree: 'Master of Science in Artificial Intelligence',
    school: 'University of San Francisco',
    logo: <Logo src="/logos/usf.png" ratio={4.51} className="h-8" />,
  },
  {
    when: '2011',
    degree: "Bachelor's in Neuroscience",
    school: 'Rice University',
    logo: <Logo src="/logos/rice.png" ratio={2.73} className="h-9" />,
  },
];

// ---------------------------------------------------------------------------------------------
// What I work on. `projects` are slugs in content/projects, linked as proof under each area; a
// slug that no longer exists is skipped rather than linked. `topic` is a /projects filter id.
// ---------------------------------------------------------------------------------------------

interface Area {
  title: string;
  description: string;
  tools: string[];
  projects?: string[];
  topic?: string;
  /** Shown instead of project links when the proof is client and employer work. */
  note?: string;
}

const AREAS: Area[] = [
  {
    title: 'Bayesian & probabilistic modeling',
    description: 'Designing and fitting models for inference, forecasting, and decisions under uncertainty.',
    tools: ['PyMC', 'ArviZ', 'NumPyro', 'MCMC', 'hierarchical models'],
    projects: ['cloudposterior', 'bayesdag', 'pacing'],
    topic: 'bayesian',
  },
  {
    title: 'Production ML & forecasting',
    description: 'Forecasting and ML systems that run in production, and the experimentation frameworks that measure them.',
    tools: ['scikit-learn', 'LightGBM', 'PyTorch', 'A/B testing', 'Snowflake', 'BigQuery'],
    note: 'The day job at Uber, InVision, Gametime, and FieldGoal.',
  },
  {
    title: 'LLM & AI engineering',
    description: 'Agentic tooling and MCP servers, Claude API integrations, and outputs grounded with evals and citations.',
    tools: ['Claude API', 'Model Context Protocol', 'Anthropic SDK', 'evals', 'RAG'],
    projects: ['pi-plugins', 'arviz-mcp', 'garmin-mcp'],
    topic: 'agent-tooling',
  },
  {
    title: 'Full-stack data products',
    description: 'Shipping end to end: data pipelines, APIs, and interactive front ends, then deploying and self-hosting them.',
    tools: ['TypeScript', 'React', 'Next.js', 'Rust / WASM', 'PostGIS', 'Docker', 'Modal'],
    projects: ['effort-curve', 'groundcover', 'bikefitter'],
    topic: 'web-apps',
  },
];

const ELSEWHERE = [
  { label: 'GitHub', detail: 'justmytwospence', href: 'https://github.com/justmytwospence' },
  { label: 'LinkedIn', detail: 'in/dataspencer', href: 'https://linkedin.com/in/dataspencer' },
  { label: 'Bluesky', detail: '@bsky.spencerboucher.com', href: 'https://bsky.app/profile/bsky.spencerboucher.com' },
  { label: 'RSS', detail: 'New posts in your reader', href: '/feed.xml' },
  { label: 'Ko-fi', detail: 'Buy me a coffee', href: 'https://ko-fi.com/spencerboucher' },
  { label: 'Resume', detail: 'One page, PDF', href: '/resume.pdf', download: 'spencer_boucher_resume.pdf' },
];

// ---------------------------------------------------------------------------------------------
// The row of buttons under the headline: the one place the page uses colour, each in the brand's
// own. Email is the outlined one, so it and GitHub's black do not read as a pair.
// ---------------------------------------------------------------------------------------------

interface ContactButton {
  label: string;
  href: string;
  /** Fill, text and hover colours. */
  tone: string;
  viewBox: string;
  path: string;
  /** Drawn as an outline instead of a filled glyph. */
  stroke?: boolean;
  evenOdd?: boolean;
  download?: string;
}

const BUTTONS: ContactButton[] = [
  {
    label: 'Email',
    href: `mailto:${EMAIL}`,
    tone: 'border border-gray-300 text-gray-900 hover:bg-gray-100 dark:border-[#555] dark:text-[#e4e4e4] dark:hover:bg-[#2d2d2e]',
    viewBox: '0 0 24 24',
    stroke: true,
    path: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/justmytwospence',
    tone: 'bg-[#24292f] text-white hover:bg-black dark:bg-white dark:text-[#24292f] dark:hover:bg-gray-200',
    viewBox: '0 0 24 24',
    evenOdd: true,
    path: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/in/dataspencer',
    tone: 'bg-[#0a66c2] text-white hover:bg-[#004182]',
    viewBox: '0 0 24 24',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    label: 'Bluesky',
    href: 'https://bsky.app/profile/bsky.spencerboucher.com',
    tone: 'bg-sky-500 text-white hover:bg-sky-600',
    viewBox: '0 0 600 530',
    path: 'm135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z',
  },
  {
    label: 'Ko-fi',
    href: 'https://ko-fi.com/spencerboucher',
    tone: 'bg-[#ff5e5b] text-white hover:bg-[#e54e4b]',
    viewBox: '0 0 24 24',
    stroke: true,
    path: 'M10 2v2M14 2v2M6 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
  },
  {
    label: 'Resume',
    href: '/resume.pdf',
    download: 'spencer_boucher_resume.pdf',
    tone: 'bg-green-600 text-white hover:bg-green-700',
    viewBox: '0 0 24 24',
    stroke: true,
    path: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    label: 'Subscribe',
    href: '/feed.xml',
    tone: 'bg-orange-500 text-white hover:bg-orange-600',
    viewBox: '0 0 20 20',
    path: 'M3.75 3a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H4a9 9 0 0 1 9 9v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75V14c0-6.075-4.925-11-11-11h-.25ZM3 7.75A.75.75 0 0 1 3.75 7H4a6 6 0 0 1 6 6v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V13a4 4 0 0 0-4-4h-.25A.75.75 0 0 1 3 8.25v-.5ZM6 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  },
];

// ---------------------------------------------------------------------------------------------
// Shared styles. Below the buttons the page is typeset rather than boxed: hairlines, a label
// rail, and one photo.
// ---------------------------------------------------------------------------------------------

const rule = 'border-gray-200 dark:border-[#303031]';
const muted = 'text-gray-500 dark:text-[#8f8f8f]';
const label = `text-xs font-semibold uppercase tracking-[0.16em] ${muted}`;
const link =
  'underline decoration-gray-300 underline-offset-4 transition-colors hover:text-blue-600 hover:decoration-blue-500 dark:decoration-[#555] dark:hover:text-blue-400';
const strongLink = `font-medium text-gray-900 dark:text-[#e4e4e4] ${link}`;
/**
 * Logos sit straight on the page in grey and take their colour when the row is hovered. They are
 * drawn for a light ground, so the dark theme flips their lightness and rotates the hue back.
 */
const logoTone =
  'opacity-75 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0 dark:hue-rotate-180 dark:invert';
/** One row of a ledger: when, mark, what. Stacks to mark and date over the text on small screens. */
const ledgerRow =
  'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-3 py-6 sm:grid-cols-[6.5rem_9.5rem_minmax(0,1fr)]';

/** A page section: a hairline, its label above, then the content at full width. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`border-t pt-8 ${rule}`}>
      <h2 className={label}>{title}</h2>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`inline-block h-[0.7em] w-[0.7em] ${className}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l6-6M4 3h5v5" />
    </svg>
  );
}

export default async function AboutPage() {
  // 6 fills a whole row at both grid widths (3 and 6 columns) in RecentBooksWidget.
  const recentBooks =
    (await readThrough<UserBook[]>('hardcover:recent-books', () =>
      getRecentBooksOrThrow(6),
    ).catch(() => null)) ?? [];
  const recentAdventures = getAllAdventures().slice(0, 3);
  const projectTitles = new Map(getAllProjects().map((project) => [project.slug, project.title]));
  // The photo band picks one of these per visit; the handful itself turns over with each revalidation.
  const bannerPhotos = getRandomBannerPhotos(24);
  // Lifetime totals come from the Strava store; with no store they are zero and the line is left out.
  const totals = await getActivityGrandTotals().catch(() => null);
  const miles = totals ? Math.round(totals.distanceMeters / 1609.344) : 0;
  const feet = totals ? Math.round((totals.elevationGainMeters * 3.28084) / 1000) * 1000 : 0;

  // schema.org profile: tells search engines this page is about a person and which accounts are his.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: AUTHOR.name,
      url: SITE_URL,
      jobTitle: 'Data Scientist',
      description: SUMMARY,
      sameAs: ELSEWHERE.filter((entry) => entry.href.startsWith('http')).map((entry) => entry.href),
      alumniOf: EDUCATION.map((entry) => ({ '@type': 'CollegeOrUniversity', name: entry.school })),
      knowsAbout: AREAS.map((area) => area.title),
    },
  };

  return (
    <PageContainer width="wide" className="sm:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header>
        <h1 className="max-w-5xl text-balance text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-gray-900 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.06] dark:text-white">
          Hi, I&rsquo;m Spencer.{' '}
          <span className="text-gray-400 max-sm:block dark:text-[#7a7a7a]">
            I build the whole data product, from the probabilistic model at its core to the app that ships it.
          </span>
        </h1>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {BUTTONS.map((button) => (
            <li key={button.label}>
              <a
                href={button.href}
                {...(button.href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
                {...(button.download && { download: button.download })}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${button.tone}`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox={button.viewBox}
                  aria-hidden="true"
                  {...(button.stroke
                    ? { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
                    : { fill: 'currentColor' })}
                >
                  <path {...(button.evenOdd && { fillRule: 'evenodd', clipRule: 'evenodd' })} d={button.path} />
                </svg>
                {button.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      {bannerPhotos.length > 0 && (
        <div className="mt-10 lg:mt-12">
          <RandomAdventurePhoto photos={bannerPhotos} />
        </div>
      )}

      <div className="mt-16 space-y-16 lg:mt-20 lg:space-y-20">
        <Section title="Background">
          <div className="max-w-2xl space-y-6 font-[family-name:var(--font-merriweather),Georgia,serif] text-[1.0625rem] font-light leading-[1.9] text-gray-800 sm:text-lg sm:leading-[1.9] dark:text-[#cfcfcf]">
            <p>
              I spent ten years at fast-moving companies like Uber and Gametime, building production ML and
              forecasting systems, running large-scale experiments, and turning messy data into decisions.
            </p>
            <p>
              Since 2024 I&rsquo;ve worked independently with startups and enterprise teams. Right now that
              means statistical modeling with VO Health and Bayesian demand forecasting with FieldGoal.
            </p>
            <p>
              The work I like most sits where Bayesian modeling, agent tooling, and full-stack engineering meet:{' '}
              <Link href="/projects/cloudposterior" className={strongLink}>
                PyMC models that sample in the cloud
              </Link>
              ,{' '}
              <Link href="/projects?topic=mcp" className={strongLink}>
                MCP servers
              </Link>{' '}
              that give AI agents real capabilities, and{' '}
              <Link href="/projects?topic=web-apps" className={strongLink}>
                interactive apps
              </Link>{' '}
              built with React, Next.js, and Rust/WebAssembly.
            </p>
          </div>
        </Section>

        <Section title="Work">
          <ol className={`divide-y ${rule}`}>
            {WORK.map((company) => (
              <li key={company.name} className={rule}>
                <a href={company.href} target="_blank" rel="noopener noreferrer" className={ledgerRow}>
                  <span className={`order-2 text-sm tabular-nums sm:order-1 ${muted}`}>
                    {company.when ?? (
                      <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-[#e4e4e4]">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:hidden" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                        </span>
                        Now
                      </span>
                    )}
                  </span>
                  <span className={`order-1 flex items-center sm:order-2 ${logoTone}`}>{company.logo}</span>
                  <span className="order-3 col-span-2 sm:col-span-1">
                    <span className="block font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-[#e4e4e4] dark:group-hover:text-blue-400">
                      {company.role}
                      <span className={`font-normal ${muted}`}> · {company.name}</span>
                      <Arrow className="ml-1.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 block text-[0.95rem] leading-relaxed text-gray-600 dark:text-[#a6a6a6]">
                      {company.blurb}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Focus">
          <div className="grid gap-x-12 gap-y-12 sm:grid-cols-2">
            {AREAS.map((area, index) => {
              const projects = (area.projects ?? []).filter((slug) => projectTitles.has(slug));
              return (
                <div key={area.title}>
                  <p className={`text-sm tabular-nums ${muted}`}>{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-[#e4e4e4]">
                    {area.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-gray-600 dark:text-[#a6a6a6]">{area.description}</p>
                  <p className={`mt-4 text-sm leading-relaxed ${muted}`}>{area.tools.join(' · ')}</p>
                  <p className="mt-3 text-sm text-gray-600 dark:text-[#a6a6a6]">
                    {area.note}
                    {projects.length > 0 && (
                      <>
                        See{' '}
                        {projects.map((slug, position) => (
                          <span key={slug}>
                            {position > 0 && ', '}
                            <Link href={`/projects/${slug}`} className={strongLink}>
                              {projectTitles.get(slug)}
                            </Link>
                          </span>
                        ))}
                        {area.topic && (
                          <>
                            , or{' '}
                            <Link href={`/projects?topic=${area.topic}`} className={strongLink}>
                              the rest
                            </Link>
                          </>
                        )}
                        .
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Education">
          <ol className={`divide-y ${rule}`}>
            {EDUCATION.map((entry) => (
              <li key={entry.school} className={`${ledgerRow} ${rule}`}>
                <span className={`order-2 text-sm tabular-nums sm:order-1 ${muted}`}>{entry.when}</span>
                <span className={`order-1 flex items-center sm:order-2 ${logoTone}`}>{entry.logo}</span>
                <span className="order-3 col-span-2 sm:col-span-1">
                  <span className="block font-semibold text-gray-900 dark:text-[#e4e4e4]">{entry.degree}</span>
                  <span className="mt-1 block text-[0.95rem] text-gray-600 dark:text-[#a6a6a6]">{entry.school}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Outside">
          <p className="max-w-2xl text-lg leading-relaxed text-gray-700 dark:text-[#cccccc]">
            Away from the keyboard I&rsquo;m usually on a trail or a skin track: ski mountaineering, Nordic skiing,
            trail running, and the occasional triathlon.
            {miles > 0 && (
              <>
                {' '}
                So far that adds up to{' '}
                <span className="font-semibold tabular-nums text-gray-900 dark:text-[#e4e4e4]">
                  {miles.toLocaleString('en-US')} miles
                </span>{' '}
                and{' '}
                <span className="font-semibold tabular-nums text-gray-900 dark:text-[#e4e4e4]">
                  {feet.toLocaleString('en-US')} feet
                </span>{' '}
                of climbing.
              </>
            )}
          </p>
          <div className="mt-8">
            <RecentAdventuresWidget adventures={recentAdventures} />
          </div>
        </Section>

        {recentBooks.length > 0 && (
          <Section title="Reading">
            <RecentBooksWidget books={recentBooks} />
          </Section>
        )}

        <Section title="Elsewhere">
          <p className="max-w-3xl text-balance text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-3xl sm:leading-snug dark:text-white">
            The best way to reach me is email:{' '}
            <a href={`mailto:${EMAIL}`} className={`text-blue-600 dark:text-blue-400 ${link}`}>
              {EMAIL}
            </a>
          </p>
          <ul className={`mt-10 grid gap-x-12 border-t sm:grid-cols-2 ${rule}`}>
            {ELSEWHERE.map((entry) => (
              <li key={entry.label} className={`border-b ${rule}`}>
                <a
                  href={entry.href}
                  {...(entry.href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
                  {...(entry.download && { download: entry.download })}
                  className="group flex items-baseline justify-between gap-4 py-3.5"
                >
                  <span className="font-medium text-gray-900 transition-colors group-hover:text-blue-600 dark:text-[#e4e4e4] dark:group-hover:text-blue-400">
                    {entry.label}
                  </span>
                  <span className={`truncate text-sm ${muted}`}>
                    {entry.detail}
                    <Arrow className="ml-1.5" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageContainer>
  );
}
