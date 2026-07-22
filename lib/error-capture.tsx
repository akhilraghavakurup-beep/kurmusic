import React, { Component, type ReactNode, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PlayerAwareScrollView } from '@/src/components/ui/player-aware-scroll-view';
import { permissionService } from '@/src/application/services/permission-service';
import { recordCrashLog } from '@/src/shared/services/crash-log';
import { exportCrashLogToFolder } from '@/src/shared/services/crash-log';

const ERROR_TAG = '[ErrorCapture]';

type ErrorHandler = (error: Error, isFatal?: boolean) => void;
interface ErrorUtilsType {
	getGlobalHandler: () => ErrorHandler;
	setGlobalHandler: (handler: ErrorHandler) => void;
}

declare const global: {
	ErrorUtils?: ErrorUtilsType;
};

interface ErrorInfo {
	componentStack: string;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
	exportingLog: boolean;
	exportError: string | null;
	exportSuccess: string | null;
}

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			exportingLog: false,
			exportError: null,
			exportSuccess: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error(ERROR_TAG, 'React Error Boundary caught error:');
		console.error(ERROR_TAG, 'Error:', error.message);
		console.error(ERROR_TAG, 'Stack:', error.stack);
		console.error(ERROR_TAG, 'Component Stack:', errorInfo.componentStack);
		void recordCrashLog('React Error Boundary caught error', {
			message: error.message,
			stack: error.stack ?? '',
			componentStack: errorInfo.componentStack,
		});

		this.setState({ errorInfo });
	}

	_handleReset = (): void => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
			exportingLog: false,
			exportError: null,
			exportSuccess: null,
		});
	};

	_handleExportLog = async (): Promise<void> => {
		this.setState({ exportingLog: true, exportError: null, exportSuccess: null });

		try {
			const directoryResult = await permissionService.requestDirectoryPermission();
			if (!directoryResult.success) {
				this.setState({
					exportingLog: false,
					exportError: directoryResult.error.message,
				});
				return;
			}

			const exportResult = await exportCrashLogToFolder(directoryResult.data.uri);
			if (!exportResult.success) {
				this.setState({
					exportingLog: false,
					exportError: exportResult.error.message,
				});
				return;
			}

			this.setState({
				exportingLog: false,
				exportSuccess: 'Crash log exported successfully.',
			});
		} catch (error) {
			this.setState({
				exportingLog: false,
				exportError: error instanceof Error ? error.message : String(error),
			});
		}
	};

	render(): ReactNode {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<View style={styles.container}>
					<View style={styles.header}>
						<Text style={styles.title}>Something went wrong</Text>
						<View style={styles.headerActions}>
							<Pressable onPress={this._handleExportLog} style={styles.secondaryButton}>
								<Text style={styles.resetButtonText}>
									{this.state.exportingLog ? 'Exporting...' : 'Export Log'}
								</Text>
							</Pressable>
							<Pressable onPress={this._handleReset} style={styles.resetButton}>
								<Text style={styles.resetButtonText}>Try Again</Text>
							</Pressable>
						</View>
					</View>
					{this.state.exportSuccess && (
						<Text style={styles.successMessage}>{this.state.exportSuccess}</Text>
					)}
					{this.state.exportError && (
						<Text style={styles.errorMessage}>{this.state.exportError}</Text>
					)}
					<PlayerAwareScrollView style={styles.scrollView}>
						<Text style={styles.errorName}>{this.state.error?.name}</Text>
						<Text style={styles.errorMessage}>{this.state.error?.message}</Text>
						{this.state.error?.stack && (
							<>
								<Text style={styles.sectionTitle}>Stack Trace:</Text>
								<Text style={styles.stackTrace}>{this.state.error.stack}</Text>
							</>
						)}
						{this.state.errorInfo?.componentStack && (
							<>
								<Text style={styles.sectionTitle}>Component Stack:</Text>
								<Text style={styles.stackTrace}>
									{this.state.errorInfo.componentStack}
								</Text>
							</>
						)}
					</PlayerAwareScrollView>
				</View>
			);
		}

		return this.props.children;
	}
}

export function useGlobalErrorHandlers(): void {
	useEffect(() => {
		const errorUtils = global.ErrorUtils;

		if (!errorUtils) {
			return;
		}

		const originalHandler = errorUtils.getGlobalHandler();

		errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
			console.error(ERROR_TAG, '=== UNHANDLED JS ERROR ===');
			console.error(ERROR_TAG, 'Fatal:', isFatal);
			console.error(ERROR_TAG, 'Error:', error.message);
			console.error(ERROR_TAG, 'Stack:', error.stack);
			console.error(ERROR_TAG, '==========================');
			void recordCrashLog('Unhandled JS error', {
				fatal: String(Boolean(isFatal)),
				message: error.message,
				stack: error.stack ?? '',
			});

			if (originalHandler) {
				originalHandler(error, isFatal);
			}
		});

		return () => {
			errorUtils.setGlobalHandler(originalHandler);
		};
	}, []);
}

export function withErrorLogging<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	context: string
): (...args: T) => Promise<R> {
	return async (...args: T): Promise<R> => {
		try {
			return await fn(...args);
		} catch (error) {
			console.error(ERROR_TAG, `Error in ${context}:`);
			if (error instanceof Error) {
				console.error(ERROR_TAG, 'Message:', error.message);
				console.error(ERROR_TAG, 'Stack:', error.stack);
				void recordCrashLog(`Error in ${context}`, {
					message: error.message,
					stack: error.stack ?? '',
				});
			} else {
				console.error(ERROR_TAG, 'Error:', error);
				void recordCrashLog(`Error in ${context}`, {
					error: String(error),
				});
			}
			throw error;
		}
	};
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1a1a1a',
		padding: 16,
		paddingTop: 60,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	headerActions: {
		flexDirection: 'row',
		gap: 8,
	},
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#ff6b6b',
	},
	secondaryButton: {
		backgroundColor: '#444',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
	},
	resetButton: {
		backgroundColor: '#333',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
	},
	resetButtonText: {
		color: '#fff',
		fontWeight: '600',
	},
	scrollView: {
		flex: 1,
		borderRadius: 12,
		overflow: 'hidden',
	},
	errorName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#ff9999',
		marginBottom: 4,
	},
	errorMessage: {
		fontSize: 14,
		color: '#fff',
		marginBottom: 16,
	},
	successMessage: {
		fontSize: 14,
		color: '#8ef0a0',
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#888',
		marginTop: 12,
		marginBottom: 4,
	},
	stackTrace: {
		fontSize: 11,
		color: '#aaa',
		fontFamily: 'monospace',
	},
});
