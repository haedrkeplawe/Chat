require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
// const db = "mongodb://localhost:27017/test7";
const db =
  "mongodb+srv://alihassanhaedr:c4a@cluster0.ue5ezcc.mongodb.net/2024chat?retryWrites=true&w=majority";
const port = process.env.PORT || 4000;
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const ws = require("ws");
const fs = require("fs");

const JWT_SECRET = "sdhfklsdhfksalkglah";

app.use((req, res, next) => {
  console.log(req.path, req.method);
  next();
});

app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173"],
  })
);
app.use(express.json());
app.use(cookieParser());

async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, JWT_SECRET, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      reject("no token");
    }
  });
}

app.get("/messages/:userId", async (req, res) => {
  const { userId } = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createdAt: 1 });
  res.json(messages);
});

app.get("/people", async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const createUser = await User.create({
      username,
      password: hashedPassword,
    });
    jwt.sign(
      { userId: createUser._id, username },
      JWT_SECRET,
      {},
      (err, token) => {
        if (err) throw err;
        res
          .cookie("token", token, { sameSite: "none", secure: true })
          .status(201)
          .json({
            id: createUser._id,
          });
      }
    );
  } catch (error) {
    if (error) throw error;
    res.status(500).json("error");
  }
});

app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, JWT_SECRET, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(401).json("no token");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign(
        { userId: foundUser._id, username },
        JWT_SECRET,
        {},
        (err, token) => {
          if (err) throw err;
          res
            .cookie("token", token, { sameSite: "none", secure: true })
            .status(201)
            .json({
              id: foundUser._id,
            });
        }
      );
    }
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "", { sameSite: true, secure: true }).json("ok");
});

//notify everyone about online people (when someone connects)
mongoose
  .connect(db)
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`http://localhost:${port}/`);
    });
    const wss = new ws.WebSocketServer({ server });
    wss.on("connection", (connection, req) => {
      function notifyAboutOnlinePeople() {
        [...wss.clients].forEach((client) => {
          client.send(
            JSON.stringify({
              online: [...wss.clients].map((c) => ({
                userId: c.userId,
                username: c.username,
              })),
            })
          );
        });
      }
      connection.isAlive = true;
      connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
          connection.isAlive = false;
          clearInterval(connection.timer);
          connection.terminate();
          notifyAboutOnlinePeople();
          console.log("dead");
        }, 1000);
      }, 5000);

      connection.on("pong", () => {
        clearTimeout(connection.deathTimer);
      });
      // read username and id form the cookie for this connection
      const cookies = req.headers.cookie;
      if (cookies) {
        const tokenCookieString = cookies
          .split(";")
          .find((str) => str.startsWith("token="));
        if (tokenCookieString) {
          const token = tokenCookieString.split("=")[1];
          if (token) {
            jwt.verify(token, JWT_SECRET, {}, (err, userData) => {
              if (err) throw err;
              const { userId, username } = userData;
              connection.userId = userId;
              connection.username = username;
            });
          }
        }
      }

      connection.on("message", async (message) => {
        messageData = JSON.parse(message.toString());
        const { recipient, text, file } = messageData;
        let filename;
        if (file) {
          const parts = file.name.split(".");
          const ext = parts[parts.length - 1];
          filename = Date.now() + "." + ext;
          const path = __dirname + "/uploads/" + filename;
          const bufferData = new Buffer(file.data.split(",")[1], "base64");
          fs.writeFile(path, bufferData, () => {
            console.log("file saved" + path);
          });
        }
        if (recipient && (text || file)) {
          const messagaeDoc = await Message.create({
            sender: connection.userId,
            recipient,
            text,
            file: filename || null,
          });
          [...wss.clients]
            .filter((c) => c.userId === recipient)
            .forEach((c) =>
              c.send(
                JSON.stringify({
                  text,
                  sender: connection.userId,
                  recipient,
                  file: file ? filename : null,
                  _id: messagaeDoc._id,
                })
              )
            );
        }
      });
      //notify everyone about online people (when someone connects)
      notifyAboutOnlinePeople();
    });
  })
  .catch((err) => {
    console.log(err);
  });
