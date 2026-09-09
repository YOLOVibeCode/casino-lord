/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { measureRoadPath } from "./measure-path.js";

describe("measureRoadPath", () => {
  it("maps big road grid cells to overlay-relative centres", () => {
    const overlay = document.createElement("div");
    overlay.style.width = "400px";
    overlay.style.height = "300px";
    document.body.appendChild(overlay);

    const bigRoad = document.createElement("div");
    bigRoad.setAttribute("data-testid", "big-road");
    overlay.appendChild(bigRoad);

    const cell = document.createElement("div");
    cell.setAttribute("data-row", "1");
    cell.setAttribute("data-col", "2");
    cell.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 80,
        width: 20,
        height: 20,
      }) as DOMRect;
    bigRoad.appendChild(cell);

    overlay.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
      }) as DOMRect;

    const points = measureRoadPath(overlay, [{ x: 2, y: 1 }]);
    expect(points[0]).toEqual({ x: 130, y: 90 });

    document.body.removeChild(overlay);
  });
});
