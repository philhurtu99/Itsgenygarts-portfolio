import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { CUSTOMS_PROFILES } from '../../utils/customsProfiles.js';

const router = Router();
router.use(requireAdmin);
router.get('/', (req, res) => res.json({ success: true, data: CUSTOMS_PROFILES }));
export default router;
