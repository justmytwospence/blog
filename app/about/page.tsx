import Image from 'next/image';
import { getCurrentlyReading } from '@blog/hardcover';
import { CurrentlyReadingWidget } from '@/components/CurrentlyReadingWidget';
import { RecentAdventuresWidget } from '@/components/adventures/RecentAdventuresWidget';
import { getAllAdventures } from '@/lib/adventures';
import { PageContainer } from '@/components/PageContainer';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About',
  description:
    'About Spencer Boucher — data scientist working across Bayesian modeling, production ML, LLM tooling, and full-stack data products.',
};

export default async function AboutPage() {
  const currentlyReading = await getCurrentlyReading(3);
  const recentAdventures = getAllAdventures().slice(0, 3);

  return (
    <PageContainer width="wide" className="sm:py-12">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            About Me
          </h1>
          
          {/* Contact Buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hi@spencerboucher.com"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">Email</span>
            </a>

            <a
              href="https://github.com/justmytwospence"
              target="_blank"
              rel="noopener noreferrer"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">GitHub</span>
            </a>

            <a
              href="https://linkedin.com/in/dataspencer"
              target="_blank"
              rel="noopener noreferrer"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="font-medium">LinkedIn</span>
            </a>

            <a
              href="https://bsky.app/profile/justmytwospence.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 600 530">
                <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
              </svg>
              <span className="font-medium">Bluesky</span>
            </a>

            <a
              href="/resume.pdf"
              download="spencer_boucher_resume.pdf"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Resume</span>
            </a>

            <a
              href="/feed.xml"
              className="grow flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3.75 3a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75V16C17 8.82 11.18 3 4 3h-.25Z" />
                <path d="M3 8.75A.75.75 0 0 1 3.75 8H4a8 8 0 0 1 8 8v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V16a6 6 0 0 0-6-6h-.25A.75.75 0 0 1 3 9.25v-.5Z" />
                <path d="M7 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
              </svg>
              <span className="font-medium">Subscribe</span>
            </a>
          </div>
        </div>
        
        <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
          I'm a data scientist who builds the full stack of a data product — from the probabilistic model at its core to the app that ships it.
          Over <span className="font-semibold text-gray-900 dark:text-white">10 years</span> at fast-moving companies I've built production ML and forecasting systems, run large-scale experiments, and turned messy data into decisions.
          Lately I work where Bayesian modeling, LLM and agent tooling, and full-stack engineering meet: PyMC models that sample in the cloud, MCP servers that give AI agents real capabilities, and interactive apps built with React, Next.js, and Rust/WebAssembly.
        </p>

        {/* Companies Section */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Companies I've Worked With
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Uber */}
            <a 
              href="https://www.uber.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-24 p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Image 
                src="/logos/uber.svg" 
                alt="Uber" 
                width={100} 
                height={40}
              />
            </a>
            
            {/* DataCamp */}
            <a 
              href="https://www.datacamp.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-24 p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Image 
                src="/logos/datacamp.svg" 
                alt="DataCamp" 
                width={120} 
                height={40}
              />
            </a>
            
            {/* InVision */}
            <a 
              href="https://www.invisionapp.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-24 p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Image 
                src="/logos/invision.svg" 
                alt="InVision" 
                width={120} 
                height={40}
              />
            </a>
            
            {/* Gametime */}
            <a 
              href="https://gametime.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-24 p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Image
                src="/logos/gametime.svg"
                alt="Gametime"
                width={120}
                height={40}
              />
            </a>

            {/* FieldGoal */}
            <a
              href="https://fieldgoal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-24 p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 512 512" className="h-7 w-7 shrink-0" aria-hidden="true">
                  <path fill="#4fbfa5" d="M469.333 0C492.843 0 512 19.285 512 42.667v426.666C512 492.715 492.843 512 469.333 512h-128c-24.554 0-42.666-18.304-42.666-42.667v-256h-256C18.283 213.333 0 195.2 0 170.667v-128C0 19.285 19.157 0 42.667 0zM0 341.333c0-24.554 18.112-42.666 42.667-42.666h128c24.554 0 42.666 18.112 42.666 42.666v128c0 24.555-18.112 42.667-42.666 42.667h-128C18.112 512 0 493.888 0 469.333z"/>
                </svg>
                <span className="text-2xl font-bold tracking-tight text-[#21433b]">FieldGoal</span>
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* What I Work On Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          What I Work On
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Bayesian & probabilistic modeling */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bayesian &amp; probabilistic modeling</h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">Design and fit models for inference, forecasting, and decisions under uncertainty.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['PyMC', 'ArviZ', 'NumPyro', 'MCMC', 'hierarchical models'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Production ML & forecasting at scale */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Production ML &amp; forecasting at scale</h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">Build forecasting and ML systems that run in production — plus the experimentation frameworks to measure them.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['scikit-learn', 'LightGBM', 'PyTorch', 'forecasting', 'A/B testing', 'Snowflake', 'BigQuery'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* LLM & AI engineering */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">LLM &amp; AI engineering</h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">Build agentic tooling and MCP servers, integrate the Claude API, and ground outputs with evals and citations.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['Claude API', 'Model Context Protocol', 'Anthropic SDK', 'evals', 'RAG / citations'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Full-stack data products */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Full-stack data products</h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">Ship end-to-end: data pipelines, APIs, and interactive front-ends — then deploy and self-host them.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['TypeScript', 'React', 'Next.js', 'Rust / WASM', 'PostgreSQL / PostGIS', 'Docker', 'Modal', 'Vercel'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Education Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          Education
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-6 p-6 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="shrink-0 w-24 h-24 flex items-center justify-center bg-gray-50 rounded-lg p-3">
              <Image 
                src="/logos/usf.png" 
                alt="University of San Francisco" 
                width={84} 
                height={84}
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Master of Science in Artificial Intelligence</h3>
              <p className="text-gray-600 dark:text-gray-400">University of San Francisco</p>
            </div>
          </div>
          <div className="flex items-center gap-6 p-6 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div className="shrink-0 w-24 h-24 flex items-center justify-center bg-gray-50 rounded-lg p-3">
              <Image 
                src="/logos/rice.png" 
                alt="Rice University" 
                width={84} 
                height={84}
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Bachelor's in Neuroscience</h3>
              <p className="text-gray-600 dark:text-gray-400">Rice University</p>
            </div>
          </div>
        </div>
      </div>

      <RecentAdventuresWidget adventures={recentAdventures} />

      <CurrentlyReadingWidget books={currentlyReading} />
    </PageContainer>
  );
}
