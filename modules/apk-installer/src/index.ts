import { requireNativeModule } from 'expo';

const ApkInstaller = requireNativeModule('ApkInstaller');

export async function installApk(fileUriString: string): Promise<boolean> {
	return await ApkInstaller.installApk(fileUriString);
}

export async function canInstallApk(): Promise<boolean> {
	return await ApkInstaller.canInstallApk();
}

export async function openUnknownAppSourcesSettings(): Promise<boolean> {
	return await ApkInstaller.openUnknownAppSourcesSettings();
}

