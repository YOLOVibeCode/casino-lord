export interface Point {
  x: number;
  y: number;
}

export function measureRoadPath(overlayRoot: HTMLElement, gridPath: Point[]): Point[] {
  if (gridPath.length === 0) return [];

  // The overlay is a sibling of the board, not its parent: search from the
  // enclosing shell so the real Big Road cells are found.
  const scope: ParentNode =
    overlayRoot.closest(".display-shell") ?? overlayRoot.parentElement ?? overlayRoot;
  const bigRoad = scope.querySelector('[data-testid="big-road"]');
  if (!bigRoad) return fallbackCentre(overlayRoot, gridPath.length);

  const overlayRect = overlayRoot.getBoundingClientRect();

  return gridPath.map((grid) => {
    const cell = bigRoad.querySelector(
      `[data-row="${grid.y}"][data-col="${grid.x}"]`,
    ) as HTMLElement | null;

    if (!cell) {
      return {
        x: overlayRect.width * 0.5,
        y: overlayRect.height * 0.5,
      };
    }

    const rect = cell.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - overlayRect.left,
      y: rect.top + rect.height / 2 - overlayRect.top,
    };
  });
}

function fallbackCentre(overlayRoot: HTMLElement, count: number): Point[] {
  const rect = overlayRoot.getBoundingClientRect();
  const centre = { x: rect.width * 0.5, y: rect.height * 0.5 };
  return Array.from({ length: count }, () => centre);
}

export function defaultAnchor(overlayRoot: HTMLElement): Point {
  const rect = overlayRoot.getBoundingClientRect();
  return { x: rect.width * 0.5, y: rect.height * 0.5 };
}
