const { spawn } = require("child_process");
const path = require("path");

const isWindows = process.platform === "win32";
const projectRoot = path.resolve(__dirname, "..");

let shuttingDown = false;
const children = [];

function startDevProcess(name, relativeCwd) {
  const cwd = path.join(projectRoot, relativeCwd);
  const child = isWindows
    ? spawn("npm run dev", [], {
        cwd,
        stdio: "inherit",
        env: process.env,
        shell: true,
      })
    : spawn("npm", ["run", "dev"], {
        cwd,
        stdio: "inherit",
        env: process.env,
      });

  child.on("error", (error) => {
    console.error(`[dev:full] Error iniciando ${name}:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `codigo ${code}`;
    console.log(`[dev:full] ${name} finalizo (${reason}). Cerrando procesos...`);
    shutdown(code && code !== 0 ? code : 0);
  });

  children.push(child);
}

function killChild(child) {
  if (!child || child.exitCode !== null) return;

  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    killChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev:full] Iniciando backend y frontend...");
startDevProcess("backend", "backend");
startDevProcess("frontend", "frontend");
