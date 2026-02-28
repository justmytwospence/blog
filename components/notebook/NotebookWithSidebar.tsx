/**
 * Notebook with Sidebar Component
 * 
 * Wrapper component that coordinates the NotebookRenderer and TableOfContents,
 * sharing control state between them.
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { Notebook, ExtractedMetadata, TocEntry } from '@blog/notebook-parser/types';
import { generateCellId } from '@blog/notebook-parser/utils';
import { NotebookRenderer } from './NotebookRenderer';
import { TableOfContents } from './TableOfContents';
