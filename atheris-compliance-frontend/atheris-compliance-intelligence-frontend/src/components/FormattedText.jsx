import { Box, Typography } from '@mui/material';

function cleanText(t) {
  if (!t) return t;
  return t.replace(/^[\s\-"]+/, '');
}

function stripMarkerPrefix(t, marker) {
  if (!t || !marker) return cleanText(t);
  let out = t.replace(/^[\s\-"]+/, '');
  const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // exact "(marker)" with optional spaces, case-insensitive for letters
  const parenRe = new RegExp(`^\\(\\s*${esc}\\s*\\)\\s*`, 'i');
  let prev;
  do {
    prev = out;
    out = out.replace(parenRe, '');
    // plain "marker. " / "marker) " / "marker - " / "marker "
    const plainRe = new RegExp(`^${esc}[\\.\\)\\-\\:]?\\s+`, 'i');
    out = out.replace(plainRe, '');
    out = out.replace(/^[\s\-"]+/, '');
  } while (out !== prev && out.length > 0);
  return out;
}

function renderPoint(point, depth = 0, idx = 0, minLevel = 0) {
  const prefix = `(${point.marker}) `;
  const raw = point.content ?? point.text;
  const display = stripMarkerPrefix(raw, point.marker);
  return (
    <Box key={point.id ?? point.marker ?? idx} sx={{ ml: depth * 2, mb: 0.25 }}>
      <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary', fontWeight: 400 }}>
        {point.marker && <strong>{prefix}</strong>}
        {display}
      </Typography>
      {Array.isArray(point.children) && point.children.length > 0 && (
        <Box sx={{ mt: 0.25 }}>
          {point.children.map((child, cIdx) => {
            const childDepth = (child.level ?? 0) - minLevel;
            return renderPoint(child, childDepth < 0 ? 0 : childDepth, cIdx, minLevel);
          })}
        </Box>
      )}
    </Box>
  );
}

function renderPoints(points, pointType) {
  let filtered = points.filter((p) => p.pointType === pointType);
  if (filtered.length === 0) filtered = points.filter((p) => !p.pointType);
  if (filtered.length === 0) filtered = points;
  if (filtered.length === 0) return null;
  const minLevel = Math.min(...filtered.map((p) => p.level ?? 0));
  return (
    <Box sx={{ py: 0.5 }}>
      {filtered.map((point, idx) => renderPoint(point, (point.level ?? 0) - minLevel, idx, minLevel))}
    </Box>
  );
}

export default function FormattedText({ text, points, pointType }) {
  if (!text && (!points || points.length === 0)) return null;

  if (points && points.length > 0 && pointType) {
    let typePoints = points.filter((p) => p.pointType === pointType);
    if (typePoints.length === 0) typePoints = points.filter((p) => !p.pointType);
    if (typePoints.length === 0) typePoints = points;
    if (typePoints.length > 0) {
      const minLevel = Math.min(...typePoints.map((p) => p.level ?? 0));
      return (
        <Box sx={{ py: 0.5 }}>
          {typePoints.map((point, idx) => renderPoint(point, (point.level ?? 0) - minLevel, idx, minLevel))}
        </Box>
      );
    }
  }

  if (!text) return null;

  return (
    <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary', fontWeight: 400 }}>
      {cleanText(text)}
    </Typography>
  );
}
