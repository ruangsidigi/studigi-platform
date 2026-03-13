import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const BLOCK_MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
const INLINE_MATH_RE = /(\$[^$\n]+\$|\\\([^\n]+?\\\))/g;

const normalizeLegacyMathMarkers = (rawText) => {
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

  // Common fraction notation for numeric values, e.g. '3/4'.
  text = text.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (match, num, den) => `$\\frac{${num}}{${den}}$`);

  return text;
};

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
      return <React.Fragment key={`${keyPrefix}-plain-${index}`}>{token}</React.Fragment>;
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
