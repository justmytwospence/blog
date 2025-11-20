---
title: "Building This Portfolio: A Vibe-Coded Journey"
date: "2024-11-20"
categories: ["meta", "web-development", "portfolio", "next.js"]
description: "How I built this data science portfolio site by vibe-coding with modern tools, and my plans for adding real projects"
featured: true
---

# Building This Portfolio: A Vibe-Coded Journey

## The Vision

I wanted a clean, modern portfolio to showcase my data science work—one that could handle Jupyter notebooks, interactive visualizations, and traditional blog posts. Rather than spending weeks planning every detail, I decided to embrace the art of "vibe-coding": starting with a clear vision and letting the implementation flow naturally.

## The Stack

I chose **Next.js 16** with the App Router for its excellent developer experience and static site generation capabilities. The tech stack came together beautifully:

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety and better tooling
- **Tailwind CSS v4** - Utility-first styling
- **React Markdown** - Rendering blog posts
- **Custom Jupyter Renderer** - For displaying notebooks with full fidelity
- **Plotly** - Interactive data visualizations
- **next-themes** - Seamless dark mode

## The Build Process

### Phase 1: Foundation

I started by setting up the core infrastructure:
- Theme system with dark mode support
- Content loading system for markdown and notebooks
- Navigation and layouts
- Basic routing structure

The beauty of vibe-coding is trusting your instincts. When something felt clunky, I refactored. When a feature felt natural, I kept it simple.

### Phase 2: Notebook Support

This was the exciting part—building a custom Jupyter notebook renderer that could handle:
- Code cells with syntax highlighting
- Multiple output types (text, HTML, images, Plotly charts)
- Markdown cells with LaTeX math support
- Quarto features (callouts, cross-references)
- Interactive tables
- Table of contents

Rather than using an off-the-shelf solution, I built it piece by piece, ensuring it integrated perfectly with the site's design system.

### Phase 3: Polish

The final touches:
- Responsive design across all screen sizes
- Accessibility improvements
- Error boundaries for graceful degradation
- Loading states and animations
- SEO optimization

## What's Next

Right now, you're looking at a beautiful shell. The infrastructure is solid, the design is clean, and the notebook renderer works great. But the real work is just beginning:

### Upcoming Projects

I'll be adding my actual data science projects, including:

- **Customer churn prediction models** - Survival analysis and time-series forecasting
- **Exploratory data analysis** - Real datasets with interactive visualizations
- **Machine learning experiments** - From random forests to neural networks
- **Data visualization showcases** - Demonstrating best practices
- **External tools** - Like my VertFarmer app for agricultural optimization

### The Migration Process

Each project needs to be:
1. Cleaned up and documented
2. Converted to notebook format or markdown
3. Enhanced with proper metadata
4. Tested in the renderer
5. Published with a compelling description

## Lessons Learned

**Vibe-coding works best with:**
- A clear end goal
- Modern tools with good DX
- Willingness to iterate
- Trust in your technical instincts

**The key is momentum.** By building quickly and refining as you go, you avoid analysis paralysis and actually ship something.

## Try It Yourself

If you're thinking about building a portfolio:
1. Pick a modern framework (Next.js, Astro, SvelteKit)
2. Start with one feature you really want
3. Build it, test it, refine it
4. Add the next feature
5. Don't wait for perfection

The perfect portfolio is the one that exists. Mine's live now, and it'll only get better as I add more projects.

---

*This site is open source and continuously evolving. Check back soon for new projects and content!*
