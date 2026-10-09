/**
 * Core calculation engine.
 * Calculates available time, break time, and session time from raw status events.
 * This is the single source of truth for all time calculations.
 */

export type StatusEvent = {
  id: number;
  status: "logged_in" | "break" | "back" | "logged_out";
  timestamp: Date | string;
};

export type SessionBreak = {
  breakStart: Date;
  breakEnd: Date | null;
  durationSeconds: number;
};

export type CalculatedSession = {
  loginTime: Date;
  logoutTime: Date | null;
  availableSeconds: number;
  breakSeconds: number;
  sessionSeconds: number;
  isComplete: boolean;
  breaks: SessionBreak[];
};

export type DailyStats = {
  date: string;
  availableSeconds: number;
  breakSeconds: number;
  sessionSeconds: number;
  breakCount: number;
  sessionCount: number;
  sessions: CalculatedSession[];
  isIncomplete: boolean;
};

/**
 * Calculate sessions from a list of raw status events (sorted by timestamp).
 */
export function calculateSessionsFromEvents(events: StatusEvent[]): CalculatedSession[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const sessions: CalculatedSession[] = [];
  let currentSession: CalculatedSession | null = null;
  let currentBreakStart: Date | null = null;

  for (const event of sorted) {
    const ts = new Date(event.timestamp);

    if (event.status === "logged_in") {
      // If there's already a session without logout, close it first (incomplete)
      if (currentSession && !currentSession.logoutTime) {
        // Close any open break
        if (currentBreakStart) {
          const breakDuration = Math.floor((ts.getTime() - currentBreakStart.getTime()) / 1000);
          currentSession.breaks.push({
            breakStart: currentBreakStart,
            breakEnd: ts,
            durationSeconds: breakDuration,
          });
          currentSession.breakSeconds += breakDuration;
          currentBreakStart = null;
        }
        currentSession.isComplete = false;
        sessions.push(currentSession);
        currentSession = null;
      }

      currentSession = {
        loginTime: ts,
        logoutTime: null,
        availableSeconds: 0,
        breakSeconds: 0,
        sessionSeconds: 0,
        isComplete: false,
        breaks: [],
      };
      currentBreakStart = null;
    } else if (event.status === "break") {
      if (!currentSession) continue;
      if (currentBreakStart) continue; // Already on break, ignore duplicate

      // End available period
      const lastAvailableStart = getLastAvailableStart(currentSession);
      if (lastAvailableStart) {
        currentSession.availableSeconds += Math.floor(
          (ts.getTime() - lastAvailableStart.getTime()) / 1000
        );
      }
      currentBreakStart = ts;
    } else if (event.status === "back") {
      if (!currentSession) continue;
      if (!currentBreakStart) continue; // Not on break, ignore

      const breakDuration = Math.floor((ts.getTime() - currentBreakStart.getTime()) / 1000);
      currentSession.breaks.push({
        breakStart: currentBreakStart,
        breakEnd: ts,
        durationSeconds: breakDuration,
      });
      currentSession.breakSeconds += breakDuration;
      currentBreakStart = null;
    } else if (event.status === "logged_out") {
      if (!currentSession) continue;

      // Close open break if any
      if (currentBreakStart) {
        const breakDuration = Math.floor((ts.getTime() - currentBreakStart.getTime()) / 1000);
        currentSession.breaks.push({
          breakStart: currentBreakStart,
          breakEnd: ts,
          durationSeconds: breakDuration,
        });
        currentSession.breakSeconds += breakDuration;
        currentBreakStart = null;
      } else {
        // Add final available period
        const lastAvailableStart = getLastAvailableStart(currentSession);
        if (lastAvailableStart) {
          currentSession.availableSeconds += Math.floor(
            (ts.getTime() - lastAvailableStart.getTime()) / 1000
          );
        }
      }

      currentSession.logoutTime = ts;
      currentSession.sessionSeconds = Math.floor(
        (ts.getTime() - currentSession.loginTime.getTime()) / 1000
      );
      currentSession.isComplete = true;
      sessions.push(currentSession);
      currentSession = null;
      currentBreakStart = null;
    }
  }

  // Handle incomplete session still open
  if (currentSession) {
    const now = new Date();
    // Close open break for display purposes (don't finalize)
    if (currentBreakStart) {
      // We'll compute live break duration elsewhere
      currentSession.breakSeconds += Math.floor(
        (now.getTime() - currentBreakStart.getTime()) / 1000
      );
    } else {
      const lastAvailableStart = getLastAvailableStart(currentSession);
      if (lastAvailableStart) {
        currentSession.availableSeconds += Math.floor(
          (now.getTime() - lastAvailableStart.getTime()) / 1000
        );
      }
    }
    currentSession.sessionSeconds = Math.floor(
      (now.getTime() - currentSession.loginTime.getTime()) / 1000
    );
    currentSession.isComplete = false;
    sessions.push(currentSession);
  }

  return sessions;
}

function getLastAvailableStart(session: CalculatedSession): Date | null {
  if (session.breaks.length === 0) {
    return session.loginTime;
  }
  const lastBreak = session.breaks[session.breaks.length - 1];
  return lastBreak.breakEnd || null;
}

/**
 * Aggregate multiple sessions into daily stats.
 */
export function aggregateDailyStats(sessions: CalculatedSession[]): {
  availableSeconds: number;
  breakSeconds: number;
  sessionSeconds: number;
  breakCount: number;
  sessionCount: number;
  isIncomplete: boolean;
} {
  let availableSeconds = 0;
  let breakSeconds = 0;
  let sessionSeconds = 0;
  let breakCount = 0;
  let isIncomplete = false;

  for (const s of sessions) {
    availableSeconds += s.availableSeconds;
    breakSeconds += s.breakSeconds;
    sessionSeconds += s.sessionSeconds;
    breakCount += s.breaks.length;
    if (!s.isComplete) isIncomplete = true;
  }

  return {
    availableSeconds,
    breakSeconds,
    sessionSeconds,
    breakCount,
    sessionCount: sessions.length,
    isIncomplete,
  };
}

/**
 * Determine current status from events.
 */
export function getCurrentStatus(events: StatusEvent[]): {
  status: "logged_in" | "break" | "logged_out" | "not_logged_in";
  since: Date | null;
  sessionId?: number;
} {
  if (events.length === 0) {
    return { status: "not_logged_in", since: null };
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const last = sorted[sorted.length - 1];
  const ts = new Date(last.timestamp);

  if (last.status === "logged_out") {
    return { status: "logged_out", since: ts };
  }
  if (last.status === "logged_in" || last.status === "back") {
    return { status: "logged_in", since: ts };
  }
  if (last.status === "break") {
    return { status: "break", since: ts };
  }

  return { status: "not_logged_in", since: null };
}
