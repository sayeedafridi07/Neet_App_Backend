// import "dotenv/config";
// import app from "./app.js";

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });
import "dotenv/config";
import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log("🟢 Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("🔴 Database connection failed:", error);
    process.exit(1);
  }
}

startServer();