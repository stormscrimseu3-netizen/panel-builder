export type EggVariable = {
  name: string;
  description?: string;
  env: string;
  default: string;
  rules: string;
  secret?: boolean;
  user_viewable?: boolean;
  user_editable?: boolean;
  field_type?: "text" | "textarea" | "number" | "password" | "select";
};

export type EggDefinition = {
  id: string;
  name: string;
  author: string;
  description: string;
  category: "Generic" | "Games";
  runtime: "nodejs" | "python" | "java" | "docker";
  image: string;
  startup: string;
  stop: string;
  variables: EggVariable[];
};

export const eggs: EggDefinition[] = [
  {
    id: "generic/nodejs",
    name: "Node.js 20 Bot",
    author: "nebula",
    category: "Generic",
    runtime: "nodejs",
    description: "Generic Node.js 20 runtime. Clones a git repo, installs packages, then starts your main file.",
    image: "node:20-bullseye",
    startup: "node {{MAIN_FILE}}",
    stop: "^C",
    variables: [
      { name: "Git repository", description: "Optional repository URL to clone during install.", env: "GIT_REPO", default: "", rules: "nullable|url", user_viewable: true, user_editable: true },
      { name: "Git branch", description: "Branch to clone when a repository is provided.", env: "GIT_BRANCH", default: "main", rules: "required|string|max:64", user_viewable: true, user_editable: true },
      { name: "Main file", description: "The JavaScript file used in the startup command.", env: "MAIN_FILE", default: "index.js", rules: "required|string|max:120", user_viewable: true, user_editable: true },
      { name: "Bot token", description: "Stored as a secret variable and hidden after entry.", env: "BOT_TOKEN", default: "", rules: "required|string|max:256", secret: true, user_viewable: true, user_editable: true, field_type: "password" },
    ],
  },
  {
    id: "generic/python",
    name: "Python 3.12 Bot",
    author: "nebula",
    category: "Generic",
    runtime: "python",
    description: "Generic Python 3.12 runtime. Installs requirements.txt then runs your main file.",
    image: "python:3.12-bullseye",
    startup: "python -u {{MAIN_FILE}}",
    stop: "^C",
    variables: [
      { name: "Git repository", description: "Optional repository URL to clone during install.", env: "GIT_REPO", default: "", rules: "nullable|url", user_viewable: true, user_editable: true },
      { name: "Git branch", description: "Branch to clone when a repository is provided.", env: "GIT_BRANCH", default: "main", rules: "required|string|max:64", user_viewable: true, user_editable: true },
      { name: "Main file", description: "The Python file used in the startup command.", env: "MAIN_FILE", default: "bot.py", rules: "required|string|max:120", user_viewable: true, user_editable: true },
      { name: "Bot token", description: "Stored as a secret variable and hidden after entry.", env: "BOT_TOKEN", default: "", rules: "required|string|max:256", secret: true, user_viewable: true, user_editable: true, field_type: "password" },
    ],
  },
  {
    id: "generic/java",
    name: "Java 21 (JDA / generic JAR)",
    author: "nebula",
    category: "Generic",
    runtime: "java",
    description: "JRE 21 runtime for JDA bots and executable JVM apps.",
    image: "eclipse-temurin:21-jre",
    startup: "java -Xms128M -Xmx{{MAX_MEMORY}}M -jar {{JAR_FILE}}",
    stop: "^C",
    variables: [
      { name: "JAR file", description: "Executable JAR path in the server files.", env: "JAR_FILE", default: "bot.jar", rules: "required|string|max:120", user_viewable: true, user_editable: true },
      { name: "Max memory (MB)", description: "Memory value injected into the Java startup command.", env: "MAX_MEMORY", default: "1024", rules: "required|integer|min:128|max:8192", user_viewable: true, user_editable: true, field_type: "number" },
      { name: "Bot token", description: "Stored as a secret variable and hidden after entry.", env: "BOT_TOKEN", default: "", rules: "required|string|max:256", secret: true, user_viewable: true, user_editable: true, field_type: "password" },
    ],
  },
  {
    id: "generic/bun",
    name: "Bun 1.x Bot",
    author: "nebula",
    category: "Generic",
    runtime: "nodejs",
    description: "Bun runtime with fast cold starts and TypeScript support.",
    image: "oven/bun:1",
    startup: "bun run {{MAIN_FILE}}",
    stop: "^C",
    variables: [
      { name: "Git repository", description: "Optional repository URL to clone during install.", env: "GIT_REPO", default: "", rules: "nullable|url", user_viewable: true, user_editable: true },
      { name: "Git branch", description: "Branch to clone when a repository is provided.", env: "GIT_BRANCH", default: "main", rules: "required|string|max:64", user_viewable: true, user_editable: true },
      { name: "Main file", description: "Entry script passed to bun run.", env: "MAIN_FILE", default: "index.ts", rules: "required|string|max:120", user_viewable: true, user_editable: true },
      { name: "Bot token", description: "Stored as a secret variable and hidden after entry.", env: "BOT_TOKEN", default: "", rules: "required|string|max:256", secret: true, user_viewable: true, user_editable: true, field_type: "password" },
    ],
  },
  {
    id: "generic/deno",
    name: "Deno Bot",
    author: "nebula",
    category: "Generic",
    runtime: "nodejs",
    description: "Deno TypeScript runtime with secure defaults.",
    image: "denoland/deno:alpine",
    startup: "deno run -A {{MAIN_FILE}}",
    stop: "^C",
    variables: [
      { name: "Git repository", description: "Optional repository URL to clone during install.", env: "GIT_REPO", default: "", rules: "nullable|url", user_viewable: true, user_editable: true },
      { name: "Git branch", description: "Branch to clone when a repository is provided.", env: "GIT_BRANCH", default: "main", rules: "required|string|max:64", user_viewable: true, user_editable: true },
      { name: "Main file", description: "TypeScript or JavaScript file passed to deno run.", env: "MAIN_FILE", default: "main.ts", rules: "required|string|max:120", user_viewable: true, user_editable: true },
      { name: "Bot token", description: "Stored as a secret variable and hidden after entry.", env: "BOT_TOKEN", default: "", rules: "required|string|max:256", secret: true, user_viewable: true, user_editable: true, field_type: "password" },
    ],
  },
  {
    id: "games/minecraft-paper",
    name: "Minecraft: Paper",
    author: "nebula",
    category: "Games",
    runtime: "java",
    description: "PaperMC server. Downloads the latest Paper build for the chosen Minecraft version.",
    image: "eclipse-temurin:21-jre",
    startup: "java -Xms128M -Xmx{{MAX_MEMORY}}M -jar paper.jar nogui",
    stop: "stop",
    variables: [
      { name: "Minecraft version", description: "Paper version to install.", env: "MC_VERSION", default: "1.21.1", rules: "required|string|max:20", user_viewable: true, user_editable: true },
      { name: "Max memory (MB)", description: "Memory value injected into the server startup command.", env: "MAX_MEMORY", default: "2048", rules: "required|integer|min:512|max:8192", user_viewable: true, user_editable: true, field_type: "number" },
    ],
  },
];

