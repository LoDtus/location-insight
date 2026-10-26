export function isTestRuntime(): boolean {
  return process.env.VITEST === 'true';
}

export function isHealthUrl(url: string): boolean {
  const path = url.split('?')[0] ?? '';
  return path.includes('/health');
}
