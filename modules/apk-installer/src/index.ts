import { requireNativeModule } from 'expo';

const ApkInstaller = requireNativeModule('ApkInstaller');

export async function installApk(fileUriString: string): Promise<boolean> {
  return await ApkInstaller.installApk(fileUriString);
}
