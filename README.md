# Aviator Crash Game ✈️

**Aviator Crash Game** is an exciting and dynamic multiplayer betting game where players test their luck and timing to win big! With a sleek, responsive interface and real-time gameplay powered by cutting-edge technologies, this game offers an engaging experience for users.

## �‍💻 Author

**Akash Mahla** - Full Stack Developer & Game Creator

 [GitHub](https://github.com/akashmahlax)
 [Linkedin](https://linkedin/in/akashmahlax)
 
## 🌟 Features

### 🎮 Game Mechanics

- **Place Bets**: Choose your bet amount and join the game.
- **Real-Time Multiplier**: Watch the multiplier increase as the plane takes off.
- **Cash Out**: Withdraw your winnings before the plane crashes.
- **Unpredictable Crashes**: Adds excitement and keeps players on edge.

### 📈 Core Highlights

- **Real-Time Updates**: Powered by WebSocket for seamless gameplay.
- **Demo Round History**: Recent simulated multipliers are shown for reference; they are not independently verifiable.
- **User-Friendly UI**: Designed with Tailwind CSS for a smooth, responsive experience.
- **Leaderboards**: Track top players and compare performances.

### 🔒 Security & Transparency

- Secure login and gameplay.
- Demo credits have no cash value; the game does not process payments.

## 🛠️ Tech Stack

### Frontend

- **React.js**: For building a dynamic and responsive UI.
- **TypeScript:** Ensures robust and scalable code.
- **Tailwind CSS**: Provides a sleek and modern design.
- **Socket.IO**: Enables real-time communication between players and the server.

### Backend

- **Node.js**: High-performance server-side logic.
- **TypeScript**: For type safety and maintainability.
- **Socket.IO**: Real-time communication.
- **MongoDB**: Efficient database for managing user data and game states.

## 📂 Project Structure

```
aviator-crash-game/
├── aviator-front/
│   ├── src/
│   │   ├── @types/
│   │   ├── components/
│   │   ├── assets/
│   │   ├── utils/
├── aviator-back/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
|   | 
|___aviator-backend
   
```

---

## ⚙️ Setup Instructions

### Frontend

1. Navigate to the aviator-front directory:

```
cd aviator-front
```

2. Install dependencies

```
yarn install
```

3. Start the development server:

```
npm run dev
```

## 🎉 How to Play

- Sign up or log in to your account.
- Place your bet and wait for the round to begin.
- Watch the multiplier increase and decide when to cash out.
- Win big if you cash out before the crash!

## Deployment

Deploy the backend from `render.yaml` as a Render Blueprint. Configure these Render environment variables in the service dashboard:

- `MONGODB_URI`: the MongoDB connection string (keep it in the provider's secret environment-variable store; never commit it).
- `MONGODB_DB`: database name; defaults to `aviator_crash`.
- `FRONTEND_ORIGIN`: the exact frontend origin, such as `https://your-project.vercel.app` (multiple comma-separated origins are supported).

Render supplies `PORT`. The backend refuses to start in production without `MONGODB_URI`; account credentials, sessions, balances, and wallet history are stored in MongoDB.

Deploy the frontend from the same repository on Vercel and set `REACT_APP_API_URL` to the backend's HTTPS origin, for example `https://your-service.onrender.com` (no `/api` suffix). This public URL is embedded at build time, so redeploy after changing it. Never put secrets in `REACT_APP_*` variables.

For local development, the frontend defaults to `http://localhost:5000` when `REACT_APP_API_URL` is unset. To explicitly run the backend with in-memory practice accounts, set `DEMO_STORAGE=memory`; this mode is rejected when `NODE_ENV=production`. Otherwise, `MONGODB_URI` must be configured and the backend exits if MongoDB cannot connect—it never silently switches storage modes. `mongodb+srv://` and remote MongoDB endpoints use TLS with certificate validation enabled. For a private certificate authority, configure its trusted CA through the MongoDB driver's supported TLS URI option; do not disable certificate or hostname verification. The game sidebar's simulated player count and sample wagers are clearly labeled demo-only and never affect balances or settlements. Game rounds, chat, and current bets remain in-memory demo state and reset when the backend restarts.

## 📜 Provably Fair

Each game round is provably fair, ensuring that the outcome is random and cannot be tampered with.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/akashmahlax/aviator-crash/issues).

## 📝 License

This project is created by **Akash Mahla**. All rights reserved.

## 🙏 Acknowledgments

- Built with passion by Akash Mahla
- Thanks to the React and Node.js communities for their amazing tools
- Special thanks to all beta testers and contributors

---

### 💻 About the Developer

**Akash Mahla** is a passionate full-stack developer specializing in modern web technologies. With expertise in React, Node.js, and real-time applications, Akash creates engaging and innovative gaming experiences.

**Skills**: React.js, TypeScript, Node.js, MongoDB, Socket.IO, Game Development

**Contact**:  [GitHub](https://github.com/akashmahlax)

---

⭐ **Star this repository if you found it helpful!** ⭐
