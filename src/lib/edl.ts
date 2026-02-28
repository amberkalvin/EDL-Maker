export interface EdlEntry {
    start: number;
    end: number;
    action: number;
}

export function parseTimeToSeconds(timeStr: string): number {
    const str = timeStr.trim();
    if (!str) return 0;

    if (str.includes(':')) {
        const parts = str.replace(',', '.').split(':');
        if (parts.length === 3) {
            const [h, m, s] = parts;
            return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
        } else if (parts.length === 2) {
            const [m, s] = parts;
            return parseInt(m, 10) * 60 + parseFloat(s);
        }
        return parseFloat(str);
    }

    return parseFloat(str);
}

export function mergeIntervals(intervals: [number, number][]): [number, number][] {
    if (intervals.length === 0) return [];

    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current);
        }
    }

    return merged;
}

export function subtractIntervals(
    targetIntervals: [number, number][],
    subtractIntervalsList: [number, number][]
): [number, number][] {
    const result: [number, number][] = [];

    for (const [tStart, tEnd] of targetIntervals) {
        let currentStart = tStart;

        for (const [sStart, sEnd] of subtractIntervalsList) {
            if (sEnd <= currentStart) continue;
            if (sStart >= tEnd) break;

            // Overlap found
            if (sStart > currentStart) {
                result.push([currentStart, sStart]);
            }
            currentStart = Math.max(currentStart, sEnd);
            if (currentStart >= tEnd) break;
        }

        if (currentStart < tEnd) {
            result.push([currentStart, tEnd]);
        }
    }

    return result;
}

export function resolveConflicts(entries: EdlEntry[]): EdlEntry[] {
    const cuts: [number, number][] = entries.filter(e => e.action === 0).map(e => [e.start, e.end]);
    const mutes: [number, number][] = entries.filter(e => e.action === 1).map(e => [e.start, e.end]);
    const others = entries.filter(e => e.action !== 0 && e.action !== 1);

    const mergedCuts = mergeIntervals(cuts);
    const mergedMutes = mergeIntervals(mutes);

    // Cuts override mutes, so we subtract cuts from mutes
    const resolvedMutes = subtractIntervals(mergedMutes, mergedCuts);

    const finalEntries: EdlEntry[] = [];

    mergedCuts.forEach(([start, end]) => {
        finalEntries.push({ start, end, action: 0 });
    });

    resolvedMutes.forEach(([start, end]) => {
        finalEntries.push({ start, end, action: 1 });
    });

    others.forEach(entry => {
        finalEntries.push(entry);
    });

    return finalEntries.sort((a, b) => a.start - b.start);
}

export function parseSrtForBadWords(srtContent: string, wordlist: string[]): EdlEntry[] {
    const entries: EdlEntry[] = [];
    if (!srtContent || wordlist.length === 0) return entries;

    // Basic SRT block regex: [index]\n[start] --> [end]\n[text]
    const pattern = /\d+\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n|$)/g;

    let match;
    while ((match = pattern.exec(srtContent)) !== null) {
        const [, startStr, endStr, text] = match;
        const cleanText = text.replace(/\r?\n/g, ' ').toLowerCase();

        const hasBadWord = wordlist.some(word => cleanText.includes(word.toLowerCase()));

        if (hasBadWord) {
            entries.push({
                start: parseTimeToSeconds(startStr),
                end: parseTimeToSeconds(endStr),
                action: 1 // Mute
            });
        }
    }

    return entries;
}

export function generateEdlString(entries: EdlEntry[]): string {
    return entries.map(e => `${e.start.toFixed(2)}  ${e.end.toFixed(2)}  ${e.action}`).join('\n');
}
