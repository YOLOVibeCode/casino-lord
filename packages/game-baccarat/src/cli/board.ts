import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { importText, handsToRoadHands } from "../serialize.js";
import {
  buildRoads,
  renderBeadPlate,
  renderBigRoad,
  renderDerivedRoad,
  renderStats,
} from "../roads/index.js";

function main(): void {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write('Usage: board "B P P T Bb P"\n');
    process.exit(1);
  }

  const result = importText(input, DEFAULT_BACCARAT_RULES);
  if (!result.ok) {
    for (const err of result.errors) {
      process.stderr.write(`${err}\n`);
    }
    process.exit(1);
  }

  const roadHands = handsToRoadHands(result.hands);
  const roads = buildRoads(roadHands, DEFAULT_BACCARAT_RULES);

  process.stdout.write("BEAD PLATE\n");
  for (const line of renderBeadPlate(roads.beadPlate)) process.stdout.write(`${line}\n`);

  process.stdout.write("\nBIG ROAD\n");
  for (const line of renderBigRoad(roads.bigRoad)) process.stdout.write(`${line}\n`);

  process.stdout.write("\nBIG EYE BOY\n");
  for (const line of renderDerivedRoad(roads.bigEyeBoy)) process.stdout.write(`${line}\n`);

  process.stdout.write("\nSMALL ROAD\n");
  for (const line of renderDerivedRoad(roads.smallRoad)) process.stdout.write(`${line}\n`);

  process.stdout.write("\nCOCKROACH PIG\n");
  for (const line of renderDerivedRoad(roads.cockroachPig)) process.stdout.write(`${line}\n`);

  process.stdout.write(`\n${renderStats(roadHands)}\n`);
}

main();
