export type ProgressNotificationParams = Readonly<{
  message: string;
}>;

export type ProgressNotification = Readonly<{
  method: string;
  params: ProgressNotificationParams;
}>;
