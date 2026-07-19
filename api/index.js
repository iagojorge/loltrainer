// Entrada serverless do Vercel: reaproveita o app Express.
// Um app Express é um handler (req, res), então serve direto como função.
import app from '../server/src/app.js';

export default app;
