export type ProgressNotificationParams = {
  readonly message: string;
};

export type ProgressNotification = {
  readonly method: string;
  readonly params: ProgressNotificationParams;
};
