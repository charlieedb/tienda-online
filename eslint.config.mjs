import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src/app/**", "src/components/store/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/main.tsx", "src/App.tsx", "src/catalog/**/*.ts", "src/auth/AuthProvider.tsx", "src/components/{Icons,ProductCard,CartView,ProfileView,AuthWelcome}.tsx", "src/store/cart.ts", "src/lib/{appVersion,firebase,env,userProfile}.ts"],
    languageOptions: { parserOptions: { project: "./tsconfig.json" } },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
);
