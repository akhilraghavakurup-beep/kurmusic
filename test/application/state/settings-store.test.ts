import { describe, expect, it } from 'vitest';
import {
	getHomeContentLanguageCookie,
	getHomeContentLanguageHeader,
	normalizeHomeContentPreferences,
} from '@application/state/settings-store';

describe('home content preferences', () => {
	it('falls back to Malayalam and Tamil for invalid or empty settings', () => {
		expect(normalizeHomeContentPreferences(null)).toEqual(['Malayalam', 'Tamil']);
		expect(normalizeHomeContentPreferences(['Unknown'])).toEqual(['Malayalam', 'Tamil']);
	});

	it('ignores legacy Bollywood while keeping explicit Hindi selections', () => {
		expect(normalizeHomeContentPreferences(['Bollywood', 'Tamil', 'Hindi'])).toEqual([
			'Tamil',
			'Hindi',
		]);
	});

	it('builds the JioSaavn language cookie from selected languages', () => {
		const preferences = ['Hindi', 'Malayalam', 'Tamil'];

		expect(getHomeContentLanguageHeader(preferences)).toBe('hindi,malayalam,tamil');
		expect(getHomeContentLanguageCookie(preferences)).toBe('L=hindi%2Cmalayalam%2Ctamil');
	});
});
