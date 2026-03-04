# NetPulse

Desktop app that monitors your Wi-Fi and internet quality in real time. It runs network tests on a schedule, scores your connection for different use cases, and can automatically apply fixes when things go wrong.

Built for diagnosing flaky Wi-Fi — especially on MacBooks where AirDrop, Bluetooth, and AWDL silently degrade your connection.

## What It Does

- **Scores your connection** for three scenarios: video streaming, online gaming, and video calls. Each score (0–100) is based on latency, jitter, packet loss, and throughput with weights tuned for that use case.

- **Runs network probes** automatically every hour (every 2 hours on battery). Measures ping, throughput (upload + download), and Wi-Fi signal details like RSSI, noise, channel, and AWDL status.

- **Shows a real-time dashboard** with score cards, 24-hour latency/jitter and throughput charts, and a health status badge (Healthy / Degraded / Critical).

- **Auto-applies fixes** with one click: flush DNS, switch to Cloudflare DNS (1.1.1.1), disable AWDL, optimize TCP settings, restart Wi-Fi, and more. Each fix shows whether it succeeded or failed.

- **AI-powered insights** — analyzes trends and detects root causes. Shows explanations like "AWDL was active during the 3pm degradation" in the AI Insights panel, with **one-click Apply buttons** for every recommended fix. Supports OpenAI-compatible APIs, Anthropic, and local Ollama.

- **Auto-discovers LLM backends** on startup — detects environment variables or a running Ollama instance so AI features work with zero setup. Manual configuration in Settings always takes priority.

- **Native notifications** when your connection degrades — so you know immediately without watching the dashboard.

## Installation

### From Source

Requires [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/alesanabriav7/netpulse.git
cd netpulse
npm install
npm run dev
```

### Build for Distribution

```bash
npm run dist
```

Produces a `.dmg` on macOS and `.exe` installer on Windows in the `dist/` folder.

## Usage

1. Launch the app. It immediately runs a network test and shows your scores.
2. Click **Run Test Now** to trigger a manual test at any time.
3. Check the **Latency & Jitter** and **Throughput** charts to see trends over the last 24 hours.
4. Open **Quick Fixes** and click **Apply** on any fix to improve your connection.
5. **AI analysis** works automatically if it finds a backend:
   - **Ollama** — install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.2`), and the app detects it on startup.
   - **API key** — set environment variables before launching:
     ```bash
     export LLM_API_KEY="your-api-key"
     export LLM_BASE_URL="https://api.openai.com/v1"  # optional, this is the default
     export LLM_MODEL="gpt-4o-mini"                    # optional, this is the default
     ```
   - **Manual** — open Settings and pick a provider (OpenAI, Anthropic, or Ollama).

   When the AI recommends a fix, click **Apply** directly from the insight — no need to find it in the Quick Fixes panel.

## Supported Platforms

| | macOS | Windows |
|---|---|---|
| Ping probe | Yes | Yes |
| Throughput probe | `networkQuality` (built-in) | `curl`-based speed test |
| Wi-Fi info | `system_profiler` (JSON) | `netsh wlan show interfaces` |
| AWDL detection | Yes | N/A (Apple-only) |
| All fixes | Yes | Yes (platform-specific commands) |

Some fixes require administrator privileges. On macOS you'll get a system password prompt. On Windows the app may need to run as Administrator.

## License

MIT License

Copyright (c) 2026 Alejandro Sanabria

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
