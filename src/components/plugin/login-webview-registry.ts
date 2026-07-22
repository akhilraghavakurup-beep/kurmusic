import type { ComponentType } from 'react';

export interface LoginWebViewProps {
	readonly onSuccess: (credential: string) => void;
	readonly onCancel: () => void;
}

type LoginWebViewComponent = ComponentType<LoginWebViewProps>;

const LOGIN_WEBVIEWS: Record<string, LoginWebViewComponent> = {};

export function getLoginWebView(pluginId: string): LoginWebViewComponent | undefined {
	return LOGIN_WEBVIEWS[pluginId];
}
