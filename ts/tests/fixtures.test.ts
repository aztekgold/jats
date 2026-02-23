import { describe, it, expect } from "vitest";
import { validateAgentable } from "../src/migrate";
import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../spec/fixtures");

describe("Shared Fixtures", () => {
    describe("Valid Fixtures", () => {
        const validDir = path.join(FIXTURES_DIR, "valid");
        const files = fs.readdirSync(validDir).filter(f => f.endsWith(".json"));

        files.forEach(file => {
            it(`should validate ${file}`, () => {
                const content = fs.readFileSync(path.join(validDir, file), "utf-8");
                const data = JSON.parse(content);
                expect(() => validateAgentable(data)).not.toThrow();
            });
        });
    });

    describe("Invalid Fixtures", () => {
        const invalidDir = path.join(FIXTURES_DIR, "invalid");
        const files = fs.readdirSync(invalidDir).filter(f => f.endsWith(".json"));

        files.forEach(file => {
            it(`should reject ${file}`, () => {
                const content = fs.readFileSync(path.join(invalidDir, file), "utf-8");
                const data = JSON.parse(content);
                expect(() => validateAgentable(data)).toThrow();
            });
        });
    });
});
