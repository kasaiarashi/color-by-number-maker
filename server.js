const { createApp } = require("./src/server/app");

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  Color-by-Number Maker running → http://localhost:${PORT}\n`);
});
