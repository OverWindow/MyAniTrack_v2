import { Router } from 'express';
import { getMaintenanceSettingsController } from '../controllers/maintenance.controller';

const router = Router();

router.get('/maintenance', getMaintenanceSettingsController);

export default router;
