/**
 * Notebook with Sidebar Component
 * 
 * Wrapper component that coordinates the NotebookRenderer and TableOfContents,
 * sharing control state between them.
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { Notebook, ExtractedMetadata, TocEntry } from '@/lib/notebook/types';
import { generateCellId } from '@/lib/notebook/utils';
import { NotebookRenderer } from './NotebookRenderer';
import { TableOfContents } from './TableOfContents';
