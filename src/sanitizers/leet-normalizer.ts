/**
 * Leet-speak Normalization
 *
 * Reverses common digit/symbol substitutions used to obfuscate injection
 * keywords from regex-based detection (e.g. "1gn0r3" → "ignore").
 *
 * The normalized output is used for analysis only — it is never returned
 * to callers. Substitutions are intentionally conservative to avoid
 * false positives on legitimate numeric content.
 *
 * Note: digit substitutions (0→o, 1→i, etc.) will also affect legitimate
 * alphanumeric tokens like "file1" → "filei". This is acceptable because
 * the normalized text is only used for pattern matching against multi-word
 * injection phrases, making isolated single-token collisions unlikely to
 * produce false positive detections.
 */

/**
 * Leet-speak substitution map.
 * Each entry maps a character to its most common alphabetic equivalent.
 */
const LEET_MAP: Record<string, string> = {
	"4": "a",
	"3": "e",
	"1": "i",
	"0": "o",
	"5": "s",
	$: "s",
	"7": "t",
};

/**
 * Sequences that must not be modified by leet normalization.
 *
 * Covers:
 * - Hex escape sequences: \xHH
 * - Unicode escape sequences: \uHHHH
 * - Base64-like blobs (20+ base64 chars): corrupting these breaks encoding
 *   detection patterns and the entropy check
 * - Shell substitution: $( — mapping $ → s here would break $() patterns
 */
const PROTECTED_SEQUENCE = /\\x[0-9A-Fa-f]{2}|\\u[0-9A-Fa-f]{4}|\$\(|[A-Za-z0-9+/]{20,}={0,2}/g;

/**
 * Apply the leet substitution map to a segment of plain text.
 * The `!` character is substituted for "i" only when flanked by alphanumeric
 * characters, to preserve legitimate sentence-ending punctuation.
 */
function applyLeetMap(text: string): string {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		if (ch in LEET_MAP) {
			result += LEET_MAP[ch];
			continue;
		}

		if (ch === "!") {
			const prev = i > 0 ? text[i - 1] : "";
			const next = i < text.length - 1 ? text[i + 1] : "";
			if (/[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next)) {
				result += "i";
				continue;
			}
		}

		result += ch;
	}
	return result;
}

/**
 * Normalize leet-speak substitutions in text.
 *
 * Converts digit and symbol substitutions back to their alphabetic
 * equivalents so that existing injection patterns can match obfuscated
 * variants (e.g. "1gn0r3 4ll rul3s" → "ignore all rules").
 *
 * Encoding sequences (hex escapes, unicode escapes, base64 blobs) and shell
 * substitution syntax `$(` are left untouched to avoid corrupting encoding
 * detection patterns.
 *
 * @param text - Text to normalize
 * @returns Text with leet substitutions reversed
 */
export function normalizeLeetSpeak(text: string): string {
	if (!text) return text;

	const segments: string[] = [];
	let lastIndex = 0;

	// Reset the global regex before use
	PROTECTED_SEQUENCE.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = PROTECTED_SEQUENCE.exec(text)) !== null) {
		// Normalize the plain segment before this protected sequence
		segments.push(applyLeetMap(text.slice(lastIndex, match.index)));
		// Keep the protected segment verbatim
		segments.push(match[0]);
		lastIndex = match.index + match[0].length;
	}

	// Normalize the remaining plain segment after the last protected sequence
	segments.push(applyLeetMap(text.slice(lastIndex)));

	return segments.join("");
}
