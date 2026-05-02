import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const BLOCK_MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
const INLINE_MATH_RE = /(\$[^$\n]+\$|\\\([^\n]+?\\\))/g;
const ALL_MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^\n]+?\\\))/g;
const LATEX_CMD_RE = /\\(times|implies|cdot|div|leq|geq|le|ge|in|notin|sqrt|frac|sum|int|log|sin|cos|tan|exp|partial|Delta|alpha|beta|gamma|lambda|mu|pi|sigma|theta|omega|Sigma|Pi|Omega|infty|approx|equiv|neq|pm)\b/;
const ALLOWED_FORMATTING_TAG_RE = /&lt;(\/?(?:strong|b|em|i|u|br))\s*\/??&gt;/gi;

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeFormattingMarkup = (value) => String(value || '')
  .replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_\n][\s\S]*?)__/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n][\s\S]*?)\*(?!\*)/g, '$1<em>$2</em>')
  .replace(/(^|[^_])_([^_\n][\s\S]*?)_(?!_)/g, '$1<em>$2</em>');

const formatPlainTextHtml = (rawText) => {
  const escaped = escapeHtml(normalizeFormattingMarkup(rawText));
  return escaped.replace(ALLOWED_FORMATTING_TAG_RE, '<$1>');
};

const normalizePlainTextSegment = (rawText) => {
  let text = String(rawText || '');

  // Support legacy root marker typed as '?72' in some old datasets.
  text = text.replace(/(^|[\s=+\-*/,(])\?(\d+(?:[.,]\d+)?)/g, (match, prefix, value) => {
    const normalizedValue = String(value).replace(',', '.');
    return `${prefix}$\\sqrt{${normalizedValue}}$`;
  });

  // Support unicode square-root marker, e.g. '√72'.
  text = text.replace(/√\s*([0-9a-zA-Z()]+)/g, (match, value) => `$\\sqrt{${value}}$`);

  // Common exponent notation in plain text, e.g. 'x^2'.
  text = text.replace(/\b([a-zA-Z0-9]+)\^(\d+)\b/g, (match, base, power) => `$${base}^{${power}}$`);

  // Auto-wrap plain lines containing LaTeX commands (e.g. \times, \implies)
  // when the line is not already wrapped in math delimiters.
  text = text
    .split('\n')
    .map((line) => {
      if (!line || !LATEX_CMD_RE.test(line)) return line;

      const trimmed = line.trim();
      const alreadyWrapped =
        (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
        (trimmed.startsWith('$') && trimmed.endsWith('$')) ||
        (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) ||
        (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'));

      if (alreadyWrapped) return line;
      return `$${line}$`;
    })
    .join('\n');

  return text;
};

const normalizeLegacyMathMarkers = (rawText) => String(rawText || '')
  .split(ALL_MATH_RE)
  .map((segment) => (parseMathToken(segment) ? segment : normalizePlainTextSegment(segment)))
  .join('');

const renderMath = (expr, displayMode) => {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
      output: 'html',
      trust: false,
    });
  } catch (_) {
    return null;
  }
};

const parseMathToken = (token) => {
  if (!token) return null;

  if (token.startsWith('$$') && token.endsWith('$$')) {
    return { expr: token.slice(2, -2), display: true };
  }
  if (token.startsWith('\\[') && token.endsWith('\\]')) {
    return { expr: token.slice(2, -2), display: true };
  }
  if (token.startsWith('$') && token.endsWith('$')) {
    return { expr: token.slice(1, -1), display: false };
  }
  if (token.startsWith('\\(') && token.endsWith('\\)')) {
    return { expr: token.slice(2, -2), display: false };
  }

  return null;
};

const renderInlineParts = (textPart, keyPrefix) => {
  const tokens = String(textPart || '').split(INLINE_MATH_RE);

  return tokens.map((token, index) => {
    const parsed = parseMathToken(token);
    if (!parsed) {
      const html = formatPlainTextHtml(token);
      return (
        <span
          key={`${keyPrefix}-plain-${index}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    const html = renderMath(parsed.expr, false);
    if (!html) {
      return <React.Fragment key={`${keyPrefix}-fallback-${index}`}>{token}</React.Fragment>;
    }

    return (
      <span
        key={`${keyPrefix}-math-${index}`}
        className="align-middle"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  });
};

export default function MathText({ text, className = '', display = false }) {
  const normalized = normalizeLegacyMathMarkers(text);
  const blockTokens = String(normalized).split(BLOCK_MATH_RE);

  if (!display) {
    return (
      <span className={className} style={{ whiteSpace: 'pre-wrap' }}>
        {renderInlineParts(normalized, 'inline')}
      </span>
    );
  }

  return (
    <div className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {blockTokens.map((token, index) => {
        const parsed = parseMathToken(token);
        if (!parsed) {
          return <React.Fragment key={`block-plain-${index}`}>{renderInlineParts(token, `block-inline-${index}`)}</React.Fragment>;
        }

        const html = renderMath(parsed.expr, parsed.display);
        if (!html) {
          return <React.Fragment key={`block-fallback-${index}`}>{token}</React.Fragment>;
        }

        return (
          <div
            key={`block-math-${index}`}
            className={parsed.display ? 'my-2 overflow-x-auto' : 'inline'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
