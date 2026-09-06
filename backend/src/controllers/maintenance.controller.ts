import type { Request, Response } from 'express';
import {
  getMaintenanceSettings,
  MaintenanceValidationError,
  updateMaintenanceSettings,
  validateMaintenanceSettingsUpdate,
} from '../services/maintenance.service';

export async function getMaintenanceSettingsController(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const item = await getMaintenanceSettings();

    return res.json({ success: true, item });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function updateMaintenanceSettingsController(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!req.authUser) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = validateMaintenanceSettingsUpdate(req.body);
    const item = await updateMaintenanceSettings(req.authUser.userId, payload);

    return res.json({
      success: true,
      message: payload.enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      item,
    });
  } catch (error) {
    const statusCode = error instanceof MaintenanceValidationError ? 400 : 500;

    if (statusCode === 500) {
      console.error(error);
    }

    return res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
