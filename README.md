# Scoop AI Streaming Frontend

React-based chat interface for Scoop.ge AI assistant featuring real-time Gemini thinking visualization and product recommendations.

## Features

- 🧠 **Real-time Thinking Display** - Shows AI reasoning process as it happens
- 💬 **SSE Streaming** - True real-time message streaming
- 🛍️ **Product Cards** - Beautiful product recommendation cards
- 📱 **Responsive Design** - Works on desktop and mobile
- 🇬🇪 **Georgian UI** - Full Georgian language interface

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** CSS Modules
- **Markdown:** react-markdown
- **API:** SSE (Server-Sent Events)

## Quick Start

```bash
# Install dependencies
npm install

# Set API endpoint
export VITE_API_URL="http://localhost:8080"

# Run development server
npm run dev
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Chat.tsx              # Main chat component
│   │   ├── ChatInput.tsx         # Message input
│   │   ├── ChatResponse.tsx      # Message rendering
│   │   ├── ThinkingStepsLoader.tsx # AI thinking display
│   │   └── ProductCard.tsx       # Product recommendation cards
│   ├── hooks/
│   │   └── useChat.ts            # Chat state management
│   └── styles/
│       └── *.css                 # Component styles
└── vite.config.ts
```

## SSE Event Types

| Event Type | Description |
|------------|-------------|
| `thinking` | AI reasoning step (shown in real-time) |
| `text` | Response text chunk |
| `products` | Product recommendations |
| `tip` | Helpful tips |
| `done` | Stream complete |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |

## Key Components

### ThinkingStepsLoader
Displays real-time AI thinking process with animated steps. Shows actual Gemini thoughts translated to Georgian.

### ChatResponse
Renders the AI response with markdown support, product cards, quick replies, and tips.

### ProductCard
Beautiful product cards with image, price, and "Buy" button linking to Scoop.ge.

## See Also

- [Backend Repository](https://github.com/Maqashable-284/scoop-streaming-backend)
