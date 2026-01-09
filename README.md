# NEXUS - Hand Gesture Control Interface

A sci-fi themed, real-time hand gesture tracking dashboard built with MediaPipe and vanilla JavaScript.

![Dashboard Preview](docs/preview.png)

## Features

- **Real-time Hand Tracking**: Uses MediaPipe Hands for accurate 21-landmark hand detection
- **Gesture Recognition**: Detects common gestures (open palm, fist, peace, pointing, thumbs up, rock on, etc.)
- **Dual Hand Support**: Tracks both hands simultaneously with distinct color coding (cyan for left, magenta for right)
- **Sci-Fi Bento Box UI**: Beautiful dashboard layout with multiple information panels:
  - Live camera feed with hand skeleton overlay
  - Gesture detection with confidence meter
  - Skeletal map visualization
  - Finger status indicators (digit-by-digit tracking)
  - Spatial coordinates (palm center, index tip, hand rotation)
  - Motion trail visualization
  - Gesture history log
  - Real-time performance metrics (detection rate, stability, accuracy)

## Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Hand Tracking**: [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html)
- **Fonts**: Orbitron, Rajdhani, Share Tech Mono (Google Fonts)
- **No Build Tools Required**: Runs directly in the browser

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/gaiar/gesture-dashboard.git
cd gesture-dashboard

# Start a local server (Python)
python3 -m http.server 8080

# Or use any static file server
npx serve .
```

Then open http://localhost:8080 in your browser.

### Docker

```bash
# Pull and run from GitHub Container Registry
docker pull ghcr.io/gaiar/gesture-dashboard:latest
docker run -p 8080:80 ghcr.io/gaiar/gesture-dashboard:latest
```

## Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Edge, Safari)
- Camera access permission required
- HTTPS required for camera access in production (localhost works without HTTPS)

## Detected Gestures

| Gesture | Fingers | Emoji |
|---------|---------|-------|
| Open Palm | All extended | ✋ |
| Fist | All closed | ✊ |
| Pointing | Index only | ☝️ |
| Peace | Index + Middle | ✌️ |
| Thumbs Up | Thumb only | 👍 |
| Rock On | Index + Pinky | 🤘 |
| Three | Index + Middle + Ring | 🖖 |
| Four | All except thumb | 🖖 |
| OK Sign | Thumb + Middle + Ring + Pinky | 👌 |
| Call Me | Thumb + Pinky | 🤙 |

## Project Structure

```
gesture-dashboard/
├── index.html      # Main HTML structure
├── styles.css      # Sci-fi themed styles
├── app.js          # Hand tracking and UI logic
├── Dockerfile      # Container configuration
├── docker-compose.yml
└── README.md
```

## How It Works

1. **Camera Access**: The app requests camera permission and streams video
2. **MediaPipe Processing**: Each frame is sent to MediaPipe Hands for landmark detection
3. **Gesture Analysis**: Finger extension states are analyzed to identify gestures
4. **Visualization**: Hand skeleton, landmarks, and UI elements are rendered in real-time

## Performance

- Targets 30 FPS on modern hardware
- Uses Web Workers via MediaPipe for non-blocking processing
- Optimized canvas rendering with gradient caching

## License

MIT License - feel free to use this for your own projects!

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) by Google for the hand tracking model
- Inspired by sci-fi interfaces from movies and games
