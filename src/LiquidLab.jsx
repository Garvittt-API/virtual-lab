import React, { lazy, Suspense } from "react";

const SessionWorkbench = lazy(() => import("./SessionWorkbench"));

/** Compatibility route into the canonical free session and its one-time liquid-state migration. */
export default function LiquidLab() {
  return (
    <Suspense fallback={<div role="status">Loading saved liquid workspace…</div>}>
      <SessionWorkbench initialMode="free" legacyKey="materia-liquid" />
    </Suspense>
  );
}
