type ActiveRequest = Readonly<{
  requestId: string;
  pid: number;
}>;

const activeRequests = new Map<string, ActiveRequest>();

export const registerActiveRequest = (requestId: string, pid: number): void => {
  activeRequests.set(requestId, { requestId, pid });
};

export const unregisterActiveRequest = (requestId: string): void => {
  activeRequests.delete(requestId);
};

export const getActiveRequest = (requestId: string): ActiveRequest | undefined => {
  return activeRequests.get(requestId);
};
