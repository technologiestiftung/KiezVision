import globals from "globals";
import technologiestiftung from "@technologiestiftung/eslint-config";
import react from "eslint-plugin-react";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default [
	{
		ignores: ["dist/**", "node_modules/**", "coverage/**"],
	},
	...technologiestiftung,
	{
		files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
		plugins: {
			react,
		},
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"no-undef": "off",
			"react/react-in-jsx-scope": "off",
			"react/self-closing-comp": "error",
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{
					allowShortCircuit: true,
					allowTernary: true,
					allowTaggedTemplates: true,
				},
			],
		},
	},
	eslintConfigPrettier,
];
