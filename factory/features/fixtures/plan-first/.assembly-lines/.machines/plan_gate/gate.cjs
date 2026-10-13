#!/usr/bin/env node
// A checkpoint check costs no model tokens. The factory supplies paths on stdin.
const { existsSync, readFileSync } = require("node:fs");
const prompt = readFileSync(0, "utf8");
const plan = prompt.match(/^Plan: (.+)$/m)?.[1];
const review = prompt.match(/^Plan review state: (.+)$/m)?.[1];
if (!plan || !review) throw new Error("The plan gate needs the plan and review-state paths.");
const state = existsSync(review) ? JSON.parse(readFileSync(review, "utf8")) : undefined;
console.log(JSON.stringify({ ready: existsSync(plan) && state?.status === "accepted" }));
