// Helpers for formatting audio sizes and durations

export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates recording name based on username, date, and existing recordings:
 * Format: username-YYYY-MM-DD
 * If more than one exists for that user on that day: username-YYYY-MM-DD (1), (2), etc.
 */
export function generateDefaultRecordingName(username, existingRecordings) {
  const dateStr = getTodayDateString();
  const baseName = `${username.trim().toLowerCase()}-${dateStr}`;

  // Find all recordings created today by this username that follow baseName pattern
  const matches = existingRecordings.filter(rec => {
    const title = (rec.name || '').toLowerCase();
    return title.startsWith(baseName);
  });

  if (matches.length === 0) {
    return baseName;
  }

  // Find highest counter
  let maxCount = 0;
  matches.forEach(rec => {
    const title = (rec.name || '').trim();
    if (title.toLowerCase() === baseName) {
      maxCount = Math.max(maxCount, 0);
    } else {
      const match = title.match(/\((\d+)\)$/);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count)) {
          maxCount = Math.max(maxCount, count);
        }
      }
    }
  });

  return `${baseName} (${maxCount + 1})`;
}
