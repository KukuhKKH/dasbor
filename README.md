# Dashboard Server

Modern server monitoring dashboard built with Nuxt 3, Vue 3, TailwindCSS, and Dockerode.

## Features

- **Real-time Monitoring**: CPU, RAM, Disk, and Network traffic with historical charts.
- **Docker Management**: View running containers, stats (CPU/RAM), and perform actions (Start/Stop/Restart).
- **Security**: Password-protected Docker actions.
- **Music Player**: Built-in music player widget (connects to external Music API).
- **Responsive UI**: Beautiful dark/light mode interface derived from Shadcn UI.

## Requirements

- Node.js 18+ (22+ recommended)
- pnpm
- Docker (for container stats)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/KukuhKKH/dasbor.git
   cd dasbor
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   # Music API (Optional)
   MUSIC_API_BASE=https://api-music.banglipai.tech
   MUSIC_API_PLACEHOLDER_URL=https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff

   # Docker Security (Required for actions)
   DOCKER_CONTROL_PASSWORD=0213sUOwItqNkfdd
   
   # Server Port
   DEV_PORT=3000
   DEV_HOST=dashboard.test
   ```

## Development

Start the development server:
```bash
pnpm dev --host
```
Access the dashboard at `https://dashboard.test:3000`.

## Production Build

Build for production:
```bash
pnpm build
```

Run the built application:
```bash
node .output/server/index.mjs
```

## License

MIT
