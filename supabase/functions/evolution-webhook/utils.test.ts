import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { normalizeArgentinePhone } from "./utils.ts";

Deno.test("normalizeArgentinePhone - phone already normalized", () => {
  const input = "5493464448309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone with @s.whatsapp.net suffix", () => {
  const input = "5493464448309@s.whatsapp.net";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone starting with 54 (12 digits)", () => {
  const input = "543464448309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone starting with 9 (11 digits)", () => {
  const input = "93464448309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone without country code (10 digits)", () => {
  const input = "3464448309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone with spaces and symbols", () => {
  const input = "+54 9 (346) 444-8309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone with extra digits (truncate)", () => {
  const input = "00115493464448309";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - phone with @s.whatsapp.net and extra characters", () => {
  const input = "+54 9 346 444 8309@s.whatsapp.net";
  const expected = "5493464448309";
  assertEquals(normalizeArgentinePhone(input), expected);
});

Deno.test("normalizeArgentinePhone - edge case: only numbers", () => {
  const input = "346444830";
  const expected = "549346444830";
  assertEquals(normalizeArgentinePhone(input), expected);
});
