require("dotenv/config");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Grupo Leo API funcionando correctamente", status: "ok" });
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/servicios", require("./routes/servicios"));
app.use("/api/vehiculos", require("./routes/vehiculos"));
app.use("/api/conductores", require("./routes/conductores"));
app.use("/api/clientes", require("./routes/clientes"));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
