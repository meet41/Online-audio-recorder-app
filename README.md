# Voice Memos Cloud - Online Recording CRUD

A modern, responsive, voice recording and sharing web application designed with the Voice Memos / Pixel Recorder mobile aesthetic.

## 🚀 Key Features

1. **Lightweight Auth**: Sign in with just your name — no passwords required.
2. **Audio Recorder**:
   - Record with high-fidelity `.webm` (Opus compression).
   - Live waveform visualizer using Web Audio API.
   - Pause / Resume recording anytime.
   - Live timer.
   - Discard or Save workflow.
3. **Smart Naming & Auto-Increment**:
   - Default name generated: `<username>-YYYY-MM-DD`
   - If multiple recordings are made on the same day: `<username>-YYYY-MM-DD (1)`, `(2)`, etc.
   - Fully editable title prior to saving, and rename option available on any recording card.
4. **Detailed Metadata**:
   - Displays file size in human-readable units (`KB`, `MB`).
   - Recording duration.
   - Author name and creation date.
5. **Full CRUD & Recycle Bin**:
   - Play/pause audio with scrubber bar and reset button.
   - Copy public shareable link.
   - Download `.webm` file.
   - Soft delete to "Recently Deleted" tab.
   - Restore or permanently delete (from storage & DB).
6. **Graceful Fallback**:
   - If Firebase credentials are not yet entered, the app runs in **Offline / Local Storage cache mode** so you can test immediately.

---

## 🛠️ Setting up Firebase (Free Tier)

### 1. In Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/) and open your project.
2. **Firestore Database**:
   - Click **Build > Firestore Database** -> **Create Database** (Start in Test Mode).
   - Security rules:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```
3. **Cloud Storage**:
   - Click **Build > Storage** -> **Get Started** (Start in Test Mode).
   - Security rules:
     ```javascript
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /{allPaths=**} {
           allow read, write: if true;
         }
       }
     }
     ```
4. **Project Settings**:
   - Go to **Project Settings** (gear icon) -> **General** -> **Your apps** -> Web (`</>`).
   - Copy the `firebaseConfig` keys.

### 2. Configure Environment Variables:
Create a `.env` file in the root directory (based on `.env.example`):
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 💻 Running Locally

```powershell
npm run dev
```

Visit the displayed local URL (usually `http://localhost:5173`).

---

## 🌐 100% Free Deployment Options

### Option A: Firebase Hosting (Recommended)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
   - Public directory: `dist`
   - Single-page app: `Yes`
4. Build & deploy:
   ```powershell
   npm run build
   firebase deploy --only hosting
   ```

### Option B: Vercel / Netlify (Free)
1. Push code to GitHub repository.
2. Import project into Vercel or Netlify.
3. Add the `VITE_FIREBASE_*` environment variables in their dashboard.
4. Auto-deploys for free with global CDN and SSL.
