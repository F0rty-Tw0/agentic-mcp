export const toRequestIdString = (requestId?: string | number): string | undefined => {
  if (!requestId) return;

  return String(requestId);
};
