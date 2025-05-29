# SocialSync Backend

This backend is organized by social media platform, with each platform as an independent service using the most suitable technology:

- **facebook/**: Python (API integration, AI/ML)
- **whatsapp/**: TypeScript/Node.js (using whatsapp-web.js)
- **common/**: Shared utilities, models, or configuration
- **gateway/**: Go (API gateway to control and route requests to all services)

Add new platforms (e.g., instagram, twitter, linkedin) as new folders/services in the future.
