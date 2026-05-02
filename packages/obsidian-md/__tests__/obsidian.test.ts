/**
 * Tests for Obsidian markdown preprocessor
 */

import { preprocessObsidian } from '../src';

describe('preprocessObsidian', () => {
  const slug = 'test-post';

  describe('image embeds', () => {
    it('should transform basic image embed', () => {
      const input = '![[photo.png]]';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('![photo.png](/blog/images/test-post/photo.png)');
    });

    it('should transform image embed with alt text', () => {
      const input = '![[photo.png|A nice photo]]';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('![A nice photo](/blog/images/test-post/photo.png)');
    });

    it('should handle multiple image embeds', () => {
      const input = '![[a.png]] and ![[b.jpg|caption]]';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe(
        '![a.png](/blog/images/test-post/a.png) and ![caption](/blog/images/test-post/b.jpg)',
      );
    });

    it('should handle image filenames with spaces', () => {
      const input = '![[my photo.png]]';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('![my photo.png](/blog/images/test-post/my photo.png)');
    });
  });

  describe('wiki links', () => {
    it('should transform basic wiki link to bold text', () => {
      const input = 'See [[my-note]] for details';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('See **my-note** for details');
    });

    it('should transform wiki link with display text', () => {
      const input = 'See [[my-note|this note]] for details';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('See **this note** for details');
    });

    it('should handle multiple wiki links', () => {
      const input = '[[first]] and [[second|two]]';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('**first** and **two**');
    });
  });

  describe('highlights', () => {
    it('should transform highlights to mark tags', () => {
      const input = 'This is ==important== text';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('This is <mark>important</mark> text');
    });

    it('should handle multiple highlights', () => {
      const input = '==one== and ==two==';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('<mark>one</mark> and <mark>two</mark>');
    });

    it('should not transform single equals signs', () => {
      const input = 'a = b and c == d';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('a = b and c == d');
    });
  });

  describe('code fence protection', () => {
    it('should not transform wiki links inside fenced code blocks', () => {
      const input = '```\n[[link]]\n```';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('```\n[[link]]\n```');
    });

    it('should not transform highlights inside fenced code blocks', () => {
      const input = '```python\nx == y\n```';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('```python\nx == y\n```');
    });

    it('should not transform image embeds inside fenced code blocks', () => {
      const input = '```\n![[image.png]]\n```';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('```\n![[image.png]]\n```');
    });

    it('should not transform inside inline code', () => {
      const input = 'Use `[[link]]` syntax';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('Use `[[link]]` syntax');
    });

    it('should transform outside code but not inside', () => {
      const input = '[[link]] and ```\n[[not-a-link]]\n``` and ==highlight==';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('**link** and ```\n[[not-a-link]]\n``` and <mark>highlight</mark>');
    });
  });

  describe('standard markdown passthrough', () => {
    it('should not modify standard markdown links', () => {
      const input = '[text](https://example.com)';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('[text](https://example.com)');
    });

    it('should not modify standard markdown images', () => {
      const input = '![alt](image.png)';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('![alt](image.png)');
    });

    it('should not modify headings, lists, or bold', () => {
      const input = '# Title\n\n- item\n- **bold**';
      const result = preprocessObsidian(input, slug);
      expect(result).toBe('# Title\n\n- item\n- **bold**');
    });

    it('should pass through empty content', () => {
      expect(preprocessObsidian('', slug)).toBe('');
    });
  });

  describe('combined transforms', () => {
    it('should handle all transform types in one document', () => {
      const input = [
        '# My Note',
        '',
        'See [[other-note|this]] for context.',
        '',
        '![[diagram.png|Architecture diagram]]',
        '',
        'The ==key takeaway== is important.',
        '',
        '```',
        '[[not transformed]] ==also not==',
        '```',
      ].join('\n');

      const result = preprocessObsidian(input, slug);

      expect(result).toContain('**this**');
      expect(result).toContain('![Architecture diagram](/blog/images/test-post/diagram.png)');
      expect(result).toContain('<mark>key takeaway</mark>');
      expect(result).toContain('[[not transformed]] ==also not==');
    });
  });
});
