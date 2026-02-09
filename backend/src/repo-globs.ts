export function parseRepoGlobsDecodedJson(decodedJson: string): string[] {
  try {
    const decoded = JSON.parse(decodedJson);
    if (!Array.isArray(decoded)) return [];
    const field =
      decoded.find((d: any) => d.name === 'repoGlobs') ||
      decoded.find((d: any) => d.name === 'pattern');
    const value = field?.value?.value;
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map((g: string) => g.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
