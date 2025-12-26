import React from 'react';

/**
 * Parse rich text with Markdown-like formatting and return React elements
 * Supports:
 * - # Heading (xlarge)
 * - ## Subheading (large)
 * - **bold text**
 * - *italic text*
 */

interface TextFragment {
  content: string;
  bold?: boolean;
  italic?: boolean;
  heading?: 'h1' | 'h2';
}

function parseLineFragments(line: string): TextFragment[] {
  const fragments: TextFragment[] = [];
  let remaining = line;
  let currentIndex = 0;

  while (currentIndex < remaining.length) {
    // Check for **bold**
    const boldMatch = remaining.slice(currentIndex).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      fragments.push({
        content: boldMatch[1],
        bold: true
      });
      currentIndex += boldMatch[0].length;
      continue;
    }

    // Check for *italic*
    const italicMatch = remaining.slice(currentIndex).match(/^\*([^*]+)\*/);
    if (italicMatch) {
      fragments.push({
        content: italicMatch[1],
        italic: true
      });
      currentIndex += italicMatch[0].length;
      continue;
    }

    // Regular text - find next special character or end of string
    const nextSpecial = remaining.slice(currentIndex).search(/\*/);
    if (nextSpecial === -1) {
      // No more special characters
      if (currentIndex < remaining.length) {
        fragments.push({
          content: remaining.slice(currentIndex)
        });
      }
      break;
    } else if (nextSpecial > 0) {
      // Text before next special character
      fragments.push({
        content: remaining.slice(currentIndex, currentIndex + nextSpecial)
      });
      currentIndex += nextSpecial;
    } else {
      // Invalid markdown - treat as regular text
      fragments.push({
        content: remaining[currentIndex]
      });
      currentIndex++;
    }
  }

  return fragments;
}

function parseLine(line: string): { fragments: TextFragment[], heading?: 'h1' | 'h2' } {
  // Check for headings
  if (line.startsWith('# ')) {
    return {
      fragments: parseLineFragments(line.slice(2)),
      heading: 'h1'
    };
  }
  if (line.startsWith('## ')) {
    return {
      fragments: parseLineFragments(line.slice(3)),
      heading: 'h2'
    };
  }

  return {
    fragments: parseLineFragments(line)
  };
}

export function renderRichText(text: string, baseClasses: string = '', baseColor?: string): React.ReactNode {
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    if (line.trim() === '') {
      return <p key={lineIndex} className="mb-2">&nbsp;</p>;
    }

    const { fragments, heading } = parseLine(line);

    // Determine classes based on heading level
    let lineClasses = baseClasses;
    if (heading === 'h1') {
      // Remove base font size and apply xlarge
      lineClasses = baseClasses.replace(/text-(xs|sm|lg|xl|2xl|3xl)/g, '').trim();
      lineClasses += ' text-3xl font-bold';
    } else if (heading === 'h2') {
      // Remove base font size and apply large
      lineClasses = baseClasses.replace(/text-(xs|sm|lg|xl|2xl|3xl)/g, '').trim();
      lineClasses += ' text-xl font-semibold';
    }

    const renderFragments = fragments.map((fragment, fragIndex) => {
      const classes = [];
      if (fragment.bold) classes.push('font-bold');
      if (fragment.italic) classes.push('italic');

      if (classes.length > 0) {
        return (
          <span key={fragIndex} className={classes.join(' ')}>
            {fragment.content}
          </span>
        );
      }
      return <React.Fragment key={fragIndex}>{fragment.content}</React.Fragment>;
    });

    const Element = heading ? 'div' : 'p';
    const marginClass = heading ? 'mb-3' : 'mb-2';

    return (
      <Element
        key={lineIndex}
        className={`${lineClasses} ${marginClass} last:mb-0`}
        style={baseColor ? { color: baseColor } : undefined}
      >
        {renderFragments}
      </Element>
    );
  });
}

/**
 * Check if text contains any rich formatting
 */
export function hasRichFormatting(text: string): boolean {
  return /(\*\*.*?\*\*|\*.*?\*|^#+ )/m.test(text);
}
