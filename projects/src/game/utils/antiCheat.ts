import type { GameMode } from "@/game/utils/rewardTiers";

export type ScoreSubmission = {
  score: number;
  durationSeconds: number;
  collectedItems: number;
  obstaclesHit: number;
  sessionId: string;
  mode: GameMode;
};

export function validateGameScore(input: ScoreSubmission) {
  const errors: string[] = [];
  const score = Math.trunc(Number(input.score));
  const durationSeconds = Math.trunc(Number(input.durationSeconds));
  const collectedItems = Math.trunc(Number(input.collectedItems));
  const obstaclesHit = Math.trunc(Number(input.obstaclesHit));

  if (!input.sessionId || input.sessionId.length < 12 || input.sessionId.length > 80) {
    errors.push("Invalid game session.");
  }

  if (!["quick", "coupon", "daily"].includes(input.mode)) {
    errors.push("Invalid game mode.");
  }

  if (durationSeconds < 10 || durationSeconds > 240) {
    errors.push("Game duration is outside the allowed range.");
  }

  if (score < 0 || score > 9000) {
    errors.push("Score is outside the allowed range.");
  }

  const maxScoreByDuration = durationSeconds * 42 + collectedItems * 80 + 450;
  if (score > maxScoreByDuration) {
    errors.push("Score is higher than the possible game limit.");
  }

  if (collectedItems < 0 || collectedItems > durationSeconds * 6) {
    errors.push("Collected item count is not realistic.");
  }

  if (obstaclesHit < 0 || obstaclesHit > 12) {
    errors.push("Obstacle count is not realistic.");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      score,
      durationSeconds,
      collectedItems,
      obstaclesHit
    }
  };
}
