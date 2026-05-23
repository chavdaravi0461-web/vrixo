import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextVitals, ...nextTypescript];

eslintConfig.unshift({
  ignores: [
    ".next/**",
    "**/.next/**",
    ".next-build/**",
    "**/.next-build/**",
    ".netlify/**",
    ".runtime/**",
    "node_modules/**",
    "tailwindcss-*.log"
  ]
});

eslintConfig.push({
  rules: {
    "@typescript-eslint/no-explicit-any": "off"
  }
});

export default eslintConfig;
