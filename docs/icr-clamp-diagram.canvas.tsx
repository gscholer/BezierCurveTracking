import { useHostTheme } from "qoder/canvas";

export default function ICRClampDiagram() {
  const { tokens } = useHostTheme();

  const ox = 160;
  const oy = 220;
  const len = 140;

  // Angles in degrees
  const thetaMax = 35;
  const thetaDiff = 65;

  // Convert degrees to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Endpoints
  const hEnd = { x: ox + len, y: oy };
  const vEnd = { x: ox + len * Math.cos(toRad(-thetaDiff)), y: oy + len * Math.sin(toRad(-thetaDiff)) };
  const vClampedEnd = { x: ox + len * Math.cos(toRad(thetaMax)), y: oy + len * Math.sin(toRad(thetaMax)) };

  // Arc paths
  const arcRadius = 90;
  const arcRadiusSmall = 60;

  // Sector path: from -thetaMax to +thetaMax (in canvas coordinates, +y is down)
  // Actually in SVG y increases downward, so -thetaMax in math is +thetaMax in SVG y
  // Let me reconsider: h is along +x. v is at -thetaDiff (above h). v_clamped is at +thetaMax (below h).
  // In standard math: angle 0 is +x, positive is CCW. In SVG: same as standard math if we think in terms of screen.
  // But y increases downward, so a positive angle goes clockwise.

  // Let's use standard math angles and compute x,y directly:
  // x = ox + r * cos(angle), y = oy - r * sin(angle)  (minus because SVG y is down)

  const polar = (r: number, angleDeg: number) => ({
    x: ox + r * Math.cos(toRad(angleDeg)),
    y: oy - r * Math.sin(toRad(angleDeg)),
  });

  const hPolar = polar(len, 0);
  const vPolar = polar(len, thetaDiff);
  const vClampedPolar = polar(len, -thetaMax);

  const sectorStart = polar(arcRadius, thetaMax);
  const sectorEnd = polar(arcRadius, -thetaMax);
  const sectorOuterStart = polar(len, thetaMax);
  const sectorOuterEnd = polar(len, -thetaMax);

  const sectorPath = [
    `M ${ox} ${oy}`,
    `L ${sectorStart.x} ${sectorStart.y}`,
    `A ${arcRadius} ${arcRadius} 0 0 0 ${sectorEnd.x} ${sectorEnd.y}`,
    `L ${ox} ${oy}`,
    `M ${ox} ${oy}`,
    `L ${sectorOuterStart.x} ${sectorOuterStart.y}`,
    `A ${len} ${len} 0 0 0 ${sectorOuterEnd.x} ${sectorOuterEnd.y}`,
    `L ${ox} ${oy}`,
  ].join(" ");

  // Arc for theta_max
  const thetaMaxArcStart = polar(arcRadiusSmall, thetaMax);
  const thetaMaxArcEnd = polar(arcRadiusSmall, 0);
  const thetaMaxArcPath = `M ${thetaMaxArcStart.x} ${thetaMaxArcStart.y} A ${arcRadiusSmall} ${arcRadiusSmall} 0 0 0 ${thetaMaxArcEnd.x} ${thetaMaxArcEnd.y}`;

  // Arc for theta_diff
  const thetaDiffArcStart = polar(arcRadius + 20, thetaDiff);
  const thetaDiffArcEnd = polar(arcRadius + 20, 0);
  const thetaDiffArcPath = `M ${thetaDiffArcEnd.x} ${thetaDiffArcEnd.y} A ${arcRadius + 20} ${arcRadius + 20} 0 0 1 ${thetaDiffArcStart.x} ${thetaDiffArcStart.y}`;

  // Arrow helpers
  const arrowHead = (endX: number, endY: number, angleDeg: number, color: string) => {
    const arrLen = 10;
    const arrAngle = 25;
    const a1 = toRad(angleDeg + 180 - arrAngle);
    const a2 = toRad(angleDeg + 180 + arrAngle);
    const x1 = endX + arrLen * Math.cos(a1);
    const y1 = endY - arrLen * Math.sin(a1);
    const x2 = endX + arrLen * Math.cos(a2);
    const y2 = endY - arrLen * Math.sin(a2);
    return (
      <polygon
        points={`${endX},${endY} ${x1},${y1} ${x2},${y2}`}
        fill={color}
      />
    );
  };

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: 24 }}>
      <svg width="600" height="360" viewBox="0 0 600 360" style={{ background: tokens.bg.editor, borderRadius: 8 }}>
        {/* Allowed sector */}
        <path
          d={sectorPath}
          fill={tokens.status.successBg}
          opacity={0.35}
          stroke="none"
        />

        {/* Boundary line for theta_max above */}
        <line
          x1={ox}
          y1={oy}
          x2={sectorOuterStart.x}
          y2={sectorOuterStart.y}
          stroke={tokens.status.success}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />
        {/* Boundary line for theta_max below */}
        <line
          x1={ox}
          y1={oy}
          x2={sectorOuterEnd.x}
          y2={sectorOuterEnd.y}
          stroke={tokens.status.success}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />

        {/* h arrow (heading) */}
        <line
          x1={ox}
          y1={oy}
          x2={hPolar.x}
          y2={hPolar.y}
          stroke={tokens.text.primary}
          strokeWidth={2.5}
        />
        {arrowHead(hPolar.x, hPolar.y, 0, tokens.text.primary)}
        <text x={hPolar.x + 12} y={hPolar.y + 5} fill={tokens.text.primary} fontSize={14} fontWeight={600}>
          h（当前航向）
        </text>

        {/* v arrow (out of bounds) */}
        <line
          x1={ox}
          y1={oy}
          x2={vPolar.x}
          y2={vPolar.y}
          stroke={tokens.status.danger}
          strokeWidth={2}
          strokeDasharray="6,4"
        />
        {arrowHead(vPolar.x, vPolar.y, thetaDiff, tokens.status.danger)}
        <text x={vPolar.x + 8} y={vPolar.y - 8} fill={tokens.status.danger} fontSize={13} fontWeight={600}>
          v（原始追逐方向，超界）
        </text>

        {/* v_clamped arrow */}
        <line
          x1={ox}
          y1={oy}
          x2={vClampedPolar.x}
          y2={vClampedPolar.y}
          stroke={tokens.status.success}
          strokeWidth={2.5}
        />
        {arrowHead(vClampedPolar.x, vClampedPolar.y, -thetaMax, tokens.status.success)}
        <text x={vClampedPolar.x + 8} y={vClampedPolar.y + 18} fill={tokens.status.success} fontSize={13} fontWeight={600}>
          v_clamped（约束后的方向）
        </text>

        {/* theta_max arc */}
        <path
          d={thetaMaxArcPath}
          fill="none"
          stroke={tokens.status.success}
          strokeWidth={1.5}
        />
        <text x={polar(arcRadiusSmall - 16, thetaMax / 2).x} y={polar(arcRadiusSmall - 16, thetaMax / 2).y + 4} fill={tokens.status.success} fontSize={12}>
          θ_max
        </text>

        {/* theta_diff arc */}
        <path
          d={thetaDiffArcPath}
          fill="none"
          stroke={tokens.status.danger}
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
        <text x={polar(arcRadius + 36, thetaDiff / 2 + 6).x} y={polar(arcRadius + 36, thetaDiff / 2 + 6).y} fill={tokens.status.danger} fontSize={12}>
          θ_diff (&gt; θ_max)
        </text>

        {/* Origin label */}
        <circle cx={ox} cy={oy} r={3} fill={tokens.text.primary} />
        <text x={ox - 8} y={oy + 18} fill={tokens.text.secondary} fontSize={12}>
          O
        </text>

        {/* Legend / annotation for allowed boundary */}
        <text x={sectorOuterEnd.x + 10} y={sectorOuterEnd.y + 4} fill={tokens.status.success} fontSize={12} opacity={0.9}>
          ← 允许边界 (θ_max)
        </text>
      </svg>
    </div>
  );
}
