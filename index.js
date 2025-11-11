const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const { ObjectId } = require("mongodb");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8uqequc.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("habits_db");
    const habitsCollection = db.collection("habits");

    app.get("/", (req, res) => {
      res.send("Habit Tracker API is running...");
    });

    app.get("/habits", async (req, res) => {
      const result = await habitsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/habits", async (req, res) => {
      const habit = req.body;
      if (!habit?.title || !habit?.category || !habit?.userEmail) {
        return res.status(400).send({ message: "Missing required fields" });
      }

      habit.createdAt = new Date();
      const result = await habitsCollection.insertOne(habit);
      res.send(result);
    });

    app.get("/habits/featured", async (req, res) => {
      try {
        const result = await habitsCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to load featured habits", error });
      }
    });

    app.get("/my-habits", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const query = { userEmail: email };
        const result = await habitsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching user habits:", error);
        res.status(500).send({ message: "Failed to fetch user habits" });
      }
    });

    app.put("/habits/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedHabit = req.body;

        const result = await habitsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedHabit }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update habit", error });
      }
    });

    app.delete("/habits/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await habitsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete habit", error });
      }
    });

    app.get("/habits/:id", async (req, res) => {
      const id = req.params.id;
      const habit = await habitsCollection.findOne({ _id: new ObjectId(id) });
      res.send(habit);
    });

    app.patch("/habits/complete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const habit = await habitsCollection.findOne({ _id: new ObjectId(id) });

        if (!habit) {
          return res.status(404).send({ message: "Habit not found" });
        }

        const today = new Date().toLocaleDateString("en-GB");
        const formattedDate = today.replace(/\//g, "-");

        let completionHistory = habit.completionHistory || [];

        if (completionHistory.includes(formattedDate)) {
          return res.status(400).send({ message: "Already completed today" });
        }

        completionHistory.push(formattedDate);

        completionHistory.sort((a, b) => {
          const [da, ma, ya] = a.split("-").map(Number);
          const [db, mb, yb] = b.split("-").map(Number);
          return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
        });

        let streak = 0;
        for (let i = completionHistory.length - 1; i >= 0; i--) {
          const [d, m, y] = completionHistory[i].split("-").map(Number);
          const date = new Date(y, m - 1, d);

          const prev = new Date();
          prev.setDate(prev.getDate() - streak);

          if (
            date.getDate() === prev.getDate() &&
            date.getMonth() === prev.getMonth() &&
            date.getFullYear() === prev.getFullYear()
          ) {
            streak++;
          } else break;
        }

        const result = await habitsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { completionHistory, currentStreak: streak } }
        );

        res.send({
          success: true,
          message: "Habit marked complete!",
          currentStreak: streak,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to complete habit", error });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
