import { Request, Response } from 'express';
import { AnimeTitleLanguage } from '../services/anime.service';
import {
  getVoiceActorDetail,
  validateVoiceActorDetailId,
  validateVoiceActorDetailLimit,
} from '../services/voice-actor-detail.service';

const TITLE_LANGUAGE_OPTIONS: AnimeTitleLanguage[] = ['ko', 'en', 'ja'];

function parseTitleLanguage(value: unknown): AnimeTitleLanguage {
  const titleLanguage = typeof value === 'string' ? value : 'ko';

  if (!TITLE_LANGUAGE_OPTIONS.includes(titleLanguage as AnimeTitleLanguage)) {
    throw new Error('titleLanguage must be one of ko, en, ja');
  }

  return titleLanguage as AnimeTitleLanguage;
}

function getErrorStatus(message: string) {
  if (message.includes('must be') || message === 'Invalid cursor') {
    return 400;
  }

  if (message === 'Voice actor not found') {
    return 404;
  }

  return 500;
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = getErrorStatus(message);

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

export async function getVoiceActorDetailController(req: Request, res: Response) {
  try {
    const item = await getVoiceActorDetail({
      voiceActorId: validateVoiceActorDetailId(req.params.voiceActorId),
      titleLanguage: parseTitleLanguage(req.query.titleLanguage),
      limit: validateVoiceActorDetailLimit(req.query.limit),
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
