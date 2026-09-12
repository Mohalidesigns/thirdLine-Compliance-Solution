import { Box, Typography } from '@mui/material';

function cleanText(t) {
  if (!t) return t;
  return t.replace(/^[\s\-"]+/, '');
}

function renderPoint(point, depth = 0) {
  const prefix = `(${point.marker}) `;
  return (
    <Box key={point.id} sx={{ ml: depth * 2, mb: 0.25 }}>
      <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary', fontWeight: 400 }}>
        {point.marker && <strong>{prefix}</strong>}
        {cleanText(point.content)}
      </Typography>
      {Array.isArray(point.children) && point.children.length > 0 && (
        <Box sx={{ mt: 0.25 }}>
          {point.children.map((child) => renderPoint(child, (point.level || 0) + 1))}
        </Box>
      )}
    </Box>
  );
}

function renderPoints(points, pointType) {
  const filtered = points.filter((p) => p.pointType === pointType);
  if (filtered.length === 0) return null;
  return (
    <Box sx={{ py: 0.5 }}>
      {filtered.map((point) => renderPoint(point, point.level || 0))}
    </Box>
  );
}

export default function FormattedText({ text, points, pointType }) {
  if (!text && (!points || points.length === 0)) return null;

  if (points && points.length > 0 && pointType) {
    const typePoints = points.filter((p) => p.pointType === pointType);
    if (typePoints.length > 0) {
      return <Box>{renderPoints(points, pointType)}</Box>;
    }
  }

  if (!text) return null;

  return (
    <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary', fontWeight: 400 }}>
      {cleanText(text)}
    </Typography>
  );
}
