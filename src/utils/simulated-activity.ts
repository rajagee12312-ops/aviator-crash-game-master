import { BettedUserType } from "./interfaces";

const sampleBetAmounts = [20, 50, 100, 200, 500];
const sampleWagerCount = 24;

function getSeededFraction(seed: number) {
  const value = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return value / 0x100000000;
}

export function getSimulatedPlayerCount(roundId: number) {
  const seed = Math.imul(Math.max(1, Math.trunc(roundId || 1)), 37);
  return 300 + (Math.abs(seed) % 101);
}

export function getSimulatedRoundWagers(
  roundId: number,
  gameState: string,
  currentMultiplier: number,
  completedMultiplier?: number
): BettedUserType[] {
  const finalMultiplier = Number.isFinite(completedMultiplier)
    ? Number(completedMultiplier)
    : gameState === "CRASHED"
      ? currentMultiplier
      : 0;
  const resolved = finalMultiplier >= 1;
  const payoutMultiplier = resolved
    ? finalMultiplier
    : gameState === "FLYING"
      ? currentMultiplier
      : 1;

  return Array.from({ length: sampleWagerCount }, (_, index) => {
    const seed = Math.imul(Math.max(1, Math.trunc(roundId || 1)), 31) + index * 7919;
    const betAmount = sampleBetAmounts[
      Math.floor(getSeededFraction(seed) * sampleBetAmounts.length)
    ];
    const target = Math.round((1.15 + getSeededFraction(seed + 13) * 4.85) * 100) / 100;
    const cashouted = target <= payoutMultiplier;
    const profit = cashouted
      ? Math.round((betAmount * (target - 1) + Number.EPSILON) * 100) / 100
      : resolved
        ? -betAmount
        : 0;

    return {
      id: `sim-${roundId}-${index + 1}`,
      playerId: `sim-player-${index + 1}`,
      name: `Sim Pilot ${String(index + 1).padStart(2, "0")}`,
      betAmount,
      cashOut: cashouted ? target : 0,
      cashouted,
      target: resolved && !cashouted ? finalMultiplier : target,
      img: "",
      profit,
      side: "f",
      resolved,
      isSimulated: true,
    };
  });
}
