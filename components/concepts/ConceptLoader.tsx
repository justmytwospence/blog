'use client';

import { getConceptComponent } from './index';

interface ConceptLoaderProps {
  componentName: string;
}

export function ConceptLoader({ componentName }: ConceptLoaderProps) {
  const Component = getConceptComponent(componentName);

  if (!Component) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p className="text-yellow-800 dark:text-yellow-200">
          Interactive component not found: {componentName}
        </p>
      </div>
    );
  }

  return <Component />;
}