export function getEgg(id: string) {
  return eggs.find((egg) => egg.id === id) ?? eggs[0];
}

export function defaultEggVariables(egg: EggDefinition) {
  return Object.fromEntries(egg.variables.map((variable) => [variable.env, variable.default]));
}

export function renderStartup(startup: string, variables: Record<string, string>) {
  return startup.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

export function validateEggVariables(egg: EggDefinition, values: Record<string, string>) {
  for (const variable of egg.variables) {
    const value = values[variable.env]?.trim() ?? "";
    const rules = variable.rules.split("|");

    if (rules.includes("required") && value.length === 0) {
      return `${variable.name} is required.`;
    }
    if (value.length === 0 && rules.includes("nullable")) continue;

    if (rules.includes("integer") && !/^-?\d+$/.test(value)) {
      return `${variable.name} must be a whole number.`;
    }
    if (rules.includes("boolean") && !/^(true|false|0|1)$/i.test(value)) {
      return `${variable.name} must be true or false.`;
    }
    if (rules.includes("url")) {
      try {
        const url = new URL(value);
        if (!/^https?:$/.test(url.protocol)) return `${variable.name} must be a valid URL.`;
      } catch {
        return `${variable.name} must be a valid URL.`;
      }
    }

    for (const rule of rules) {
      const [, rawMin] = rule.match(/^min:(\d+)$/) ?? [];
      const [, rawMax] = rule.match(/^max:(\d+)$/) ?? [];
      const [, rawIn] = rule.match(/^in:(.+)$/) ?? [];
      if (rawMin) {
        const min = Number(rawMin);
        if (rules.includes("integer") ? Number(value) < min : value.length < min) return `${variable.name} must be at least ${min}.`;
      }
      if (rawMax) {
        const max = Number(rawMax);
        if (rules.includes("integer") ? Number(value) > max : value.length > max) return `${variable.name} must be at most ${max}.`;
      }
      if (rawIn && !rawIn.split(",").includes(value)) {
        return `${variable.name} must be one of: ${rawIn}.`;
      }
    }
  }

  return null;
}
