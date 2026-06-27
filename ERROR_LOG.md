# ERROR_LOG

| ID | Symptom | Root Cause | Fix | Prevention Rule | Date |
|----|---------|------------|-----|-----------------|------|
| ERR-001 | Providers: Vobiz initialization failed (fetch failed) | Trailing slash in Account healthcheck URL triggered 307 redirect to private DNS account-service.vobiz.ai | Removed trailing slash from Account API healthcheck URL | Test API endpoints for redirection behavior when using trailing slashes | 2026-06-25 |
| ERR-002 | Provider socket closed after 2s / decoding error | Vobiz sends 8kHz mu-law audio but the server claimed it was PCM16 without doing any conversion | Implemented G.711 mu-law decoding/encoding and linear interpolation resampling to match provider specs | Validate audio format and sample rate compatibility across telephone and AI provider boundaries | 2026-06-27 |

