import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ok, err, type Result } from '@shared/types/result';

const CRASH_LOG_DIR = 'crash-logs';
const CRASH_LOG_FILE = 'crash-log.txt';

let writeQueue: Promise<void> = Promise.resolve();

function getCrashLogDirectory(): string | null {
	const base = FileSystem.documentDirectory;
	if (!base) {
		return null;
	}

	return `${base}${CRASH_LOG_DIR}/`;
}

export function getCrashLogPath(): string | null {
	const dir = getCrashLogDirectory();
	return dir ? `${dir}${CRASH_LOG_FILE}` : null;
}

function stringifyError(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();
	}

	if (typeof error === 'string') {
		return error;
	}

	try {
		return JSON.stringify(error, null, 2);
	} catch {
		return String(error);
	}
}

function formatEntry(message: string, details: Record<string, unknown>): string {
	const timestamp = new Date().toISOString();
	const lines = [
		'',
		'=== Crash Log Entry ===',
		`Timestamp: ${timestamp}`,
		`Platform: ${Platform.OS}`,
		`App Version: ${Constants.expoConfig?.version ?? 'unknown'}`,
		`Message: ${message}`,
		...Object.entries(details).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : stringifyError(value)}`),
		'======================',
	];

	return lines.join('\n') + '\n';
}

async function ensureDirectory(): Promise<string | null> {
	const path = getCrashLogDirectory();
	if (!path) {
		return null;
	}

	await FileSystem.makeDirectoryAsync(path, { intermediates: true }).catch(() => {});
	return path;
}

async function appendText(text: string): Promise<void> {
	const dir = await ensureDirectory();
	if (!dir) {
		return;
	}

	const filePath = `${dir}${CRASH_LOG_FILE}`;
	const existing = await FileSystem.readAsStringAsync(filePath).catch(() => '');
	await FileSystem.writeAsStringAsync(filePath, existing + text);
}

export async function recordCrashLog(
	message: string,
	details: Record<string, unknown> = {}
): Promise<void> {
	writeQueue = writeQueue
		.then(() => appendText(formatEntry(message, details)))
		.catch(() => {});

	await writeQueue;
}

export async function exportCrashLogToFolder(directoryUri: string): Promise<Result<string, Error>> {
	try {
		const internalPath = getCrashLogPath();
		if (!internalPath) {
			return err(new Error('Crash log storage is unavailable on this device'));
		}

		const content = await FileSystem.readAsStringAsync(internalPath).catch(() => '');
		if (!content.trim()) {
			return err(new Error('No crash log entries found yet'));
		}

		const fileUri = await StorageAccessFramework.createFileAsync(
			directoryUri,
			`kur-music-crash-log-${Date.now()}.txt`,
			'text/plain'
		);

		await FileSystem.writeAsStringAsync(fileUri, content, {
			encoding: FileSystem.EncodingType.UTF8,
		});

		return ok(fileUri);
	} catch (error) {
		return err(error instanceof Error ? error : new Error(String(error)));
	}
}
