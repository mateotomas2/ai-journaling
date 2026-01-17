import express from 'express';
import cors from 'cors';
import { aiRouter } from './routes/ai';

// Security check: Prevent accidental production deployment
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: This server is not production-ready!');
  console.error('Missing: HTTPS, authentication, CORS restrictions, rate limiting');
  console.error('See README.md for security hardening requirements');
  process.exit(1);
}

const app = express();

// SECURITY WARNING: Wide-open CORS - localhost only!
// This accepts requests from ANY origin. Only safe because server binds to localhost.
// For production deployment, restrict CORS to specific domains.
app.use(cors());
app.use(express.json());
app.use('/api', aiRouter);

const PORT = process.env['PORT'] ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
