import { expect, test } from "@playwright/test";
import type { Book } from "../../lib/types";

const books: Book[] = Array.from({ length: 5 }, (_, index) => ({
  id: `fixture-${index}`,
  title: index === 0 ? "Harry Potter and the Order of the Phoenix" : `Example Book ${index}`,
  author: "J. K. Rowling", firstPublished: 2003, coverId: index + 1,
  color: "#305567", ink: "#fff", accent: "#dcc89e", material: "cloth",
  height: 250, width: 48, mark: "HP", isbn: null, openLibraryKey: null,
}));

const sizes = [
  [320, 568], [375, 812], [390, 844], [768, 1024],
  [844, 390], [1280, 600], [1440, 900], [1920, 1080],
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("https://covers.openlibrary.org/**", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#305567"/></svg>',
  }));
  await page.route("**/api/search", (route) => route.fulfill({ json: { mode: "jev", results: books.map((book) => ({ book, probability: .9 })) } }));
});

for (const [width, height] of sizes) {
  test(`search, refine, metadata, clear at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Ask your bookshelf" });
    await expect(input).toBeVisible();
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
    await expect(page.locator(".dev-controls")).toHaveCount(0);
    await expect.poll(() => page.locator(".book-spine").count()).toBeGreaterThanOrEqual(144);
    expect(await page.locator(".book-spine").count()).toBeLessThanOrEqual(288);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    // Verify both tracks cover the viewport throughout their complete animation.
    await expect.poll(() => page.locator(".marquee-track").evaluateAll((tracks) => tracks.every((track) => {
      const sequence = track.firstElementChild as HTMLElement;
      const full = track.getBoundingClientRect().width;
      return sequence.offsetWidth >= innerWidth && Math.abs(full - sequence.offsetWidth * 2) < 2;
    }))).toBe(true);
    await input.fill("Harry Potter");
    await input.press("Enter");
    await expect(page.locator(".state-settled")).toBeVisible();
    await expect(page.locator(".book-result")).toHaveCount(5);
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(2.25px)");
    await page.locator(".book-result").first().focus();
    const metadata = page.locator(".book-result-metadata").first();
    await expect(metadata).toHaveCSS("opacity", "1");
    const caption = await metadata.boundingBox();
    const cover = await page.locator(".book-result").first().boundingBox();
    const carousel = await page.locator(".cover-row").boundingBox();
    const search = await input.boundingBox();
    expect(caption!.width).toBeLessThanOrEqual(cover!.width + 1);
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(search!.y);
    if (width <= 720) expect(caption!.y + caption!.height).toBeLessThanOrEqual(carousel!.y + carousel!.height);
    expect(search!.y + search!.height).toBeLessThan(height);
    await info.attach("results", { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    const previous = await page.locator(".search-cluster").boundingBox();
    await input.fill("Harry Potter author");
    await input.press("Enter");
    await expect(page.locator(".state-settled")).toBeVisible();
    expect(Math.abs((await page.locator(".search-cluster").boundingBox())!.y - previous!.y)).toBeLessThan(2);
    await page.getByRole("button", { name: "Clear search and results" }).click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".book-result")).toHaveCount(0);
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
    expect(errors).toEqual([]);
  });
}

test("rate-limit feedback is visible without progress text", async ({ page }) => {
  await page.route("**/api/search", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "42" }, json: { error: "Too many searches" } }));
  await page.goto("/");
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByRole("status")).toHaveText("Too many searches. Try again in 42 seconds.");
});

test("resize and reduced-motion preserve the result layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".state-settled")).toBeVisible();
  await expect(page.locator(".marquee-track").first()).toHaveCSS("animation-name", "none");
  for (const entrance of await page.locator(".page-entrance").all()) {
    await expect(entrance).toHaveCSS("animation-name", "none");
    await expect(entrance).toHaveCSS("transform", "none");
    await expect(entrance).toHaveCSS("opacity", "1");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".book-result").last().focus();
  await expect(page.locator(".book-result-metadata").last()).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("textbox")).toBeInViewport();
  await page.getByRole("button", { name: "Clear search and results" }).click();
  await expect(page.locator(".book-result")).toHaveCount(0);
});

test("no-match responses remain clear and do not shift the input", async ({ page }) => {
  await page.route("**/api/search", (route) => route.fulfill({ json: { mode: "demo", results: [] } }));
  await page.goto("/");
  const input = page.getByRole("textbox");
  await expect(page.locator(".search-entrance")).toHaveCSS("transform", "none");
  const initial = await input.boundingBox();
  await input.fill("missing book");
  await input.press("Enter");
  await expect(page.getByRole("status")).toHaveText("No matching books. Try another search.");
  expect(Math.abs((await input.boundingBox())!.y - initial!.y)).toBeLessThan(2);
  await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
});

test("page entrance staggers from opposite edges and never replays during search", async ({ page }) => {
  // Freeze at the initial pose, independently of machine/load speed.
  await page.route("**/*.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n.page-entrance { animation-play-state: paused !important; }` });
  });
  await page.goto("/");
  const entrances = page.locator(".page-entrance");
  await expect(entrances).toHaveCount(3);
  const poses = await entrances.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { delay: style.animationDelay, y: new DOMMatrixReadOnly(style.transform).m42, opacity: style.opacity };
  }));
  expect(poses[0].delay).toBe("0s");
  expect(poses[0].y).toBeLessThan(0);
  expect(poses[1].delay).toBe("0.12s");
  expect(poses[1].y).toBeGreaterThan(0);
  expect(poses[2].delay).toBe("0.06s");
  expect(poses[2].y).toBeGreaterThan(0);
  expect(poses.map((pose) => pose.opacity)).toEqual(["0", "0", "0"]);

  // Input focus cancels decoration immediately; shelves finish independently.
  await page.getByRole("textbox").focus();
  await expect(page.locator(".search-entrance")).toHaveCSS("animation-name", "none");
  await page.locator(".shelf-entrance").evaluateAll((elements) => {
    elements.forEach((element) => element.getAnimations().forEach((animation) => animation.finish()));
  });
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".book-result")).toHaveCount(5);
  await page.getByRole("button", { name: "Clear search and results" }).click();
  await expect(page.locator(".book-result")).toHaveCount(0);
  for (const entrance of await entrances.all()) {
    await expect(entrance).toHaveCSS("transform", "none");
    await expect(entrance).toHaveCSS("opacity", "1");
  }
});

test("production API and security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const invalid = await request.post("/api/search", { data: { query: {} } });
  expect(invalid.status()).toBe(400);
  const crossSite = await request.post("/api/search", { data: { query: "books" }, headers: { Origin: "https://attacker.example" } });
  expect(crossSite.status()).toBe(403);
});
