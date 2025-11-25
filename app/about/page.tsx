import Image from 'next/image';

export default function AboutPage() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            About Me
          </h1>
          
          {/* Contact Buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:spencer@spencerboucher.com"
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
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
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg transition-colors"
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
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="font-medium">LinkedIn</span>
            </a>

            <a
              href="/resume.pdf"
              download
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Resume</span>
            </a>

            <a
              href="/feed.xml"
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
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
          I'm a data scientist with a passion for figuring out just the right way to model your unique data. 
          I have <span className="font-semibold text-gray-900 dark:text-white">10 years of experience</span> at fast-moving companies helping unlock insights and drive decisions with data.
          When I'm not analyzing data, I'm in the mountains running, skiing, cycling, or climbing.
        </p>

        {/* Companies Section */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Companies I've Worked With
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Uber */}
            <a 
              href="https://www.uber.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
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
              className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
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
              className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
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
              className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <Image 
                src="/logos/gametime.svg" 
                alt="Gametime" 
                width={120} 
                height={40}
              />
            </a>
          </div>
        </div>
      </div>

      {/* What I Do Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          What I Do
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Develop machine learning models for classification and regression tasks</span>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Build data pipelines and ETL processes</span>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <svg className="w-6 h-6 text-green-600 dark:text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Create interactive visualizations and dashboards</span>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
            <svg className="w-6 h-6 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Build and operate A/B testing frameworks</span>
          </div>
        </div>
      </div>

      {/* Technical Skills Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          How I Do It
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 [background:linear-gradient(to_bottom_right,rgb(239_246_255),rgb(219_234_254))] dark:[background:linear-gradient(to_bottom_right,rgb(30_58_138/0.2),rgb(30_64_175/0.2))] rounded-lg border border-blue-200 dark:border-blue-700/50">
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Python</h3>
            <p className="text-gray-700 dark:text-gray-300">
              NumPy, Pandas, Scikit-learn, TensorFlow, PyTorch
            </p>
          </div>
          <div className="p-6 [background:linear-gradient(to_bottom_right,rgb(250_245_255),rgb(243_232_255))] dark:[background:linear-gradient(to_bottom_right,rgb(88_28_135/0.2),rgb(107_33_168/0.2))] rounded-lg border border-purple-200 dark:border-purple-700/50">
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">R</h3>
            <p className="text-gray-700 dark:text-gray-300">
              tidyverse, ggplot2, caret
            </p>
          </div>
          <div className="p-6 [background:linear-gradient(to_bottom_right,rgb(240_253_244),rgb(220_252_231))] dark:[background:linear-gradient(to_bottom_right,rgb(20_83_45/0.2),rgb(22_101_52/0.2))] rounded-lg border border-green-200 dark:border-green-700/50">
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">SQL</h3>
            <p className="text-gray-700 dark:text-gray-300">
              PostgreSQL, MySQL, BigQuery
            </p>
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Master's in Data Science</h3>
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
    </main>
  );
}
