import express, { Router } from 'express';
import { parseRofl, buildPreview, importRoflFromBuffer } from '../services/rofl.js';

const router = Router();
const raw = express.raw({ type: '*/*', limit: '120mb' });

// Preview do .rofl (corpo cru) — só faz parse, NÃO guarda o arquivo. O cliente
// mantém o arquivo e reenvia no confirm (stateless, compatível com serverless).
router.post('/rofl/preview', raw, (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ ok: false, reason: 'Nenhum arquivo recebido.' });
  }
  try {
    res.json({ ok: true, preview: buildPreview(parseRofl(buf)) });
  } catch (err) {
    res.status(400).json({ ok: false, reason: String(err?.message || err) });
  }
});

// Confirma a importação: reenvia o .rofl (corpo cru) + metadados na query string.
router.post('/rofl/confirm', raw, async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ ok: false, reason: 'Nenhum arquivo recebido (reenvie o .rofl).' });
  }
  const { ourSide, opponent, series_type, series_label, date } = req.query || {};
  const result = await importRoflFromBuffer(req.userId, buf, { ourSide, opponent, series_type, series_label, date });
  res.status(result.ok ? 201 : 400).json(result);
});

export default router;
