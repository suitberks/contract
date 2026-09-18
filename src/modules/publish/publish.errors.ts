/** Maps registry client output into a user-friendly publish failure message. */
export function getPublishFailureMessage(output: string): string {
  const normalizedOutput = output.toLowerCase();
  const details = output.trim().split('\n').slice(0, 3).join('\n');

  if (
    normalizedOutput.includes('eneedauth') ||
    normalizedOutput.includes('e401') ||
    normalizedOutput.includes('403') ||
    normalizedOutput.includes('auth')
  ) {
    return `Registry auth/permission error. Check token and package access.\n${details}`;
  }

  if (normalizedOutput.includes('registry')) {
    return `Package registry error. Verify the configured registry URL.\n${details}`;
  }

  return `Package publish failed.\n${details}`;
}
