/** Recipient user id (DB), actor = the other party (e.g. tutor who responded), entity = deal/response/review */
export interface BaseNotificationPayload {
  recipientUserId: string;
  actorName: string;
  actorUserId: string;
}

export interface ServiceResponseCreatedPayload extends BaseNotificationPayload {
  subjectName: string;
  studentId: string;
  serviceId: string;
  responseId: string;
  /** Proposed price in kopecks (optional) */
  price?: number | null;
  /** Message from student (optional) */
  message?: string | null;
  /** Proposed deadline (optional) */
  proposedDeadline?: Date | string | null;
}

export interface ServiceResponseAcceptedPayload
  extends BaseNotificationPayload {
  responseId: string;
  serviceId: string;
  dealId?: string;
  subjectName?: string;
  price?: number;
}

export interface ServiceResponseRejectedPayload
  extends BaseNotificationPayload {
  responseId: string;
  subjectName?: string;
}

export interface RequestResponseCreatedPayload extends BaseNotificationPayload {
  requestId: string;
  responseId: string;
  subjectName?: string;
  price?: number | null;
  message?: string | null;
  proposedDeadline?: Date | string | null;
}

export interface RequestResponseAcceptedPayload
  extends BaseNotificationPayload {
  responseId: string;
  dealId: string;
  subjectName?: string;
  price?: number;
}

export interface RequestResponseRejectedPayload
  extends BaseNotificationPayload {
  responseId: string;
  subjectName?: string;
}

export interface DealCreatedPayload extends BaseNotificationPayload {
  dealId: string;
  subjectName: string;
  price?: number;
  deadline?: Date | string | null;
}

export interface DealAcceptedPayload extends BaseNotificationPayload {
  dealId: string;
  subjectName?: string;
  price?: number;
}

export interface DealRejectedOrCancelledPayload
  extends BaseNotificationPayload {
  dealId: string;
  subjectName?: string;
}

export interface DealCompletedPayload extends BaseNotificationPayload {
  dealId: string;
  subjectName?: string;
}

export interface ReviewCreatedPayload extends BaseNotificationPayload {
  reviewId: string;
  dealId: string;
  subjectName?: string;
  rating?: number;
  comment?: string | null;
}

export interface ReviewReplyPayload extends BaseNotificationPayload {
  reviewId: string;
  dealId: string;
  subjectName?: string;
}
