import "server-only";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { publishEvent } from "@/lib/event-bus";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerHealthCheck, createSimpleHealthCheck } from "@/lib/health-system";

interface ThreatSignal {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  source: string;
  description: string;
  indicators: string[];
  timestamp: string;
  confidence: number;
}

interface ThreatPattern {
  pattern: RegExp;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  weight: number;
  description: string;
}

class AutonomousThreatIntelligence {
  private patterns: ThreatPattern[] = [];
  private signals: ThreatSignal[] = [];
  private readonly MAX_SIGNALS = 10_000;
  private knownAttackers = new Set<string>();
  private anomalyBaseline = new Map<string, number>();

  constructor() {
    this.initializePatterns();
    this.startAdaptiveLearning();

    registerHealthCheck(createSimpleHealthCheck(
      "threat-intelligence",
      false,
      async () => true,
      async () => ({
        patterns: this.patterns.length,
        signalsTracked: this.signals.length,
        knownAttackers: this.knownAttackers.size,
      })
    ));
  }

  private initializePatterns(): void {
    this.patterns = [
      { pattern: /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, type: "sql-injection", severity: "critical", weight: 1.0, description: "SQL injection attempt detected" },
      { pattern: /<script[\s>]/i, type: "xss", severity: "critical", weight: 0.9, description: "Cross-site scripting attempt detected" },
      { pattern: /onerror\s*=|onload\s*=|onclick\s*=/i, type: "xss-event-handler", severity: "high", weight: 0.8, description: "XSS event handler injection" },
      { pattern: /javascript\s*:/i, type: "xss-javascript", severity: "high", weight: 0.8, description: "JavaScript URI injection" },
      { pattern: /(\.\.\/)|(\.\.\\)|(\%2e\%2e)/i, type: "path-traversal", severity: "high", weight: 0.9, description: "Path traversal attempt" },
      { pattern: /(union.*select)|(select.*from)|(insert.*into)|(drop.*table)|(delete.*from)/i, type: "sql-manipulation", severity: "critical", weight: 0.9, description: "SQL manipulation detected" },
      { pattern: /(\%00)|(\\x00)|(null\s*\%|null\s*\\0)/i, type: "null-byte-injection", severity: "high", weight: 0.7, description: "Null byte injection attempt" },
      { pattern: /exec\s*\(|system\s*\(|passthru\s*\(|shell_exec/i, type: "command-injection", severity: "critical", weight: 1.0, description: "Command injection attempt" },
      { pattern: /(\\\\[\\?\%])|(\$\{)/i, type: "template-injection", severity: "critical", weight: 0.8, description: "Server-side template injection" },
      { pattern: /(admin\s*=\s*1)|(is_admin\s*=\s*true)|(role\s*=\s*['\"]?admin)/i, type: "privilege-escalation", severity: "high", weight: 0.7, description: "Privilege escalation attempt" },
      { pattern: /(?:[a-f0-9]{32})/i, type: "hash-leak", severity: "medium", weight: 0.5, description: "Potential hash/secret leak in request" },
      { pattern: /(?:https?:\/\/[^\s"'<>]*(?:phishing|login|secure|verify|account|update|confirm)[^\s"'<>]*\.(?:com|net|org|io))/i, type: "phishing-url", severity: "high", weight: 0.8, description: "Potential phishing URL detected" },
      { pattern: /(?:bearer\s+[a-zA-Z0-9_\-]+\.{2}[a-zA-Z0-9_\-]+)|(?:sk-[a-zA-Z0-9]{20,})/i, type: "credential-leak", severity: "critical", weight: 1.0, description: "API credential leak in request" },
    ];
  }

  private startAdaptiveLearning(): void {
    setInterval(() => {
      this.adaptPatterns();
    }, 86_400_000);
  }

  private adaptPatterns(): void {
    const recentSignals = this.signals.slice(-1000);
    const typeCounts = new Map<string, number>();

    for (const signal of recentSignals) {
      typeCounts.set(signal.type, (typeCounts.get(signal.type) ?? 0) + 1);
    }

    for (const pattern of this.patterns) {
      const frequency = typeCounts.get(pattern.type) ?? 0;
      const anomalyScore = frequency > 100 ? frequency / recentSignals.length : 0;

      if (anomalyScore > 0.3) {
        pattern.weight = Math.min(pattern.weight * 1.2, 1.0);
        logWarn("threat_intel.pattern_adapted", {
          type: pattern.type,
          newWeight: pattern.weight,
          frequency,
        });
      } else if (frequency === 0 && pattern.weight > 0.3) {
        pattern.weight = Math.max(pattern.weight * 0.9, 0.3);
      }
    }
  }

  analyze(input: string, source: string): ThreatSignal | null {
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(input)) {
        const signal: ThreatSignal = {
          type: pattern.type,
          severity: pattern.severity,
          source,
          description: pattern.description,
          indicators: [input.slice(0, 200)],
          timestamp: new Date().toISOString(),
          confidence: pattern.weight,
        };

        this.signals.push(signal);
        if (this.signals.length > this.MAX_SIGNALS) {
          this.signals = this.signals.slice(-this.MAX_SIGNALS / 2);
        }

        if (pattern.severity === "critical") {
          this.knownAttackers.add(source);
          publishEvent({
            type: "admin.alert",
            severity: "critical",
            entityType: "threat",
            payload: { type: pattern.type, source, description: pattern.description },
          }).catch(() => undefined);
        }

        return signal;
      }
    }
    return null;
  }

  isKnownAttacker(source: string): boolean {
    return this.knownAttackers.has(source);
  }

  getSignals(limit = 100): ThreatSignal[] {
    return this.signals.slice(-limit).reverse();
  }

  getStats() {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const signal of this.signals) {
      severityCounts[signal.severity]++;
    }

    return {
      totalSignals: this.signals.length,
      knownAttackers: this.knownAttackers.size,
      activePatterns: this.patterns.length,
      severityCounts,
      recentSignals: this.signals.slice(-10).reverse(),
    };
  }
}

export const threatIntel = new AutonomousThreatIntelligence();
