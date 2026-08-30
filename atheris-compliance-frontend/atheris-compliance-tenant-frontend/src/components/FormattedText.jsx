import { Box, Typography } from '@mui/material';

const MARKER_RE = /\d+(?:\.\d+)*\.\s+|[a-zA-Z]\.\s+|[ivxIVX]+\.\s+|\(\d+(?:\.\d+)*\)\s+|\([a-zA-Z]\)\s+|\([ivxIVX]+\)\s+/g;

function preSplit(text) {
  const positions = [];
  let m;
  const re = new RegExp(MARKER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    positions.push(m.index);
  }
  if (positions.length === 0) return text;

  const filtered = positions.filter((pos, i) => {
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    const content = text.slice(pos, end).trim();
    return content.length >= 6;
  });
  if (filtered.length === 0) return text;
  const lines = [];
  if (filtered[0] > 0) lines.push(text.slice(0, filtered[0]));
  for (let i = 0; i < filtered.length; i++) {
    const end = i + 1 < filtered.length ? filtered[i + 1] : text.length;
    lines.push(text.slice(filtered[i], end));
  }
  return lines.join('\n');
}

function detectMarker(line) {
  const t = line.trim();
  let m;
  if ((m = t.match(/^\(?([ivxIVX]+)\)?[\.\):\s]+(.*)/))) return { level: 2, marker: m[1].toLowerCase(), content: m[2] };
  if ((m = t.match(/^\(?([a-zA-Z])\)?[\.\):\s]+(.*)/))) return { level: 1, marker: m[1].toLowerCase(), content: m[2] };
  if ((m = t.match(/^\(?(\d+(?:\.\d+)*)\)?[\.\):\s]+(.*)/))) return { level: 0, marker: m[1], content: m[2] };
  return null;
}

function parseHierarchy(text) {
  if (!text) return [];
  const split = preSplit(text);
  const lines = split.split('\n');
  const root = [];
  const stack = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const marker = detectMarker(trimmed);

    if (marker) {
      while (stack.length > 0 && stack[stack.length - 1].level >= marker.level) {
        stack.pop();
      }
      const node = { type: 'item', marker: marker.marker, level: marker.level, content: marker.content, children: [] };
      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(node);
      } else {
        root.push(node);
      }
      stack.push({ level: marker.level, node });
    } else {
      if (stack.length > 0) {
        stack[stack.length - 1].node.content += ' ' + trimmed;
      } else {
        const last = root[root.length - 1];
        if (last && last.type === 'paragraph') {
          last.content += ' ' + trimmed;
        } else {
          root.push({ type: 'paragraph', content: trimmed });
        }
      }
    }
  }

  return root;
}

const LEVEL_STYLES = [
  { fontWeight: 700, color: 'text.primary' },
  { fontWeight: 500, color: 'text.primary' },
  { fontWeight: 400, color: 'text.secondary' },
];

function renderNode(node, depth = 0) {
  if (node.type === 'paragraph') {
    return (
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6, color: 'text.primary' }}>
        {node.content}
      </Typography>
    );
  }

  const style = LEVEL_STYLES[node.level] || LEVEL_STYLES[2];
  const prefix = node.level === 0 ? `${node.marker}. ` : `(${node.marker}) `;

  return (
    <Box key={`${node.marker}-${node.content.slice(0, 20)}`} sx={{ ml: depth * 2 }}>
      <Typography variant="body2" sx={{ fontWeight: style.fontWeight, color: style.color, mb: 0.5, lineHeight: 1.6 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{prefix}</Box>
        {node.content}
      </Typography>
      {node.children.length > 0 && (
        <Box sx={{ ml: 2, borderLeft: '2px solid', borderColor: 'divider', pl: 1.5, mt: 0.25 }}>
          {node.children.map((child, i) => renderNode(child, depth + 1))}
        </Box>
      )}
    </Box>
  );
}

export default function FormattedText({ text }) {
  if (!text) return null;
  const tree = parseHierarchy(text);
  if (tree.length === 0) return null;

  return (
    <Box sx={{ py: 0.5 }}>
      {tree.map((node, i) => (
        <Box key={i}>{renderNode(node)}</Box>
      ))}
    </Box>
  );
}
