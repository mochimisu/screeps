export function numMovePartsNeeded(parts: BodyPartConstant[], terrain: "road" | "plains" | "swamp" = "plains"): number {
  const terrainFactor = terrain === "road" ? 0.5 : terrain === "plains" ? 1 : 1.5;
  const nonMoveParts = parts.filter(part => part !== MOVE);
  const withoutCarry = nonMoveParts.filter(part => part !== CARRY);

  const nonMoveNumMove = Math.ceil(nonMoveParts.length * terrainFactor);
  const withoutCarryNumMove = Math.ceil(withoutCarry.length * terrainFactor);
  console.log(`Total: ${nonMoveNumMove}, Without carrying: ${withoutCarryNumMove}`);
  return nonMoveNumMove;
}
