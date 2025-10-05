
# 🎵 Encore — Your concert conpanion

[![Expo](https://img.shields.io/badge/Expo-SDK%20%5E51-black)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.7x-61DAFB)](https://reactnative.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28)](https://firebase.google.com/)
[![Vercel](https://img.shields.io/badge/Serverless-Vercel-000000)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

> **Encore** makes concerts social again. Explore local shows, see which friends are going, and (optionally) share your seat to meet up at the venue.

---

## 💡 Inspiration

Each of our team members went to at least one concert this summer—often to the same artists—yet we didn’t realize it. Concerts are inherently social, but there isn’t an easy way to see who in your network will be there. **Encore** is our answer to two common problems concert-goers face: not knowing who else is going and being unable to connect once you’re there.

---

## ❓ What it does

- Browse upcoming concerts in your area  
- See which friends are **Attending** or **Interested**  
- Share seat info to find friends nearby in the venue  
- Bridge the gap between individual ticketing and the social nature of live shows

---

## 📝 Features

- 👥 Add friends and see overlapping concerts  
- 🌍 Browse concert feed by location  
- ✅ Mark status: **Attending** or **Interested**  
- 💺 Optionally share your seat number to meet friends in the venue  

---

## 🛠️ How we built it

- **Frontend:** Expo (React Native) + TypeScript  
- **Styling:** TailwindCSS (NativeWind)  
- **Backend:** Firebase Auth + Firestore  
- **Concert Data:** Ticketmaster Discovery API (fetched via Vercel serverless functions)  
- **Deployment:** Vercel + Expo Go for testing  

---

## 🧠 What we learned

- The power of social networking in event discovery  
- How APIs like Ticketmaster can enrich real‑time data experiences  
- Firebase integration with React Native for scalable data management  

---

## 💭 What’s next for Encore

- Partner with local venues beyond Ticketmaster to expand concert listings  
- Integrate Spotify / Apple Music APIs to recommend concerts by artists users follow  
- Add concert groups, photo sharing, and user reviews  

---

## 🚀 Getting Started

### 1️⃣ Clone the repo
```bash
git clone https://github.com/yourusername/encore.git
cd encore
```

### 2️⃣ Install dependencies
```bash
npm install
# or
yarn install
```

### 3️⃣ Set up environment variables

Create a `.env` file with:

```
TM_API_KEY=your_ticketmaster_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

### 4️⃣ Run locally
```bash
npx expo start
```

---

## 🧩 Project Structure

```
encore/
├── app/
│   ├── (auth)/login.tsx
│   ├── (main)/home.tsx
│   ├── (main)/friends.tsx
│   ├── _layout.tsx
│   └── index.tsx
├── components/ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── text.tsx
├── lib/
│   ├── firebase.ts
│   ├── tmService.ts     # Ticketmaster API
│   └── postService.ts
├── package.json
├── tailwind.config.js
└── README.md
```

---

## 🧑‍💻 Authors

Team Encore — Built at **StormHacks 2025**💙  
Made with ❤️ by developers who just love concerts.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
