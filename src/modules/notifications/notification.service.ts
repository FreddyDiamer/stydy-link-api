import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import {
  FRONTEND_PATHS,
  buildFrontendUrl,
} from '../../common/constants/frontend-paths';
import { TelegramBotService } from './telegram-bot.service';
import { BaseService } from '../../common';
import type {
  ServiceResponseCreatedPayload,
  ServiceResponseAcceptedPayload,
  ServiceResponseRejectedPayload,
  RequestResponseCreatedPayload,
  RequestResponseAcceptedPayload,
  RequestResponseRejectedPayload,
  DealCreatedPayload,
  DealAcceptedPayload,
  DealRejectedOrCancelledPayload,
  DealCompletedPayload,
  ReviewCreatedPayload,
  ReviewReplyPayload,
} from './notification.types';

@Injectable()
export class NotificationService extends BaseService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly telegramBot: TelegramBotService,
  ) {
    super();
  }

  private get baseUrl(): string {
    return this.config.get<string>('app.frontendBaseUrl') || '';
  }

  private async shouldNotify(
    userId: string,
    preferenceKey?: string,
  ): Promise<boolean> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        telegramNotificationsEnabled: true,
        notificationPreferences: true,
        telegramId: true,
      },
    });
    if (!user?.telegramId) return false;
    if (!user.telegramNotificationsEnabled) return false;
    if (preferenceKey && user.notificationPreferences != null) {
      const prefs = user.notificationPreferences as Record<string, boolean>;
      if (prefs[preferenceKey] === false) return false;
    }
    return true;
  }

  private buildButtons(
    buttons: { text: string; url: string }[],
  ): { text: string; url: string }[][] {
    return buttons.length ? [buttons] : [];
  }

  /** Fire-and-forget: run notification in background without blocking response */
  private fireAndForget(fn: () => Promise<void>): void {
    void Promise.resolve()
      .then(() => fn())
      .catch((err: unknown) =>
        this.logError(
          'Notification failed',
          err instanceof Error ? err : undefined,
        ),
      );
  }

  async notifyServiceResponseCreated(
    payload: ServiceResponseCreatedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onResponse')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      const priceStr =
        payload.price != null ? formatPrice(payload.price) : null;
      const deadlineStr = payload.proposedDeadline
        ? formatDate(payload.proposedDeadline)
        : null;
      const msgPreview = payload.message
        ? previewText(payload.message, 120)
        : null;
      let text = `📩 <b>Новый отклик на вашу услугу</b>\n\n`;
      text += `👤 Студент: <b>${escapeHtml(payload.actorName)}</b>\n`;
      text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (priceStr) text += `💰 Предложенная цена: ${priceStr}\n`;
      if (deadlineStr) text += `📅 Предложенный срок: ${deadlineStr}\n`;
      if (msgPreview && msgPreview !== '—')
        text += `\n💬 Сообщение:\n${escapeHtml(msgPreview)}\n`;
      text += `\nОткройте отклики и примите или отклоните отклик. 👇`;
      const url = this.baseUrl
        ? buildFrontendUrl(
            this.baseUrl,
            FRONTEND_PATHS.TUTOR_SERVICE_RESPONSES,
            {
              id: payload.serviceId,
            },
          )
        : '';
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const keyboard = this.buildButtons(
        [
          profileUrl && { text: '👤 Профиль студента', url: profileUrl },
          url && { text: '📋 К откликам', url },
        ].filter(Boolean) as { text: string; url: string }[],
      );
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: keyboard,
      });
    });
  }

  async notifyServiceResponseAccepted(
    payload: ServiceResponseAcceptedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onResponse')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `✅ <b>Репетитор принял ваш отклик!</b>\n\n`;
      text += `👤 Репетитор: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (payload.price != null)
        text += `💰 Сумма: ${formatPrice(payload.price)}\n`;
      text += `\nМожно перейти к сделке или в список заказов. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toOrders = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_ORDERS, {})
        : '';
      const toDeal =
        this.baseUrl && payload.dealId
          ? buildFrontendUrl(
              this.baseUrl,
              FRONTEND_PATHS.STUDENT_DEAL_DETAILS,
              {
                id: payload.dealId,
              },
            )
          : '';
      const buttons = [
        profileUrl && { text: '👤 Профиль репетитора', url: profileUrl },
        toDeal && { text: '📋 К сделке', url: toDeal },
        toOrders && !toDeal && { text: '📋 К заказам', url: toOrders },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyServiceResponseRejected(
    payload: ServiceResponseRejectedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onResponse')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `❌ <b>Репетитор отклонил ваш отклик</b>\n\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `\nВы можете посмотреть другие заказы или оставить новый отклик. 👇`;
      const url = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_ORDERS, {})
        : '';
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: url
          ? this.buildButtons([{ text: '📋 К заказам', url }])
          : [],
      });
    });
  }

  async notifyRequestResponseCreated(
    payload: RequestResponseCreatedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onResponse')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      const priceStr =
        payload.price != null ? formatPrice(payload.price) : null;
      const deadlineStr = payload.proposedDeadline
        ? formatDate(payload.proposedDeadline)
        : null;
      const msgPreview = payload.message
        ? previewText(payload.message, 120)
        : null;
      let text = `📩 <b>Репетитор откликнулся на вашу заявку</b>\n\n`;
      text += `👤 Репетитор: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (priceStr) text += `💰 Предложенная цена: ${priceStr}\n`;
      if (deadlineStr) text += `📅 Предложенный срок: ${deadlineStr}\n`;
      if (msgPreview && msgPreview !== '—')
        text += `\n💬 Сообщение:\n${escapeHtml(msgPreview)}\n`;
      text += `\nПримите или отклоните отклик в разделе заявок. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toOrders = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_ORDERS, {})
        : '';
      const buttons = [
        profileUrl && { text: '👤 Профиль репетитора', url: profileUrl },
        toOrders && { text: '📋 К заявкам', url: toOrders },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyRequestResponseAccepted(
    payload: RequestResponseAcceptedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onDeal'))) return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `✅ <b>Студент принял ваш отклик!</b>\n\n`;
      text += `Создана новая сделка.\n\n`;
      text += `👤 Студент: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (payload.price != null)
        text += `💰 Сумма: ${formatPrice(payload.price)}\n`;
      text += `\nПерейдите к сделке, чтобы подтвердить или начать занятие. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toDeal = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const buttons = [
        profileUrl && { text: '👤 Профиль студента', url: profileUrl },
        toDeal && { text: '📋 К сделке', url: toDeal },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyRequestResponseRejected(
    payload: RequestResponseRejectedPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onResponse')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `❌ <b>Студент отклонил ваш отклик</b>\n\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `\nПосмотрите другие заявки или дождитесь новых. 👇`;
      const url = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_ORDERS, {})
        : '';
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: url
          ? this.buildButtons([{ text: '📋 К заявкам', url }])
          : [],
      });
    });
  }

  async notifyDealCreated(payload: DealCreatedPayload): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onDeal'))) return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      const priceStr =
        payload.price != null ? formatPrice(payload.price) : null;
      const deadlineStr = payload.deadline
        ? formatDate(payload.deadline)
        : null;
      let text = `📋 <b>Новая сделка создана</b>\n\n`;
      text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `👤 Участник: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (priceStr) text += `💰 Сумма: ${priceStr}\n`;
      if (deadlineStr) text += `📅 Срок: ${deadlineStr}\n`;
      text += `\nПодтвердите сделку или перейдите к деталям. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const buttons = [
        profileUrl && { text: '👤 Профиль', url: profileUrl },
        (toDealStudent || toDealTutor) && {
          text: '📋 К сделке',
          url: toDealStudent || toDealTutor,
        },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyDealAccepted(payload: DealAcceptedPayload): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onDeal'))) return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `✅ <b>Сделку приняли!</b>\n\n`;
      text += `👤 Участник: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (payload.price != null)
        text += `💰 Сумма: ${formatPrice(payload.price)}\n`;
      text += `\nМожно перейти к сделке и начать занятие. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const buttons = [
        profileUrl && { text: '👤 Профиль', url: profileUrl },
        (toDealStudent || toDealTutor) && {
          text: '📋 К сделке',
          url: toDealStudent || toDealTutor,
        },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyDealRejectedOrCancelled(
    payload: DealRejectedOrCancelledPayload,
  ): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onDeal'))) return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `❌ <b>Сделка отменена</b>\n\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `\nПодробности можно посмотреть в списке сделок. 👇`;
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const url = toDealStudent || toDealTutor;
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: url
          ? this.buildButtons([{ text: '📋 К сделке', url }])
          : [],
      });
    });
  }

  async notifyDealCompleted(payload: DealCompletedPayload): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onDeal'))) return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `🎉 <b>Сделка завершена!</b>\n\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `\nСпасибо за сотрудничество! Можете оставить отзыв в деталях сделки. ❤️\n\n`;
      text += `👇`;
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const url = toDealStudent || toDealTutor;
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: url
          ? this.buildButtons([{ text: '📋 К сделке и отзыву', url }])
          : [],
      });
    });
  }

  async notifyReviewCreated(payload: ReviewCreatedPayload): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onReview')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      const stars = payload.rating != null ? '⭐'.repeat(payload.rating) : '';
      const commentPreview = payload.comment
        ? previewText(payload.comment, 150)
        : null;
      let text = `⭐ <b>Вам оставили отзыв</b>\n\n`;
      text += `👤 Автор: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      if (stars) text += `\n${stars} (${payload.rating}/5)\n`;
      if (commentPreview && commentPreview !== '—')
        text += `\n💬 Текст отзыва:\n${escapeHtml(commentPreview)}\n`;
      text += `\nМожете ответить на отзыв в деталях сделки. 👇`;
      const profileUrl = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.USER_PROFILE, {
            id: payload.actorUserId,
          })
        : '';
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDeal = toDealTutor || toDealStudent;
      const buttons = [
        profileUrl && { text: '👤 Профиль автора', url: profileUrl },
        toDeal && { text: '⭐ К отзыву', url: toDeal },
      ].filter(Boolean) as { text: string; url: string }[];
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: this.buildButtons(buttons),
      });
    });
  }

  async notifyReviewReply(payload: ReviewReplyPayload): Promise<void> {
    await Promise.resolve();
    this.fireAndForget(async () => {
      if (!(await this.shouldNotify(payload.recipientUserId, 'onReview')))
        return;
      const user = await this.db.user.findUnique({
        where: { id: payload.recipientUserId },
        select: { telegramId: true },
      });
      if (!user?.telegramId) return;

      let text = `💬 <b>Ответ на ваш отзыв</b>\n\n`;
      text += `👤 Ответил: <b>${escapeHtml(payload.actorName)}</b>\n`;
      if (payload.subjectName)
        text += `📚 Предмет: ${escapeHtml(payload.subjectName)}\n`;
      text += `\nПосмотреть ответ можно в деталях сделки. 👇`;
      const toDealTutor = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.TUTOR_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const toDealStudent = this.baseUrl
        ? buildFrontendUrl(this.baseUrl, FRONTEND_PATHS.STUDENT_DEAL_DETAILS, {
            id: payload.dealId,
          })
        : '';
      const url = toDealTutor || toDealStudent;
      await this.telegramBot.sendMessage(user.telegramId, text, {
        inlineKeyboard: url
          ? this.buildButtons([{ text: '⭐ К отзыву', url }])
          : [],
      });
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format price in kopecks to rubles string */
function formatPrice(kopeks: number | null | undefined): string {
  if (kopeks == null) return '—';
  return `${(kopeks / 100).toLocaleString('ru-RU')} ₽`;
}

/** Format date for display */
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Truncate long text for preview */
function previewText(s: string | null | undefined, maxLen: number): string {
  if (!s || !s.trim()) return '—';
  const t = s.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + '…';
}
