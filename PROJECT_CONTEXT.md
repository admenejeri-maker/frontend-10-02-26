# Scoop AI - Frontend Project Context

> 📋 პროექტის კონტექსტი AI აგენტებისთვის  
> **Version:** 2.5.0 | **Last Updated:** 2026-01-17

---

## 🏗️ რეპოზიტორიები

| პროექტი | GitHub | Production URL |
|---------|--------|----------------|
| **Frontend** | [scoop-vercel-fresh](https://github.com/Maqashable-284/scoop-vercel-fresh) | https://scoop-vercel-358331686110.europe-west1.run.app |
| **Backend** | [scoop-generative-ai-sdk-28-04](https://github.com/Maqashable-284/scoop-generative-ai-sdk-28-04) | https://scoop-ai-sdk-358331686110.europe-west1.run.app |

---

## 📂 ფაილური სტრუქტურა

```
src/
├── app/
│   ├── page.tsx              # Main page entry
│   └── globals.css           # 🎨 Global styles + stability classes
├── components/
│   ├── Chat.tsx              # 🔥 Main chat container (max-w-[1184px])
│   ├── chat-response.tsx     # Message rendering (ai-response-grid)
│   ├── thinking-steps-loader.tsx  # Loading state (ai-response-grid)
│   ├── empty-screen.tsx      # Welcome screen + invisible spacer
│   └── sidebar.tsx           # Gemini-style sidebar
└── lib/
    └── parseProducts.ts      # Markdown parser
```

---

## 🚀 ლოკალური გაშვება

```bash
cd scoop-frontend-original-github
npm run dev     # http://localhost:3000
npm run build   # Production build
```

---

## ☁️ CI/CD

```
git push origin main → Cloud Build → Cloud Run (ავტომატური)
```

---

## 📅 Changelog

### v2.5.0 (2026-01-17) - Gemini-style Mobile Layout
| ფაილი | ცვლილება |
|-------|----------|
| `Chat.tsx` | Emojis removed from pills, compact text, `flex-nowrap` |
| `globals.css` | Single-line pills layout, `max-w-[768px]` |

### v2.4.0 (2026-01-17) - Gemini-style Sidebar Redesign
| ფაილი | ცვლილება |
|-------|----------|
| `sidebar.tsx` | PenLine icon, removed "ბოლო საუბრები" header, cursor-pointer |
| `Chat.tsx` | Scrolling behavior fix, removed top border from quick replies |
| `globals.css` | +564 lines Gemini-style UI classes |

### v2.3.0 (2026-01-17) - Container Width Stability
| ფაილი | ცვლილება |
|-------|----------|
| `Chat.tsx` | `w-full max-w-[1184px]` root container |
| `globals.css` | +42 lines: `.ai-response-grid`, `.chat-scroll-container` |
| `chat-response.tsx` | Added `ai-response-grid` class |
| `thinking-steps-loader.tsx` | Added `ai-response-grid` class |
| `empty-screen.tsx` | Invisible 32px spacer for layout consistency |
| `parseProducts.ts` | Minor stability fixes |

**პრობლემა:** EmptyScreen → ThinkingStepsLoader → ChatResponse გადასვლისას width იცვლებოდა (822px → 896px), "jump" ეფექტი.

**გადაწყვეტა:** Fixed grid layout + consistent wrapper width.

---

## 🎨 CSS Stability Classes

```css
/* globals.css */
.ai-response-grid {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  width: 100%;
}

.chat-scroll-container {
  width: 100%;
  max-width: 1184px;
}
```

---

## 📊 არქიტექტურა

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloud Run                               │
├─────────────────────────────┬───────────────────────────────────┤
│      scoop-vercel           │         scoop-ai-sdk              │
│      (Frontend)             │          (Backend)                │
│      Next.js 16             │      FastAPI + Gemini 3 Flash     │
│                             │                                   │
│  NEXT_PUBLIC_BACKEND_URL ───┼──────► /chat/v2                   │
│                             │        /health                    │
└─────────────────────────────┴───────────────────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │    MongoDB Atlas    │
                              │     scoop_db        │
                              └─────────────────────┘
```

---

## ⚠️ კრიტიკული წესები

1. **არ შეცვალო** `max-w-[1184px]` - layout stability
2. **არ წაშალო** `ai-response-grid` კლასები - prevents width jump
3. **Tailwind Only** - no inline styles for core layout
4. **Test locally** before push - `npm run build`
