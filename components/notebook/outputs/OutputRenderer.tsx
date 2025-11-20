/**
 * Output Renderer Orchestrator
 * 
 * Routes cell outputs to appropriate MIME type renderers and manages
 * output visibility, execution counts, and figure captions.
 */

'use client';

import React from 'react';
import type { CellOutput, QuartoCellOptions } from '@/lib/notebook/types';
import { TextOutput } from './TextOutput';
import { ImageOutput } from './ImageOutput';
import { HtmlOutput } from './HtmlOutput';
import { JsonOutput } from './JsonOutput';
import { ErrorOutput } from './ErrorOutput';
import { PlotlyOutput } from './PlotlyOutput';
import { WidgetOutput } from './WidgetOutput';
import { OutputErrorBoundary } from '../errors/OutputErrorBoundary';

interface OutputRendererProps {
  outputs: CellOutput[];
  cellOptions?: QuartoCellOptions;
  globalOptions?: {
    warning?: boolean;
    error?: boolean;
  };
  executionCount?: number | null;
  visible?: boolean;
  cellIndex?: number;
}

/**
 * OutputRenderer component
 * 
 * Orchestrates rendering of cell outputs by routing to appropriate
 * MIME type renderers based on output type and data.
 */
export function OutputRenderer({
  outputs,
  cellOptions = {},
  globalOptions = {},
  executionCount,
  visible = true,
  cellIndex = 0,
}: OutputRendererProps) {
  if (!visible || !outputs || outputs.length === 0) {
    return null;
  }

  // Filter outputs based on warning and error options
  const shouldShowWarnings = cellOptions.warning !== undefined ? cellOptions.warning : globalOptions.warning !== undefined ? globalOptions.warning : true;
  const shouldShowErrors = cellOptions.error !== undefined ? cellOptions.error : globalOptions.error !== undefined ? globalOptions.error : true;
  
  // Debug logging
  if (typeof window !== 'undefined' && cellIndex === 3 && outputs.length > 0) {
    console.log('[OutputRenderer] Cell 3 filtering:', {
      outputs,
      cellOptions,
      globalOptions,
      shouldShowWarnings,
      shouldShowErrors
    });
  }
  
  const filteredOutputs = outputs.filter(output => {
    // Filter out stderr/warning outputs if warning: false
    if (!shouldShowWarnings && output.output_type === 'stream') {
      const streamOutput = output as { output_type: 'stream'; name: string; text: string | string[] };
      if (streamOutput.name === 'stderr') {
        return false;
      }
    }
    // Filter out error outputs if error: false
    if (!shouldShowErrors && output.output_type === 'error') {
      return false;
    }
    return true;
  });

  // Merge consecutive HTML outputs (e.g., Plotly library + plot call)
  const mergedOutputs: CellOutput[] = [];
  let i = 0;
  
  while (i < filteredOutputs.length) {
    const output = filteredOutputs[i];
    
    // Check if this and next output are both HTML outputs
    if (
      (output.output_type === 'display_data' || output.output_type === 'execute_result') &&
      output.data?.['text/html'] &&
      i + 1 < filteredOutputs.length
    ) {
      const nextOutput = filteredOutputs[i + 1];
      if (
        (nextOutput.output_type === 'display_data' || nextOutput.output_type === 'execute_result') &&
        nextOutput.data?.['text/html']
      ) {
        // Merge the two HTML outputs
        const mergedHtml = [
          ...(Array.isArray(output.data['text/html']) ? output.data['text/html'] : [output.data['text/html']]),
          ...(Array.isArray(nextOutput.data['text/html']) ? nextOutput.data['text/html'] : [nextOutput.data['text/html']])
        ];
        
        mergedOutputs.push({
          ...output,
          data: {
            ...output.data,
            'text/html': mergedHtml
          }
        });
        
        i += 2; // Skip the next output since we merged it
        continue;
      }
    }
    
    mergedOutputs.push(output);
    i++;
  }

  return (
    <div className="notebook-outputs">
      {/* Render each output */}
      <div className="output-content space-y-2">
        {mergedOutputs.map((output, index) => (
          <OutputErrorBoundary
            key={index}
            outputIndex={index}
            outputType={output.output_type}
          >
            <div className="output-item">
              {renderOutput(output, cellOptions, index, cellIndex)}
            </div>
          </OutputErrorBoundary>
        ))}
      </div>
    </div>
  );
}

/**
 * Route output to appropriate renderer based on output type
 */
function renderOutput(
  output: CellOutput,
  cellOptions: QuartoCellOptions,
  index: number,
  cellIndex: number
): React.ReactNode {
  // Handle error outputs
  if (output.output_type === 'error') {
    return <ErrorOutput output={output} key={`error-${index}`} />;
  }

  // Handle stream outputs (stdout/stderr)
  if (output.output_type === 'stream') {
    return <TextOutput output={output} key={`stream-${index}`} />;
  }

  // Handle display_data and execute_result outputs
  if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
    const data = output.data;

    if (!data) {
      return null;
    }

    // Priority order for MIME types (prefer richer formats)
    // Check for image outputs first
    if (data['image/png'] || data['image/jpeg'] || data['image/svg+xml']) {
      return (
        <ImageOutput
          data={data}
          cellOptions={cellOptions}
          cellIndex={cellIndex}
          outputIndex={index}
          key={`image-${index}`}
        />
      );
    }

    // Check for HTML output
    if (data['text/html']) {
      // Jupyter stores HTML as array of strings - join them
      const htmlContent = Array.isArray(data['text/html'])
        ? data['text/html'].join('')
        : data['text/html'];
      
      return (
        <HtmlOutput
          html={htmlContent}
          key={`html-${index}`}
        />
      );
    }

    // Check for JSON output
    if (data['application/json']) {
      return (
        <JsonOutput
          data={data['application/json']}
          key={`json-${index}`}
        />
      );
    }

    // Check for Plotly output
    if (data['application/vnd.plotly.v1+json']) {
      return (
        <PlotlyOutput
          data={data['application/vnd.plotly.v1+json']}
          key={`plotly-${index}`}
        />
      );
    }

    // Check for widget output
    if (data['application/vnd.jupyter.widget-view+json']) {
      return (
        <WidgetOutput
          data={data['application/vnd.jupyter.widget-view+json']}
          key={`widget-${index}`}
        />
      );
    }

    // Fall back to plain text if available
    if (data['text/plain']) {
      return (
        <TextOutput
          output={{
            output_type: 'stream',
            name: 'stdout',
            text: data['text/plain'],
          }}
          key={`text-${index}`}
        />
      );
    }

    // Unsupported MIME type - display fallback
    return (
      <div key={`unsupported-${index}`} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Unsupported output format. Available MIME types: {Object.keys(data).join(', ')}
        </p>
      </div>
    );
  }

  return null;
}
