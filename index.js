const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
let jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASSWORD}@cluster0.prabmlk.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const appointmentCollection = client
      .db("doctorsChamber")
      .collection("appointmentCollection");
    const bookingCollection = client
      .db("doctorsChamber")
      .collection("bookingCollection");
    const usersCollection = client
      .db("doctorsChamber")
      .collection("usersCollection");
    const doctorsCollection = client
      .db("doctorsChamber")
      .collection("doctorsCollection");

    // make sure to use verifyAdmin after jwtVerify
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        res.status(403).send({ message: "forbidden Access" });
      }
      next()
    };

    const jwtVerify = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send("Unauthorized Access");
      }

      const token = authHeader.split(" ")[1];

      jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(403).send("Forbidden access");
        }
        req.decoded = decoded;
        next();
      });
    };

    app.get("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const appointment = await appointmentCollection.findOne(query);
      res.send(appointment);
    });

    // use aggregate to query multiple collection of data then marge data

    app.get("/appointments", async (req, res) => {
      const date = req.query.date;

      const query = {};
      const appointmentsOptions = await appointmentCollection
        .find(query)
        .toArray();
      const bookingQuery = { appintmentDate: date };
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();
      // code carefully
      appointmentsOptions.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (booked) => booked.servicesName === option.name
        );
        const bookedSlots = optionBooked.map((booked) => booked.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(appointmentsOptions);
    });

    app.get("/bookings", jwtVerify, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const query = {
        appintmentDate: booking.appintmentDate,
        email: booking.email,
        servicesName: booking.servicesName,
      };
      const alreadyBooked = await bookingCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You already booked ${booking.slot} on ${booking.appintmentDate} for ${booking.servicesName}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const authHeader = req.headers.authorization;
      const email = req.headers.email;

      const query = {};
      const users = await usersCollection.find(query).toArray();

      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.put("/users/admin/:id", jwtVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const update = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, update, options);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req?.query?.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.JWT_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "No token faund" });
    });

    // Add doctor
    // ....................
    app.get("/doctorsSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/doctors", jwtVerify, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await doctorsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/doctors", jwtVerify, verifyAdmin, async (req, res) => {
      const doctorInfo = req.body;
      console.log(doctorInfo);
      const result = await doctorsCollection.insertOne(doctorInfo);
      res.send(result);
    });

    app.delete("/doctors/:id", jwtVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Server are you OKKK??");
});

app.listen(port, () => {
  console.log("The port is ", port);
});
